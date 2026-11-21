(function (global) {
  function applyTheme(themeVal) {
    global.clearPrintGuidance();
    global.document.body.classList.remove('theme-green', 'theme-slate');
    if (themeVal) global.document.body.classList.add(themeVal);

    const select = global.document.getElementById('toolbarThemeSelect');
    if (select && select.value !== themeVal) select.value = themeVal;

    global.document.querySelectorAll('.theme-pill-btn').forEach((button) => {
      button.classList.toggle('active', (button.dataset.theme || '') === themeVal);
    });
  }

  const toolbar = global.document.getElementById('toolbarThemeSelect');
  toolbar?.addEventListener('change', () => applyTheme(toolbar.value));
  global.document.querySelectorAll('.theme-pill-btn').forEach((button) => {
    button.addEventListener('click', () => applyTheme(button.dataset.theme || ''));
  });

  global.applyTheme = applyTheme;
})(window);
