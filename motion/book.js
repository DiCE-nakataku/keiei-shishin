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
    const player = MotionSlides.mount(dialog, {
      slides, width, height, transition: 'S08', focus: true,
      onClose: () => dialog.close(),
      configure(slide) {
        const heading = slide.querySelector('.page-title, .cover-title');
        if (heading) {
          const [effect] = MotionPresets.recommend({ kind: 'text', purpose: 'explain' });
          MotionPresets.setEffect(heading, effect);
        }
        const image = slide.querySelector('.page-body img');
        if (image) {
          const [effect] = MotionPresets.recommend({ kind: 'image', purpose: 'compare' });
          MotionPresets.setEffect(image, effect);
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
