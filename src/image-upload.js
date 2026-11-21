(function (global) {
  function bindImageDataUrlInput(inputId, onLoad) {
    const input = global.document.getElementById(inputId);
    if (!input) return;

    input.addEventListener('change', function (event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new global.FileReader();
      reader.onload = function (loadEvent) {
        onLoad(loadEvent.target.result);
      };
      reader.readAsDataURL(file);
    });
  }

  global.bindImageDataUrlInput = bindImageDataUrlInput;
})(window);
