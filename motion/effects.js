(() => {
  'use strict';

  const easing = 'cubic-bezier(.22,1,.36,1)';
  const fade = [{ opacity: 0 }, { opacity: 1 }];
  const move = (from, to, opacity = false) => [
    { transform: from, ...(opacity ? { opacity: 0 } : {}) },
    { transform: to, ...(opacity ? { opacity: 1 } : {}) },
  ];
  const rise = move('translateY(18px)', 'translateY(0)', true);
  const growX = move('scaleX(0)', 'scaleX(1)');
  const wipe = [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }];
  const mask = [{ clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0 0 0 0)' }];
  const focus = [
    { opacity: 0, transform: 'scale(.87)' },
    { opacity: 1, transform: 'scale(1)' },
  ];
  // The player sets the durable emphasis state before starting this interpolation.
  const accent = element => {
    const style = getComputedStyle(element);
    return [
      { backgroundColor: style.getPropertyValue('--ms-unemphasized').trim() || 'transparent',
        boxShadow: 'inset 0 0 0 transparent' },
      { backgroundColor: style.backgroundColor, boxShadow: style.boxShadow },
    ];
  };
  const stroke = element => {
    const length = element.getTotalLength?.();
    return length > 0
      ? [{ strokeDasharray: length, strokeDashoffset: length },
         { strokeDasharray: length, strokeDashoffset: 0 }]
      : fade;
  };

  const effects = new Map();
  function define(id, name, duration, frames, { children, stagger = 0, origin, fallback } = {}) {
    effects.set(id, { name, duration, frames, children, stagger, origin, fallback });
  }

  define('G01', 'フェード', 360, fade);
  define('G02', '下からフェード', 420, rise);
  define('T01', 'フェード＆ライズ', 360, rise);
  define('T02', '行ごとのマスク表示', 520, mask,
    { children: '[data-ms-mask-line]', fallback: true, stagger: 240 });
  define('T06', '文字の下に強調帯', 560, growX, { children: '[data-ms-highlight]', origin: 'left' });
  define('I01', 'パーツの組み立て', 460, focus, { children: '[data-ms-part]', stagger: 75 });
  define('I02', 'SVGの輪郭描画', 680, stroke, { children: '[data-ms-stroke]' });
  define('I05', '原因から結果を順に表示', 380, rise, { children: '[data-ms-node]', stagger: 135 });
  define('P01', '写真のクロスフェード', 600, element =>
    [{ opacity: 0 }, { opacity: getComputedStyle(element).opacity }]);
  define('P02', '方向付きワイプ', 580, wipe);
  define('P08', '注釈で見る場所を示す', 500, focus, { children: '[data-ms-annotation]' });
  define('C01', 'ゼロ起点から棒を伸ばす', 610, move('scaleY(0)', 'scaleY(1)'),
    { children: '[data-ms-bar]', stagger: 52, origin: 'bottom' });
  define('C02', '折れ線を描く', 650, stroke, { children: '[data-ms-stroke]' });
  define('C09', '比較の基準線を表示', 530, wipe, { children: '[data-ms-benchmark]' });
  define('L01', '見出しの下線を伸ばす', 420, growX, { origin: 'left' });
  define('L03', '接続線を描く', 560, stroke, { children: '[data-ms-stroke]' });
  define('L08', '現在地点まで線を伸ばす', 610, growX,
    { children: '[data-ms-progress]', origin: 'left' });
  define('B01', '行の順次表示', 290, fade, { children: 'tbody tr', stagger: 65 });
  define('B03', '推奨の列を強調', 550, accent, { children: '[data-ms-recommended]' });
  define('B07', '差分セルを強調', 660, accent, { children: '[data-ms-delta]' });
  define('S01', '場面をフェード', 230, [{ opacity: .55 }, { opacity: 1 }]);
  define('S02', '方向付きの場面転換', 340, (_, direction, _from, demo) =>
    move(`translateX(${direction * (demo ? 64 : 24)}px)`, 'translateX(0)', true));
  define('S03', '同じ要素を全体から詳細へ', 900,
    (_, direction, from) => from ? move(from, 'none') : fade, { origin: 'top left' });
  define('S08', '即時切替', 0, []);

  // Showcase timing prioritizes seeing intermediate states; normal slides retain their timing.
  const steady = 'cubic-bezier(.4,0,.6,1)';
  const demoTiming = {
    T01: [720, 0], T02: [980, 360, steady], T06: [920, 0, steady],
    I01: [680, 210], I02: [1050, 125, 'linear'], I05: [630, 370],
    P01: [1550, 0, 'linear'], P02: [1250, 0, steady], P08: [930, 0],
    C01: [950, 125, steady], C02: [1450, 0, 'linear'], C09: [1060, 0, steady],
    L01: [860, 0, steady], L03: [1140, 0, 'linear'], L08: [1180, 0, steady],
    B01: [670, 290], B03: [950, 0, steady], B07: [1150, 0, steady],
    S01: [660, 0, steady], S02: [880, 0, steady], S03: [1220, 0, steady],
  };

  const levels = Object.freeze({ fast: .7, standard: 1, slow: 1.4, off: 0 });

  function milliseconds(raw, fallback) {
    if (raw === undefined || raw === '') return fallback;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? Math.min(2000, value) : fallback;
  }

  function validEasing(value, fallback) {
    if (!value) return fallback;
    try {
      return new KeyframeEffect(null, [], { easing: value }).getTiming().easing;
    } catch {
      return fallback;
    }
  }

  function play(element, id, { level, direction = 1, demo = false, from } = {}) {
    const effect = effects.get(id);
    const speed = levels[level] ?? 1;
    if (!effect || !effect.duration || !speed || typeof element.animate !== 'function') return [];
    const spec = element.dataset;
    const [baseDuration, baseStagger, baseEasing = easing] =
      (demo && demoTiming[id]) || [effect.duration, effect.stagger];
    const duration = Math.round(milliseconds(spec.msDuration, baseDuration) * speed);
    if (!duration) return [];
    const delay = milliseconds(spec.msDelay, 0);
    const stagger = milliseconds(spec.msStagger, baseStagger);
    const curve = validEasing(spec.msEasing, baseEasing);
    const children = effect.children ? [...element.querySelectorAll(effect.children)] : [];
    const targets = !effect.children || (effect.fallback && !children.length) ? [element] : children;
    return targets.map((target, index) => {
      const frames = typeof effect.frames === 'function' ? effect.frames(target, direction, from, demo) : effect.frames;
      const targetDuration = target === element ? duration
        : Math.round(milliseconds(target.dataset.msDuration, duration / speed) * speed);
      const keyframes = effect.origin ? frames.map(frame => ({ ...frame, transformOrigin: effect.origin })) : frames;
      return target.animate(keyframes, {
        duration: targetDuration, delay: (delay + index * stagger) * speed, easing: curve, fill: 'backwards',
      });
    });
  }

  window.MotionEffects = Object.freeze({
    levels, play,
    emphasizes: id => id === 'T06' || id === 'B03' || id === 'B07',
    ids: Object.freeze([...effects.keys()]),
    name: id => effects.get(id)?.name,
  });
})();

