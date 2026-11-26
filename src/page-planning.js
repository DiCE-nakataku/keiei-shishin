(function (global) {
  function renderThreeYearTargetsPage(worksheet, val, makePage) {
    const activeColumns = ['B', 'C', 'D'].filter((column) => {
      const standard = [5, 6, 7, 8].some((row) => val(worksheet, column + row).trim() !== '');
      const flexible = [9, 10, 11, 12].some(
        (row) => val(worksheet, 'A' + row).trim() || val(worksheet, column + row).trim(),
      );
      return standard || flexible;
    });
    const columns = activeColumns.length ? activeColumns : ['B', 'C', 'D'];
    const labelWidth = 19;
    const dataWidth = ((100 - labelWidth) / columns.length).toFixed(2);
    const colgroup =
      '<colgroup><col style="width:' +
      labelWidth +
      '%;">' +
      columns.map(() => '<col style="width:' + dataWidth + '%;">').join('') +
      '</colgroup>';
    const flexibleRows = [9, 10, 11, 12].filter((row) => {
      const label = val(worksheet, 'A' + row).trim();
      const values = ['B', 'C', 'D'].map((column) => val(worksheet, column + row).trim());
      const defaultLabel = /^自由目標\s*\d+$/.test(label);
      return values.some(Boolean) || (label && !defaultLabel && values.some(Boolean));
    });
    const narratives = columns.map((column) =>
      global.splitTargetNarrative(val(worksheet, column + '8').trim()),
    );
    const pageCount = Math.max(1, ...narratives.map((parts) => parts.length));

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const firstPage = pageIndex === 0;
      let kpis = '';
      if (firstPage) {
        for (const item of [
          { row: 5, label: '目標 売上高', unit: '千円' },
          { row: 6, label: '目標 経常利益', unit: '千円' },
          { row: 7, label: '目標 社員数', unit: '名' },
        ]) {
          kpis +=
            '<tr style="height:9%;"><td class="cat-cell">' +
            item.label +
            '</td>' +
            columns
              .map(
                (column) =>
                  '<td class="num"><span class="kpi-hero-val">' +
                  global.fmtNum(val(worksheet, column + item.row)) +
                  '</span><span class="kpi-unit">' +
                  item.unit +
                  '</span></td>',
              )
              .join('') +
            '</tr>';
        }
        kpis += flexibleRows
          .map(
            (row, index) =>
              '<tr style="height:5.5%;"><td class="cat-cell">' +
              global.fmtCell(val(worksheet, 'A' + row) || '自由目標' + (index + 1)) +
              '<br><span style="font-size:7pt;font-weight:400;">定量目標のみ</span></td>' +
              columns
                .map(
                  (column) =>
                    '<td class="num">' + global.fmtCell(val(worksheet, column + row)) + '</td>',
                )
                .join('') +
              '</tr>',
          )
          .join('');
      }
      const label = firstPage ? '定性目標' : '定性目標（続き）';
      const narrativeHeight = firstPage ? 100 - 27 - flexibleRows.length * 5.5 : 100;
      const narrativeDescription = firstPage
        ? '<br><span style="font-size:7.5pt;font-weight:400;color:var(--ink-sub);">（目指す組織・事業状態）</span>'
        : '';
      const narrativeCells = columns
        .map((column, index) => {
          const text = narratives[index][pageIndex] || '';
          return (
            '<td class="target-narrative" style="' +
            global.targetNarrativeStyle(text) +
            '">' +
            global.fmtCell(text) +
            '</td>'
          );
        })
        .join('');
      const headers = columns
        .map((column) => '<th>' + global.esc(val(worksheet, column + '4')) + '</th>')
        .join('');
      const html =
        '<table class="exec fill-height">' +
        colgroup +
        '<thead><tr><th>目標区分</th>' +
        headers +
        '</tr></thead><tbody>' +
        kpis +
        '<tr style="height:' +
        narrativeHeight +
        '%;"><td class="cat-cell">' +
        label +
        narrativeDescription +
        '</td>' +
        narrativeCells +
        '</tr></tbody></table>';
      const title = firstPage ? '3ヵ年 目標設定シート' : '3ヵ年 目標設定シート（続き）';
      makePage('13 / 3-YEAR TARGETS', title, html);
    }
  }

  function renderActionPlanPage(worksheet, val, makePage, startYearMonth, sheetName = '16_行動計画') {
    const selectedMonth = String(val(worksheet, 'E5') ?? '').match(/(\d{1,2})\s*月/);
    const coverMonth = String(startYearMonth || '').match(/(\d{1,2})\s*月/);
    const parsedMonth = parseInt((selectedMonth || coverMonth || [])[1], 10);
    const baseMonth = parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : 1;
    const policy = val(worksheet, 'F3').trim() || '（未選択）';
    const monthHeaders = Array.from({ length: 9 }, (_, index) => {
      const month = ((baseMonth - 1 + index) % 12) + 1;
      return `<th class="sub action-month" colspan="4">${month}月</th>`;
    }).join('');
    const weekHeaders = Array.from({ length: 36 }, (_, index) => {
      const monthStart = index % 4 === 0 ? ' action-month-start' : '';
      return `<th class="sub action-week${monthStart}">${(index % 4) + 1}W</th>`;
    }).join('');
    const activeRows = [];
    for (let row = 7; row <= 22; row++) {
      if (
        val(worksheet, 'B' + row).trim() ||
        val(worksheet, 'C' + row).trim() ||
        val(worksheet, 'D' + row).trim()
      )
        activeRows.push(row);
    }
    const rows = activeRows.length ? activeRows : [7, 8, 9, 10, 11];
    const tableRows = rows
      .map((row, index) => {
        const weekCells = Array.from({ length: 36 }, (_, weekIndex) => {
          const column = global.XLSX.utils.encode_col(4 + weekIndex);
          const monthStart = weekIndex % 4 === 0 ? ' action-month-start' : '';
          return (
            `<td class="ctr action-week-cell${monthStart}">` +
            global.ganttMark(val(worksheet, column + row)) +
            '</td>'
          );
        }).join('');
        return (
          '<tr><td class="ctr item-cell">' +
          (index + 1) +
          '</td>' +
          '<td class="item-cell action-detail">' + global.fmtCell(val(worksheet, 'B' + row)) + '</td>' +
          '<td class="ctr action-owner">' + global.fmtCell(val(worksheet, 'C' + row)) + '</td>' +
          '<td class="ctr action-owner">' + global.fmtCell(val(worksheet, 'D' + row)) + '</td>' +
          weekCells +
          '</tr>'
        );
      })
      .join('');
    const legend =
      '<div class="gantt-legend">' +
      '<span class="gantt-legend-title">【記号索引】</span>' +
      '<span class="gantt-legend-item"><span class="gantt-dot">●</span> 計画（P）</span>' +
      '<span class="gantt-legend-item"><span class="gantt-arrow">→</span> 実施（D）</span>' +
      '<span class="gantt-legend-item"><span class="gantt-tri">△</span> 評価（C）</span>' +
      '<span class="gantt-legend-item"><span class="gantt-star gantt-star-legend">★</span> 改善（A）</span></div>';
    const widths = [3, 27, 7.5, 7.5, ...Array(36).fill(55 / 36)];
    const columns = '<colgroup>' + widths.map((width) => `<col style="width:${width.toFixed(4)}%;">`).join('') + '</colgroup>';
    const html =
      '<div class="action-plan-topbar"><div class="action-policy"><span>重点経営方針</span><strong>' +
      global.fmtCell(policy) +
      '</strong></div>' +
      legend +
      '</div><table class="exec fill-height action-week-table">' +
      columns +
      '<thead><tr><th rowspan="3">No.</th><th rowspan="3">具体的な行動項目</th>' +
      '<th rowspan="3">責任者</th><th rowspan="3">実務担当者</th>' +
      '<th colspan="24">前期</th><th colspan="12">後期</th></tr><tr>' +
      monthHeaders +
      '</tr><tr>' +
      weekHeaders +
      '</tr></thead><tbody>' +
      tableRows +
      '</tbody></table>';
    const continuation = sheetName === '16_行動計画' ? '' : '・続き';
    makePage('14 / ACTION PLAN', `１ヵ年 行動計画（週次${continuation}）`, html);
  }

  function renderSalesPlanPage(worksheet, val, makePage) {
    const activeRows = [];
    for (let row = 6; row <= 21; row++) {
      if (
        val(worksheet, 'A' + row).trim() ||
        val(worksheet, 'C' + row).trim() ||
        val(worksheet, 'F' + row).trim() ||
        val(worksheet, 'I' + row).trim()
      ) {
        activeRows.push(row);
      }
    }
    const rows = activeRows.length ? activeRows : [6, 7, 8];
    let tableRows = rows
      .map(
        (row) =>
          '<tr><td class="item-cell">' +
          global.fmtCell(val(worksheet, 'A' + row)) +
          '</td><td>' +
          global.fmtCell(val(worksheet, 'B' + row)) +
          '</td>' +
          ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']
            .map(
              (column) =>
                '<td class="num">' + global.fmtNum(val(worksheet, column + row)) + '</td>',
            )
            .join('') +
          '</tr>',
      )
      .join('');
    tableRows +=
      '<tr class="row-summary"><td class="item-cell">合　計</td><td></td>' +
      ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']
        .map(
          (column) => '<td class="num">' + global.fmtNum(val(worksheet, column + '22')) + '</td>',
        )
        .join('') +
      '</tr>';
    const fontSize = rows.length <= 6 ? 'font-size:9pt;line-height:1.55;' : 'font-size:8.3pt;';
    const columnWidths =
      '<colgroup><col style="width:19%;"><col style="width:13.5%;">' +
      '<col style="width:8%;"><col style="width:6.5%;"><col style="width:8%;">' +
      '<col style="width:8%;"><col style="width:6.5%;"><col style="width:8%;">' +
      '<col style="width:8%;"><col style="width:6.5%;"><col style="width:8%;"></colgroup>';
    const periodHeaders = ['C', 'F', 'I']
      .map((column) => '<th colspan="3">' + global.esc(val(worksheet, column + '4')) + '</th>')
      .join('');
    const subHeaders =
      '<th class="sub">目標売上</th><th class="sub">利益率</th><th class="sub">限界利益</th>'.repeat(
        3,
      );
    const html =
      '<table class="exec fill-height" style="' +
      fontSize +
      '">' +
      columnWidths +
      '<thead><tr><th rowspan="2">得意先・事業</th><th rowspan="2">区分・備考</th>' +
      periodHeaders +
      '</tr><tr>' +
      subHeaders +
      '</tr></thead><tbody>' +
      tableRows +
      '</tbody></table>';
    makePage('15 / SALES PLAN', '中期3ヵ年 売上計画（単位：千円）', html);
  }

  global.renderThreeYearTargetsPage = renderThreeYearTargetsPage;
  global.renderActionPlanPage = renderActionPlanPage;
  global.renderSalesPlanPage = renderSalesPlanPage;
})(window);
