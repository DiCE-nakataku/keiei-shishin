(function (global) {
  const previewContainer = global.document.getElementById('pagesContainer');

  function fitPreviewPages() {
    const slot = previewContainer.firstElementChild;
    if (!slot) return;
    const width = slot.firstElementChild.offsetWidth;
    if (width) {
      previewContainer.style.setProperty('--preview-scale', Math.min(1, slot.clientWidth / width));
    }
  }

  function clearPrintGuidance() {
    global.document.getElementById('printPdfStatus').textContent = '';
  }

  if (typeof global.ResizeObserver === 'function') {
    new global.ResizeObserver(fitPreviewPages).observe(previewContainer);
  } else {
    global.addEventListener('resize', fitPreviewPages);
  }

  global.fitPreviewPages = fitPreviewPages;
  global.clearPrintGuidance = clearPrintGuidance;
})(window);
