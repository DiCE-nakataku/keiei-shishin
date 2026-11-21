(function (global) {
  function renderVariableProfitPage(worksheet, val, makePage) {
    const periods = [
      { start: 2, title: val(worksheet, 'B5') },
      { start: 5, title: val(worksheet, 'E5') },
      { start: 8, title: val(worksheet, 'H5') },
    ];
    const active = periods.filter((period) => {
      const column = global.XLSX.utils.encode_col(period.start - 1);
      return val(worksheet, column + '25').trim() !== '';
    });
    const blocks = active.length ? active : periods;
    let tableRows = '';
    for (let row = 25; row <= 30; row++) {
      const summary = row === 27 || row === 29 || row === 30;
      let cells = '';
      blocks.forEach((block) => {
        const amount = global.XLSX.utils.encode_col(block.start - 1);
        const ratio = global.XLSX.utils.encode_col(block.start);
        const change = global.XLSX.utils.encode_col(block.start + 1);
        cells +=
          '<td class="num">' +
          global.fmtNum(val(worksheet, amount + row)) +
          '</td>' +
          '<td class="num">' +
          global.fmtNum(val(worksheet, ratio + row)) +
          '</td>' +
          '<td class="num">' +
          global.fmtNum(val(worksheet, change + row)) +
          '</td>';
      });
      tableRows +=
        '<tr class="' +
        (summary ? 'row-summary' : '') +
        '">' +
        '<td class="item-cell">' +
        global.esc(val(worksheet, 'A' + row)) +
        '</td>' +
        cells +
        '</tr>';
    }
    const itemWidth = blocks.length === 1 ? 34 : blocks.length === 2 ? 26 : 22;
    const remainingWidth = (100 - itemWidth) / blocks.length;
    let columns = '<col style="width:' + itemWidth + '%;">';
    let topHeaders = '<th rowspan="2">項目</th>';
    let subHeaders = '';
    blocks.forEach((block) => {
      columns +=
        '<col style="width:' +
        (remainingWidth * 0.38).toFixed(1) +
        '%;">' +
        '<col style="width:' +
        (remainingWidth * 0.28).toFixed(1) +
        '%;">' +
        '<col style="width:' +
        (remainingWidth * 0.34).toFixed(1) +
        '%;">';
      topHeaders += '<th colspan="3">' + global.esc(block.title) + '</th>';
      subHeaders +=
        '<th class="sub">金額</th><th class="sub">構成比</th><th class="sub">前年差</th>';
    });
    makePage(
      '10 / VARIABLE P&L',
      '過去3期 変動損益計算書（単位：千円）',
      '<table class="exec fill-height" style="font-size:9.2pt;"><colgroup>' +
        columns +
        '</colgroup><thead><tr>' +
        topHeaders +
        '</tr><tr>' +
        subHeaders +
        '</tr></thead><tbody>' +
        tableRows +
        '</tbody></table>',
    );
  }

  function renderProfitSimulationPage(worksheet, val, makePage) {
    const activeColumns = ['C', 'D', 'E', 'F', 'G', 'H'].filter((column) =>
      [5, 6, 7].some((row) => val(worksheet, column + row).trim() !== ''),
    );
    const shownColumns = ['B'].concat(activeColumns.length ? activeColumns : ['C', 'D', 'E']);
    const itemWidth = 30;
    const columnWidth = ((100 - itemWidth) / shownColumns.length).toFixed(2);
    const columns =
      '<colgroup><col style="width:' +
      itemWidth +
      '%;">' +
      shownColumns.map(() => '<col style="width:' + columnWidth + '%;">').join('') +
      '</colgroup>';
    const header =
      '<thead><tr><th>項目</th>' +
      shownColumns
        .map((column) => '<th>' + global.esc(val(worksheet, column + '4')) + '</th>')
        .join('') +
      '</tr></thead>';
    let tableRows = '';
    for (let row = 5; row <= 20; row++) {
      if (row === 8) continue;
      const rowClass =
        row === 19 || row === 20
          ? 'row-summary'
          : row === 9 || row === 11 || row === 14
            ? 'row-bold'
            : '';
      tableRows +=
        '<tr class="' +
        rowClass +
        '"><td class="item-cell">' +
        global.esc(val(worksheet, 'A' + row)) +
        '</td>' +
        shownColumns
          .map(
            (column) => '<td class="num">' + global.fmtNum(val(worksheet, column + row)) + '</td>',
          )
          .join('') +
        '</tr>';
    }
    makePage(
      '11 / PROFIT SIMULATION',
      '利益・資金計画検討表①（単位：千円）',
      '<table class="exec fill-height" style="font-size:8.2pt;line-height:1.28;">' +
        columns +
        header +
        '<tbody>' +
        tableRows +
        '</tbody></table>',
    );
  }

  function renderMidtermFinancialPlanPage(worksheet, val, makePage) {
    let tableRows = '';
    for (let row = 6; row <= 23; row++) {
      const rowClass =
        row === 6 || row === 17 ? 'row-summary' : row === 8 || row === 12 ? 'row-bold' : '';
      let cells = '<td class="item-cell">' + global.esc(val(worksheet, 'A' + row)) + '</td>';
      for (const column of ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']) {
        cells += '<td class="num">' + global.fmtNum(val(worksheet, column + row)) + '</td>';
      }
      tableRows += '<tr class="' + rowClass + '">' + cells + '</tr>';
    }
    const memo = val(worksheet, 'B24').trim();
    const memoHtml = memo
      ? '<div style="margin-top:5px;padding:5px 10px;background:var(--surface-sub);border:0.5pt solid var(--line);border-left:3pt solid var(--primary);border-radius:4px;font-size:7.3pt;line-height:1.38;white-space:pre-wrap;">' +
        '<strong style="color:var(--primary);">【検討事項メモ】</strong> ' +
        global.esc(memo.replace(/\n+/g, '　')) +
        '</div>'
      : '';
    const tableFont = memo
      ? 'font-size:7.2pt;line-height:1.12;'
      : 'font-size:7.6pt;line-height:1.18;';
    const headers = ['B', 'D', 'F', 'H']
      .map((column) => '<th colspan="2">' + global.esc(val(worksheet, column + '4')) + '</th>')
      .join('');
    makePage(
      '12 / MID-TERM FINANCIAL PLAN',
      '中期3ヵ年 利益・資金計画（単位：千円）',
      '<table class="exec fill-height" style="' +
        tableFont +
        '">' +
        '<colgroup><col style="width:28%;"><col style="width:11%;"><col style="width:7%;">' +
        '<col style="width:11%;"><col style="width:7%;"><col style="width:11%;"><col style="width:7%;">' +
        '<col style="width:11%;"><col style="width:7%;"></colgroup>' +
        '<thead><tr><th rowspan="2">項目</th>' +
        headers +
        '</tr>' +
        '<tr><th class="sub">金額</th><th class="sub">比率</th><th class="sub">金額</th><th class="sub">比率</th>' +
        '<th class="sub">金額</th><th class="sub">比率</th><th class="sub">金額</th><th class="sub">比率</th></tr></thead>' +
        '<tbody>' +
        tableRows +
        '</tbody></table>' +
        memoHtml,
    );
  }

  global.renderVariableProfitPage = renderVariableProfitPage;
  global.renderProfitSimulationPage = renderProfitSimulationPage;
  global.renderMidtermFinancialPlanPage = renderMidtermFinancialPlanPage;
})(window);
