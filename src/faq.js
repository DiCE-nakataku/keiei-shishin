(function (global) {
  function toggleFaq(button) {
    const item = button.closest('.faq-item');
    if (!item) return;
    const isOpen = item.classList.toggle('open');
    button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  global.document.querySelectorAll('.faq-trigger').forEach((button) => {
    button.addEventListener('click', () => toggleFaq(button));
  });

  global.toggleFaq = toggleFaq;
})(window);
