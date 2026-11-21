(function (global) {
  function renderBook(wb) {
    const state = global.workbookState;
    state.activeWorkbook = wb;
    state.calculationAdapter = global.FormulaEngine.createCalculationAdapter(wb);
    state.calculationAdapter.calculateAll();
    const val = global.createWorkbookValueReader(
      wb,
      state.calculationAdapter,
      global.FormulaEngine,
      global.XLSX,
    );
    state.formulaResults = global.FormulaEngine.validateWorkbook(wb, state.calculationAdapter);
    state.workbookHasErrors = state.formulaResults.some((result) => result.status === 'error');
    state.workbookCalculating = false;
    global.renderCalculationDiagnostics(state.formulaResults);

    const container = global.document.getElementById('pagesContainer');
    container.innerHTML = '';
    global.document.body.classList.add('has-pages');
    global.scrollTo({ top: 0, behavior: 'smooth' });

    const ws0 = wb.Sheets['00_出力設定・表紙'];
    if (!ws0) {
      global.alert('「00_出力設定・表紙」シートが見つかりません。');
      return;
    }

    const company = val(ws0, 'B24').trim() || '（会社名未入力）';
    const rep = val(ws0, 'B25').trim();
    const rawTerm = val(ws0, 'B26').trim();
    const term = rawTerm.replace(/^第/, '').replace(/期$/, '').trim();
    const startYM = val(ws0, 'B27').trim();
    const endYM = val(ws0, 'B28').trim();
    const pubDate = val(ws0, 'B29').trim();

    // Set document.title so browser PDF export defaults to "対象期数_会社名_経営指針書.pdf"
    const safeTerm = term ? `第${term}期` : '経営指針書';
    const safeCompany = company.replace(/[\\/:*?"<>|]/g, '_');
    global.document.title = `${safeTerm}_${safeCompany}_経営指針書`;

    const selected = [];
    for (let r = 5; r <= 21; r++) {
      if (val(ws0, 'B' + r).trim() && val(ws0, 'D' + r).trim() === '出力する') {
        selected.push(val(ws0, 'B' + r).trim());
      }
    }

    if (selected.length === 0) {
      global.document.getElementById('statusText').textContent = '出力対象シートが0件です';
      global.alert('「00_出力設定・表紙」シートで「出力する」に設定されているシートがありません。');
      return;
    }

    global.document.getElementById('statusText').textContent = state.workbookHasErrors
      ? `要確認：数式エラー ${state.formulaResults.filter((x) => x.status === 'error').length} 件`
      : `確認OK：全 ${selected.length} ページ出力対象`;
    const total = selected.length;
    const makePage = global.createPageFactory({
      document: global.document,
      container,
      company,
      term,
      total,
      escapeHtml: global.esc,
    });

    const renderedPages = global.renderSelectedWorkbookPages({
      selected,
      workbook: wb,
      val,
      makePage,
      container,
      coverData: { company, rep, term, startYM, endYM, pubDate },
    });
    if (!state.workbookHasErrors)
      global.document.getElementById('statusText').textContent =
        `確認OK：全 ${renderedPages} ページ出力対象`;
    global.fitPreviewPages();
    global.updatePrintControls();
  }

  global.renderBook = renderBook;
})(window);
