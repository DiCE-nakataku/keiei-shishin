(() => {
  'use strict';

  let cloneSequence = 0;
  const stepOf = element => {
    const value = Number(element.dataset.msStep);
    return Number.isInteger(value) && value > 0 ? value : 0;
  };

  function effectStep(element) {
    const at = Number(element.dataset.msAt);
    return Math.max(stepOf(element), Number.isInteger(at) && at > 0 ? at : 0);
  }

  function copySlide(source) {
    const copy = source.cloneNode(true);
    copy.querySelectorAll('.no-print, [data-ms-exclude]').forEach(element => element.remove());
    const ids = new Map();
    const prefix = `ms-copy-${++cloneSequence}-`;
    const named = [...copy.querySelectorAll('[id]')];
    if (copy.id) named.unshift(copy);
    for (const element of named) {
      const id = element.id;
      ids.set(id, prefix + id);
      element.id = prefix + id;
    }
    if (!ids.size) return copy;

    for (const element of [copy, ...copy.querySelectorAll('*')]) {
      for (const { name, value } of [...element.attributes]) {
        if (name === 'id') continue;
        let updated = value.replace(/url\(#([^)]*)\)/g, (original, id) =>
          ids.has(id) ? `url(#${ids.get(id)})` : original);
        if (name === 'href' || name === 'xlink:href') {
          const id = updated.startsWith('#') && ids.get(updated.slice(1));
          if (id) updated = '#' + id;
        }
        if (/^(aria-labelledby|aria-describedby|aria-controls|aria-details|aria-owns|for|headers)$/.test(name)) {
          updated = updated.split(/\s+/).map(id => ids.get(id) ?? id).join(' ');
        }
        if (value !== updated) element.setAttribute(name, updated);
      }
    }
    return copy;
  }

  function mount(host, {
    slides, title = '発表モード', width, height, transition = 'S01', onClose,
    configure, onChange, focus = false, demoTiming = false, manualSteps = false,
  }) {
    if (!slides.length || width <= 0 || height <= 0) return null;
    const root = document.createElement('div');
    root.className = 'ms-player';
    root.innerHTML = `
      <div class="ms-chrome">
        <h2 class="ms-heading"></h2>
        <select class="ms-jump" aria-label="ページへ移動"></select>
        <select class="ms-level" aria-label="演出の強度">
          <option value="subtle">演出：控えめ</option>
          <option value="standard" selected>演出：標準</option>
          <option value="expressive">演出：強め</option>
          <option value="off">演出：OFF</option>
        </select>
        <button type="button" class="ms-replay">このページを再生</button>
        <button type="button" class="ms-full">全画面</button>
        <button type="button" class="ms-close">発表を終了</button>
      </div>
      <div class="ms-stage" tabindex="-1" role="region" aria-label="スライド">
        <div class="ms-frame"><div class="ms-canvas"></div></div>
      </div>
      <nav class="ms-chrome" aria-label="発表ページの操作">
        <button type="button" class="ms-prev" aria-label="戻る">←</button>
        <p class="ms-caption" role="status" aria-live="polite" aria-atomic="true">
          <span class="ms-page-number"></span><span class="ms-step"></span>
        </p>
        <button type="button" class="ms-next" aria-label="進む">→</button>
      </nav>`;
    host.append(root);
    const find = selector => root.querySelector(selector);
    const stage = find('.ms-stage');
    const frame = find('.ms-frame');
    const canvas = find('.ms-canvas');
    const jump = find('.ms-jump');
    const level = find('.ms-level');
    const full = find('.ms-full');
    const close = find('.ms-close');
    const prevButton = find('.ms-prev');
    const nextButton = find('.ms-next');
    const pageNumber = find('.ms-page-number');
    const stepNumber = find('.ms-step');
    const fullscreenTarget = host instanceof HTMLDialogElement ? document.documentElement : root;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const listeners = new AbortController();

    find('.ms-heading').textContent = title;
    close.hidden = !onClose;
    full.hidden = !fullscreenTarget.requestFullscreen || !document.fullscreenEnabled;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    slides.forEach(({ title }, index) => jump.add(new Option(`${index + 1}. ${title}`, index)));

    let current = -1;
    let stepIndex = 0;
    let steps = [0];
    let gates = [];
    let effectTargets = [];
    let animations = [];
    let playbackRate = 1;
    let fullscreenOwned = false;
    let destroyed = false;

    function activeMotion() {
      return !reduced.matches && level.value !== 'off' && typeof canvas.animate === 'function';
    }

    function cancel() {
      animations.forEach(animation => animation.cancel());
      animations = [];
    }

    function fit() {
      const bounds = stage.getBoundingClientRect();
      const scale = Math.min(bounds.width / width, bounds.height / height);
      frame.style.width = `${width * scale}px`;
      frame.style.height = `${height * scale}px`;
      canvas.style.transform = `scale(${scale})`;
    }

    function state() {
      return { slideIndex: current, stepIndex, stepCount: steps.length - 1,
        motionLevel: level.value, reducedMotion: reduced.matches, animated: activeMotion() };
    }

    function play(element, id, options) {
      for (const animation of MotionEffects.play(element, id,
        { level: level.value, demo: demoTiming, ...options })) {
        animation.updatePlaybackRate(playbackRate);
        animations.push(animation);
      }
    }

    function sharedRects() {
      const elements = canvas.querySelectorAll('[data-ms-shared]');
      return new Map([...elements].map(el => [el.dataset.msShared, el.getBoundingClientRect()]));
    }

    function playScene(id, direction, before) {
      if (id === 'S03') {
        const canvasScale = canvas.getBoundingClientRect().width / width;
        let matched = false;
        for (const element of canvas.querySelectorAll('[data-ms-shared]')) {
          const from = before?.get(element.dataset.msShared);
          const to = element.getBoundingClientRect();
          if (!from?.width || !from.height || !to.width || !to.height || !canvasScale) continue;
          const x = (from.left - to.left) / canvasScale;
          const y = (from.top - to.top) / canvasScale;
          const transform = `translate(${x}px,${y}px) scale(${from.width / to.width},${from.height / to.height})`;
          play(element, 'S03', { from: transform, direction });
          matched = true;
        }
        if (matched) return;
        id = 'S01';
      }
      play(canvas.firstElementChild, id, { direction });
    }

    function render(previous, { intro = false, direction = 0, scene, before, emphasisStep } = {}) {
      cancel();
      const cutoff = steps[stepIndex];
      const animated = activeMotion();
      const stepping = manualSteps || animated;
      for (const [node, wasInert] of gates) {
        const pending = stepping && stepOf(node) > cutoff;
        if (pending && node.contains(document.activeElement)) stage.focus({ preventScroll: true });
        node.toggleAttribute('data-ms-pending', pending);
        node.inert = wasInert || pending;
      }
      if (animated && direction) playScene(scene, direction, before);
      for (const [element, step] of effectTargets) {
        const id = element.dataset.msEffect;
        if (MotionEffects.emphasizes(id)) {
          element.toggleAttribute('data-ms-emphasized',
            !animated || (emphasisStep !== undefined ? step === emphasisStep : step <= cutoff));
        }
        if (animated && step <= cutoff && (intro || step > previous)) play(element, id);
      }
      jump.value = current;
      pageNumber.textContent = `${current + 1} / ${slides.length}`;
      stepNumber.textContent = stepping && steps.length > 1
        ? manualSteps
          ? `${stepIndex === 0 ? 'Enterで表示' : 'Enterで次へ'}（段階 ${stepIndex} / ${steps.length - 1}）`
          : `段階 ${stepIndex} / ${steps.length - 1}`
        : '';
      prevButton.setAttribute('aria-disabled', current === 0 && (!stepping || stepIndex === 0));
      nextButton.setAttribute('aria-disabled',
        current === slides.length - 1 && (!stepping || stepIndex === steps.length - 1));
      onChange?.(state());
    }

    function goTo(index, { final = false, direction = 0, animate = true, emphasisStep } = {}) {
      if (destroyed || !Number.isInteger(index) || index < 0 || index >= slides.length) return;
      cancel();
      const reverseShared = direction < 0 && slides[current]?.transition === 'S03';
      const scene = reverseShared ? 'S03' : slides[index].transition ?? transition;
      const before = direction && scene === 'S03' && activeMotion() ? sharedRects() : null;
      if (stage.contains(document.activeElement)) stage.focus({ preventScroll: true });
      const slide = copySlide(slides[index].element);
      configure?.(slide, index);
      canvas.replaceChildren(slide);
      stage.setAttribute('aria-label', slides[index].title);
      current = index;
      gates = [...slide.querySelectorAll('[data-ms-step]')].filter(stepOf).map(node => [node, node.inert]);
      effectTargets = [...slide.querySelectorAll('[data-ms-effect]')].map(element => {
        let step = effectStep(element);
        for (let parent = element.parentElement; parent && parent !== slide; parent = parent.parentElement) {
          step = Math.max(step, stepOf(parent));
        }
        return [element, step];
      });
      steps = [0, ...[...new Set([...gates.map(([node]) => stepOf(node)), ...effectTargets.map(([, step]) => step)]
        .filter(Boolean))].sort((a, b) => a - b)];
      stepIndex = final ? steps.length - 1 : 0;
      fit();
      render(Infinity, { intro: animate && !final, direction, scene, before, emphasisStep });
    }

    function previewEffect(step, transitionOverride) {
      if (destroyed) return;
      goTo(current, { final: true, emphasisStep: step });
      if (!activeMotion()) return;
      if (transitionOverride?.startsWith('S') && MotionEffects.ids.includes(transitionOverride)) {
        playScene(transitionOverride, 1);
        return;
      }
      for (const [element, at] of effectTargets) {
        if (at === step) play(element, element.dataset.msEffect);
      }
    }

    function setPlaybackRate(rate) {
      if (!Number.isFinite(rate) || rate < .25 || rate > 2) return;
      playbackRate = rate;
      animations.forEach(animation => animation.updatePlaybackRate(rate));
    }

    function next() {
      if ((manualSteps || activeMotion()) && stepIndex < steps.length - 1) {
        const previous = steps[stepIndex++];
        render(previous);
      } else {
        goTo(current + 1, { direction: 1 });
      }
    }

    function previous() {
      if ((manualSteps || activeMotion()) && stepIndex > 0) {
        stepIndex--;
        render(Infinity);
      } else {
        goTo(current - 1, { final: true, direction: -1 });
      }
    }

    function setMotionLevel(value) {
      if (!Object.hasOwn(MotionEffects.levels, value)) return;
      level.value = value;
      render(Infinity);
    }

    function listen(target, event, handler) {
      target.addEventListener(event, handler, { signal: listeners.signal });
    }

    listen(prevButton, 'click', () => {
      prevButton.focus({ preventScroll: true });
      previous();
    });
    listen(nextButton, 'click', () => {
      nextButton.focus({ preventScroll: true });
      next();
    });
    listen(find('.ms-replay'), 'click', () => goTo(current));
    listen(jump, 'change', () => goTo(Number(jump.value)));
    listen(level, 'change', () => setMotionLevel(level.value));
    listen(reduced, 'change', () => render(Infinity));
    listen(close, 'click', () => onClose?.());
    listen(full, 'click', async () => {
      try {
        if (document.fullscreenElement === fullscreenTarget) await document.exitFullscreen();
        else {
          await fullscreenTarget.requestFullscreen();
          fullscreenOwned = true;
          if (destroyed && document.fullscreenElement === fullscreenTarget) await document.exitFullscreen();
        }
      } catch {
        // Some mobile browsers and iframes expose the API but deny the request.
        full.textContent = '全画面を利用できません';
      }
    });
    listen(document, 'fullscreenchange', () => {
      full.textContent = document.fullscreenElement === fullscreenTarget ? '全画面を終了' : '全画面';
      fit();
    });
    const scope = focus ? host : root;
    listen(scope, 'keydown', event => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
          event.shiftKey || event.isComposing ||
          event.target.closest('input, select, textarea, [contenteditable]:not([contenteditable="false"])')) return;
      switch (event.key) {
        case ' ':
          if (event.target.closest('button, a')) return;
          next();
          break;
        case 'Enter':
          if (event.target.closest('button, a')) return;
          next();
          break;
        case 'ArrowRight':
        case 'PageDown':
          next();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          previous();
          break;
        case 'Home':
          goTo(0, { animate: false });
          break;
        case 'End':
          goTo(slides.length - 1, { final: true });
          break;
        default:
          return;
      }
      event.preventDefault();
    });

    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    observer?.observe(stage);
    if (!observer) listen(window, 'resize', fit);
    goTo(0);
    if (focus) nextButton.focus({ preventScroll: true });

    function destroy() {
      destroyed = true;
      cancel();
      listeners.abort();
      observer?.disconnect();
      if (fullscreenOwned && document.fullscreenElement === fullscreenTarget) {
        document.exitFullscreen().catch(() => {});
      }
      root.remove();
    }

    return Object.freeze({ next, previous, goTo, state, setMotionLevel, setPlaybackRate, previewEffect, destroy });
  }

  window.MotionSlides = Object.freeze({ mount });
})();

