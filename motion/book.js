(() => {
  'use strict';

  const button = document.getElementById('presentationButton');
  const dialog = document.getElementById('presentationDialog');
  if (!window.MotionSlides || !window.MotionPresets || typeof dialog.showModal !== 'function') return;

  button.hidden = false;
  button.addEventListener('click', () => {
    const slides = [...document.querySelectorAll('#pagesContainer .page-slot > .page')].map(element => ({
      element,
      title: element.querySelector('.page-title, .cover-title')?.textContent.trim() || '経営指針書',
    }));
    if (!slides.length) return;
    const { offsetWidth: width, offsetHeight: height } = slides[0].element;
    if (!width || !height) return;

    dialog.showModal();
    const hasAppearanceMotion = (element) =>
      element.matches('[data-appearance-motion]') ||
      Boolean(element.querySelector('[data-appearance-motion]'));
    const setDefaultEffect = (element, effect) => {
      if (!hasAppearanceMotion(element)) MotionPresets.setEffect(element, effect);
    };
    const player = MotionSlides.mount(dialog, {
      slides, width, height, transition: 'S08', focus: true,
      manualSteps: true,
      onClose: () => dialog.close(),
      configure(slide) {
        const heading = slide.querySelector('.page-title, .cover-title');
        if (heading) {
          const [effect] = MotionPresets.recommend({ kind: 'text', purpose: 'explain' });
          setDefaultEffect(heading, effect);
        }
        const body = slide.querySelector('.page-body');
        if (body) {
          body.dataset.msStep = '1';
          const tables = [...body.querySelectorAll('table.exec')];
          for (const table of tables) {
            setDefaultEffect(table, 'B01');
          }
          const rows = body.querySelectorAll('table.exec tbody tr');
          if (!tables.length && rows.length) {
            const table = rows[0].closest('table');
            if (table) setDefaultEffect(table, 'B01');
          }
          const highlights = body.querySelectorAll('.vision-highlight, .strategy-card');
          highlights.forEach((item, index) => {
            item.dataset.msDelay = String(index * 90);
            if (!hasAppearanceMotion(item)) item.dataset.msEffect = 'T01';
          });
        }
        const image = slide.querySelector('.page-body img');
        if (image) {
          const [effect] = MotionPresets.recommend({ kind: 'image', purpose: 'compare' });
          setDefaultEffect(image, effect);
          image.dataset.msDelay = '120';
        }
      },
    });
    dialog.addEventListener('close', () => {
      player.destroy();
      button.focus({ preventScroll: true });
    }, { once: true });
  });
})();
