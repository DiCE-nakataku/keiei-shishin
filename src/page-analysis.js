(function (global) {
  function renderInternalAnalysisPage(worksheet, val, makePage) {
    const rows = [];
    for (let row = 5; row <= 32; row++) {
      const category = val(worksheet, `A${row}`)
        .split('\n')[0]
        .replace(/[【】]/g, '');
      const item = val(worksheet, `B${row}`).replace(/^●\s*/, '');
      const strength = val(worksheet, `C${row}`).trim();
      const weakness = val(worksheet, `D${row}`).trim();
      rows.push({
        cat: category,
        hasData: Boolean(strength || weakness),
        cellsHTML: `<td class="item-cell">${global.esc(item)}</td><td>${global.fmtCell(strength)}</td><td>${global.fmtCell(weakness)}</td>`,
      });
    }
    makePage(
      '06 / INTERNAL ANALYSIS',
      '内部環境の分析（自社の強み・弱み）',
      global.buildDynamicCatTable(
        rows,
        '<colgroup><col style="width:12%;"><col style="width:16%;"><col style="width:36%;"><col style="width:36%;"></colgroup>',
        '<thead><tr><th>経営資源</th><th>評価項目</th><th>自社の強み（Strength）</th><th>自社の弱み（Weakness）</th></tr></thead>',
      ),
    );
  }

  function renderCrossSwotPage(worksheet, val, makePage) {
    const cards = [];
    for (let row = 5; row <= 8; row++) {
      const raw = val(worksheet, `C${row}`).trim();
      const body = raw.replace(/^【[EFGH]：[^】]+】\s*$/, '');
      cards.push({
        title: `${val(worksheet, `A${row}`).replace(/\n/g, ' ')} × ${val(worksheet, `B${row}`)}`,
        body,
      });
    }
    makePage(
      '07 / CROSS SWOT',
      '経営課題洗出しシート（クロスSWOT分析）',
      global.buildDynamicCardGrid(cards, '（対策未記入）'),
    );
  }

  global.renderInternalAnalysisPage = renderInternalAnalysisPage;
  global.renderCrossSwotPage = renderCrossSwotPage;
})(window);
