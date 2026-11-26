(function (global) {
  function renderBook(wb) {
    const state = global.workbookState;
    const pendingProject = state.pendingWorkProject;
    const restoredProject = Boolean(pendingProject);
    state.shouldReportMapping = Boolean(state.workbookWasReplaced && !pendingProject);
    if (pendingProject) {
      state.appearanceSettings = pendingProject.appearanceSettings || {};
      global.setBrandingState?.(pendingProject.branding || {});
      global.applyTheme?.(pendingProject.theme || '');
      state.pendingWorkProject = null;
    }
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
    const configuredSheets = new Set();
    const settingsRange = ws0['!ref'] && global.XLSX?.utils?.decode_range
      ? global.XLSX.utils.decode_range(ws0['!ref'])
      : null;
    const lastSettingsRow = Math.max(21, settingsRange ? settingsRange.e.r + 1 : 21);
    for (let r = 5; r <= lastSettingsRow; r++) {
      const sheetName = val(ws0, 'B' + r).trim();
      if (!sheetName || !wb.Sheets[sheetName]) continue;
      configuredSheets.add(sheetName);
      if (val(ws0, 'D' + r).trim() === '出力する') selected.push(sheetName);
    }

    // A continuation action-plan tab may be added without a matching row in
    // the cover's output list. Include it beside the original unless the user
    // explicitly added it to the list and turned output off.
    if (selected.includes('16_行動計画')) {
      const continuations = (wb.SheetNames || Object.keys(wb.Sheets))
        .filter((name) => /^16_行動計画\s*\(\d+\)$/.test(name))
        .sort((a, b) => Number(a.match(/\((\d+)\)$/)[1]) - Number(b.match(/\((\d+)\)$/)[1]));
      let insertAt = selected.indexOf('16_行動計画') + 1;
      for (const sheetName of continuations) {
        if (configuredSheets.has(sheetName)) continue;
        selected.splice(insertAt++, 0, sheetName);
      }
    }

    if (selected.length === 0) {
      global.document.getElementById('statusText').textContent = '出力対象シートが0件です';
      global.alert('「00_出力設定・表紙」シートで「出力する」に設定されているシートがありません。');
      return;
    }

    state.inputValidationResults = global.validateWorkbookInputs(wb, val, selected);
    global.renderInputDiagnostics(state.inputValidationResults);

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
    global.assignAppearanceBlockIds(container);
    global.applyAppearanceSettings(container);
    if (state.shouldReportMapping) global.renderAppearanceTransferNotice();
    state.workbookWasReplaced = false;
    state.shouldReportMapping = false;
    if (restoredProject) global.markWorkFileClean?.();
    if (!state.workbookHasErrors)
      global.document.getElementById('statusText').textContent = state.inputValidationResults.length
        ? `入力確認：${state.inputValidationResults.length} 件・全 ${renderedPages} ページ`
        : `確認OK：全 ${renderedPages} ページ出力対象`;
    global.fitPreviewPages();
    global.updatePrintControls();
  }

  global.renderBook = renderBook;
})(window);
