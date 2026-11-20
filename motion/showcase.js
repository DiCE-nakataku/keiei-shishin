(() => {
  'use strict';

  const root = document.getElementById('showcase');
  const select = document.getElementById('demoEffect');
  const tryEffect = document.getElementById('demoTry');
  const speed = document.getElementById('demoSpeed');
  const transitions = ['S01', 'S02', 'S08', 'S03'];
  const slides = [...document.querySelectorAll('#demoSource > .demo-slide')].map(element => ({
    element, title: element.dataset.title, transition: element.dataset.transition,
  }));
  let activeSlide = -1;

  const player = MotionSlides.mount(document.getElementById('demoPlayer'), {
    slides, width: 1280, height: 720, demoTiming: true, title: 'モーションの実演',
    onChange({ slideIndex, animated }) {
      if (slideIndex !== activeSlide) {
        activeSlide = slideIndex;
        const examples = [...slides[slideIndex].element.querySelectorAll('[data-example]')];
        const ids = examples.map(element => element.dataset.example);
        if (slides[slideIndex].title === '場面転換') ids.push(...transitions);
        select.replaceChildren(...ids.map((id, i) => new Option(`${id} · ${MotionEffects.name(id)}`, i + 1)));
        if (!ids.length) select.add(new Option('演出を選択', ''));
      }
      select.disabled = !animated || !select.value;
      tryEffect.disabled = select.disabled;
      speed.disabled = !animated;
    },
  });
  if (!player) return;
  root.classList.add('ready');

  document.getElementById('demoTheme').addEventListener('change', event => {
    root.dataset.theme = event.target.value;
  });
  speed.addEventListener('change', () => player.setPlaybackRate(Number(speed.value)));
  tryEffect.addEventListener('click', () => {
    const step = Number(select.value);
    const { slideIndex } = player.state();
    const transition = slides[slideIndex].title === '場面転換' ? transitions[step - 1] : undefined;
    if (transition === 'S03') player.next();
    else player.previewEffect(step, transition);
  });
  document.getElementById('demoPrint').addEventListener('click', () => window.print());
})();

