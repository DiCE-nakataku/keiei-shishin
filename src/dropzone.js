(function (global) {
  function initDropzone() {
    const dropzone = global.document.getElementById('landingDropzone');
    const fileInput = global.document.getElementById('excelInput');
    if (!dropzone || !fileInput) return;

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropzone.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropzone.classList.remove('drag-over');
      });
    });
    dropzone.addEventListener('drop', (event) => {
      const files = event.dataTransfer && event.dataTransfer.files;
      if (files && files.length > 0) {
        global.handleExcelFile(files[0]);
      }
    });
    dropzone.addEventListener('click', (event) => {
      if (event.target.closest('button, label, a')) return;
      fileInput.click();
    });
  }

  initDropzone();
})(window);
