(function (global) {
  function buildDynamicCatTable(rows, colgroupHTML, theadHTML, tableStyle = '') {
    const active = rows.filter((row) => row.hasData);
    const displayRows = active.length > 0 ? active : rows.slice(0, 4);
    const counts = {};
    displayRows.forEach((row) => {
      counts[row.cat] = (counts[row.cat] || 0) + 1;
    });
    const rendered = {};
    let tableRows = '';
    displayRows.forEach((row) => {
      const first = !rendered[row.cat];
      rendered[row.cat] = true;
      tableRows += `<tr>
      ${first ? `<td rowspan="${counts[row.cat]}" class="cat-cell">${global.esc(row.cat)}</td>` : ''}
      ${row.cellsHTML}
    </tr>`;
    });
    let autoFont = '';
    if (displayRows.length <= 6) {
      autoFont = 'font-size:9.5pt;line-height:1.6;';
    } else if (displayRows.length <= 10) {
      autoFont = 'font-size:9pt;line-height:1.5;';
    } else if (displayRows.length <= 15) {
      autoFont = 'font-size:8.1pt;line-height:1.35;';
    } else {
      autoFont = 'font-size:7.3pt;line-height:1.22;';
    }
    return `<table class="exec fill-height" style="${autoFont}${tableStyle}">${colgroupHTML}${theadHTML}<tbody>${tableRows}</tbody></table>`;
  }

  function buildDynamicCardGrid(cards, emptyFallbackText = '（未入力）') {
    const active = cards.filter((card) => card.body.trim() !== '');
    const list = active.length > 0 ? active : cards;
    const cols = list.length === 1 ? 'cols-1' : 'cols-2';
    const rows = list.length <= 2 ? 'rows-1' : 'rows-2';
    const bodyFont =
      list.length <= 2 ? 'font-size:10.5pt;line-height:1.75;' : 'font-size:9.2pt;line-height:1.58;';
    const itemsHTML = list
      .map(
        (card, index) => `
      <div class="panel-card ${index % 2 === 1 ? 'accent-top' : ''}">
        <div class="panel-head">${global.esc(card.title)}</div>
        <div class="panel-body" style="${bodyFont}">${global.fmtCell(card.body, emptyFallbackText)}</div>
      </div>
    `,
      )
      .join('');
    return `<div class="dynamic-grid ${cols} ${rows}">${itemsHTML}</div>`;
  }

  global.buildDynamicCatTable = buildDynamicCatTable;
  global.buildDynamicCardGrid = buildDynamicCardGrid;
})(window);
