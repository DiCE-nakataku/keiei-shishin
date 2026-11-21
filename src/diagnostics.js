(function (global) {
  function renderCalculationDiagnostics(results) {
    const errors = results.filter((result) => result.status === 'error');
    const blanks = results.filter((result) => result.status === 'intentional-blank').length;
    const diagnostics = global.document.getElementById('calcDiagnostics');
    diagnostics.hidden = false;
    if (errors.length === 0) {
      diagnostics.innerHTML = `<div class="calc-ok">計算確認OK：数式 ${results.length} 件（正常な空欄 ${blanks} 件）</div>`;
      return;
    }
    diagnostics.innerHTML = `<div class="calc-error"><strong>要確認：${errors.length} 件の数式エラーがあり、PDF出力を無効にしました。</strong><ul>${errors
      .map(
        (error) =>
          `<li>${global.esc(error.sheet)}!${global.esc(error.cell)}　${global.esc(error.formula)}　${global.esc(error.message || error.value?.__formulaError?.message || '計算エラー')}</li>`,
      )
      .join('')}</ul></div>`;
  }

  global.renderCalculationDiagnostics = renderCalculationDiagnostics;
})(window);
