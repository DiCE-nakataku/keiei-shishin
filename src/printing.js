(function (global) {
  function canExportPages() {
    return (
      global.document.getElementById('pagesContainer').childElementCount > 0 &&
      global.FormulaEngine.canPrint({
        hasWorkbook: Boolean(global.workbookState.activeWorkbook),
        calculating: global.workbookState.workbookCalculating,
        hasErrors: global.workbookState.workbookHasErrors,
      })
    );
  }

  function updatePrintControls() {
    const allowed = canExportPages();
    global.document.getElementById('printButton').disabled = !allowed;
    global.document.getElementById('presentationButton').disabled = !allowed;
    global.document.getElementById('fixedPdfButton').disabled = !allowed;
    const adjustmentButton = global.document.getElementById('adjustmentModeButton');
    const saveButton = global.document.getElementById('saveWorkFileButton');
    if (adjustmentButton) adjustmentButton.disabled = !allowed;
    if (saveButton) saveButton.disabled = !global.workbookState.sourceWorkbookBytes;
  }

  function configurePrintButtonVisibility() {
    const navigator = global.navigator;
    const iosDevice =
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const nativePrintButton = global.document.getElementById('printButton');
    const fixedPdfButton = global.document.getElementById('fixedPdfButton');
    nativePrintButton.hidden = iosDevice;
    fixedPdfButton.hidden = !iosDevice;
  }

  function safePrint() {
    if (!canExportPages()) {
      global.alert(
        global.workbookState.workbookCalculating
          ? '計算中です。完了後に印刷してください。'
          : '数式エラーまたは未検証のためPDF出力を停止しました。エラー一覧を確認してください。',
      );
      return;
    }
    global.document.getElementById('printPdfStatus').textContent =
      '印刷画面で「PDFに保存」を選択してください。文字を選択・検索・コピーできるPDFで保存されます。';
    global.print();
  }

  global.document.getElementById('printButton')?.addEventListener('click', safePrint);
  global.document.getElementById('fixedPdfButton')?.addEventListener('click', safePrint);

  global.addEventListener('beforeprint', () => {
    if (!canExportPages()) {
      global.document.body.classList.add('print-blocked');
      global.document.getElementById('printBlockedNotice').style.display = 'block';
      // Browser UI / Ctrl+P may not be cancellable; ensure the printed pages contain only a stop notice.
    }
  });
  global.addEventListener('afterprint', () => {
    global.document.body.classList.remove('print-blocked');
    global.document.getElementById('printBlockedNotice').style.display = 'none';
  });

  global.canExportPages = canExportPages;
  global.updatePrintControls = updatePrintControls;
  global.configurePrintButtonVisibility = configurePrintButtonVisibility;
  global.safePrint = safePrint;
})(window);
