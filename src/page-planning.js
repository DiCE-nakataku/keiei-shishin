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

  function renderActionPlanPage(worksheet, val, makePage, startYearMonth) {
    const monthMatch = startYearMonth.match(/(\d{1,2})\s*月/);
    const baseMonth = monthMatch ? parseInt(monthMatch[1], 10) : null;
    let monthHeaders = '';
    for (let month = 1; month <= 12; month++) {
      const column = global.XLSX.utils.encode_col(4 + month);
      const raw = val(worksheet, column + '5');
      const match = raw.match(/\(([^)]+)\)/);
      let label = match && match[1].trim() !== '月' ? match[1].trim() : '';
      if (!label) {
        label =
          baseMonth && baseMonth >= 1 && baseMonth <= 12
            ? ((baseMonth - 1 + month - 1) % 12) + 1 + '月'
            : month + '月';
      }
      monthHeaders +=
        '<th class="sub" style="padding:3px 1px;font-size:7.5pt;">' + global.esc(label) + '</th>';
    }
    const activeRows = [];
    for (let row = 6; row <= 21; row++) {
      if (val(worksheet, 'B' + row).trim() || val(worksheet, 'C' + row).trim())
        activeRows.push(row);
    }
    const rows = activeRows.length ? activeRows : [6, 7, 8, 9, 10];
    const tableRows = rows
      .map((row, index) => {
        let monthCells = '';
        for (let columnIndex = 6; columnIndex <= 17; columnIndex++) {
          const column = global.XLSX.utils.encode_col(columnIndex - 1);
          monthCells +=
            '<td class="ctr" style="padding:2px;">' +
            global.ganttMark(val(worksheet, column + row)) +
            '</td>';
        }
        return (
          '<tr><td class="ctr item-cell">' +
          (index + 1) +
          '</td>' +
          '<td class="item-cell">' +
          global.fmtCell(val(worksheet, 'B' + row)) +
          '</td>' +
          '<td>' +
          global.fmtCell(val(worksheet, 'C' + row)) +
          '</td>' +
          '<td class="ctr">' +
          global.fmtCell(val(worksheet, 'D' + row)) +
          '</td>' +
          '<td class="ctr">' +
          global.fmtCell(val(worksheet, 'E' + row)) +
          '</td>' +
          monthCells +
          '</tr>'
        );
      })
      .join('');
    const fontSize = rows.length <= 7 ? 'font-size:8.6pt;line-height:1.5;' : 'font-size:8pt;';
    const legend =
      '<div class="gantt-legend">' +
      '<span class="gantt-legend-title">【記号索引】</span>' +
      '<span class="gantt-legend-item"><span class="gantt-dot">●</span> 計画・実施</span>' +
      '<span class="gantt-legend-item"><span class="gantt-arrow">→</span> 進行中</span>' +
      '<span class="gantt-legend-item"><span class="gantt-star">★</span> 完了</span>' +
      '<span class="gantt-legend-item"><span class="gantt-tri">△</span> 継続</span></div>';
    const widths =
      '<colgroup><col style="width:3.5%;"><col style="width:17.5%;">' +
      '<col style="width:31%;"><col style="width:7%;"><col style="width:7%;">' +
      '<col style="width:2.83%;"><col style="width:2.83%;"><col style="width:2.83%;">' +
      '<col style="width:2.83%;"><col style="width:2.83%;"><col style="width:2.83%;">' +
      '<col style="width:2.83%;"><col style="width:2.83%;"><col style="width:2.83%;">' +
      '<col style="width:2.83%;"><col style="width:2.83%;"><col style="width:2.83%;"></colgroup>';
    const html =
      legend +
      '<table class="exec fill-height" style="' +
      fontSize +
      '">' +
      widths +
      '<thead><tr><th rowspan="2">No</th><th rowspan="2">年間目標</th>' +
      '<th rowspan="2">具体的な行動項目</th><th rowspan="2">責任者</th><th rowspan="2">担当者</th>' +
      '<th colspan="6">前期</th><th colspan="6">後期</th></tr><tr>' +
      monthHeaders +
      '</tr></thead><tbody>' +
      tableRows +
      '</tbody></table>';
    makePage('14 / ACTION PLAN', '１ヵ年 行動プランシート', html);
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
