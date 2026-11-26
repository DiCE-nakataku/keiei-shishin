(function (global) {
  const pageDefinitions = {
    macro: {
      startRow: 5,
      endRow: 22,
      section: '04 / MACRO ENVIRONMENT',
      title: '外部環境の分析（マクロ環境）',
      widths: [12, 16, 58, 14],
      forecast: '3年後の予測（世の中の動向）',
    },
    micro: {
      startRow: 5,
      endRow: 22,
      section: '05 / MICRO ENVIRONMENT',
      title: '外部環境の分析（ミクロ環境）',
      widths: [12, 16, 58, 14],
      forecast: '3年後の予測（業界・顧客・競合）',
    },
  };

  function renderExternalEnvironmentPage(worksheet, val, makePage, type) {
    const definition = pageDefinitions[type];
    if (!definition) return;
    const rows = [];
    for (let row = definition.startRow; row <= definition.endRow; row++) {
      const category = val(worksheet, `A${row}`).replace(/[【】]/g, '');
      const item = val(worksheet, `B${row}`).replace(/^●\s*/, '');
      const prediction = val(worksheet, `C${row}`).trim();
      const impact = val(worksheet, `D${row}`).trim();
      rows.push({
        cat: category,
        hasData: Boolean(prediction || impact),
        cellsHTML: `<td class="item-cell">${global.esc(item)}</td><td>${global.fmtCell(prediction)}</td><td class="ctr">${global.impactBadge(impact)}</td>`,
      });
    }
    const colgroup = `<colgroup>${definition.widths.map((width) => `<col style="width:${width}%;">`).join('')}</colgroup>`;
    const thead = `<thead><tr><th>大分類</th><th>分析項目</th><th>${definition.forecast}</th><th>自社への影響</th></tr></thead>`;
    makePage(
      definition.section,
      definition.title,
      global.buildDynamicCatTable(rows, colgroup, thead),
    );
  }

  global.renderExternalEnvironmentPage = renderExternalEnvironmentPage;
})(window);
