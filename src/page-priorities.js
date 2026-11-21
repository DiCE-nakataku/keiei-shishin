(function (global) {
  function renderStrategicIssuesPage(worksheet, val, makePage) {
    const activeRows = [];
    for (let row = 5; row <= 14; row++) {
      const issue = val(worksheet, `B${row}`).trim();
      const benefit = val(worksheet, `C${row}`).trim();
      if (issue || benefit) activeRows.push(row);
    }
    const rows = activeRows.length > 0 ? activeRows : [5, 6, 7];
    const tableRows = rows
      .map(
        (row, index) => `<tr>
        <td class="ctr item-cell">${index + 1}</td>
        <td class="item-cell">${global.fmtCell(val(worksheet, `B${row}`))}</td>
        <td>${global.fmtCell(val(worksheet, `C${row}`))}</td>
        <td class="num ctr">${global.fmtNum(val(worksheet, `D${row}`))}</td>
        <td class="num ctr">${global.fmtNum(val(worksheet, `E${row}`))}</td>
        <td class="num ctr">${global.fmtNum(val(worksheet, `F${row}`))}</td>
        <td class="num ctr">${global.fmtNum(val(worksheet, `G${row}`))}</td>
        <td class="num ctr">${global.fmtNum(val(worksheet, `H${row}`))}</td>
        <td class="num ctr">${global.fmtNum(val(worksheet, `I${row}`))}</td>
        <td class="num ctr" style="font-weight:700;background:var(--primary-tint);">${global.fmtNum(val(worksheet, `J${row}`))}</td>
        <td class="num ctr" style="font-weight:800;color:var(--accent);font-size:10pt;">${global.fmtNum(val(worksheet, `K${row}`))}</td>
      </tr>`,
      )
      .join('');
    const fontSize = rows.length <= 5 ? 'font-size:9.2pt;line-height:1.55;' : 'font-size:8.4pt;';
    makePage(
      '08 / STRATEGIC ISSUES',
      '課題抽出・方針整理シート',
      `
        <table class="exec fill-height" style="${fontSize}">
          <colgroup>
            <col style="width:4%;"><col style="width:31%;"><col style="width:27%;">
            <col style="width:4.5%;"><col style="width:4.5%;"><col style="width:4.5%;">
            <col style="width:4.5%;"><col style="width:4.5%;"><col style="width:4.5%;">
            <col style="width:5.5%;"><col style="width:5.5%;">
          </colgroup>
          <thead>
            <tr><th>No</th><th>経営課題</th><th>克服すると何が得られるか</th><th>理念</th><th>ﾋﾞｼﾞｮﾝ</th><th>効果</th><th>実現</th><th>緊急</th><th>欲求</th><th>合計</th><th>順位</th></tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      `,
    );
  }

  function renderManagementPolicyPage(worksheet, val, makePage) {
    const activeRows = [];
    for (let row = 5; row <= 12; row++) {
      if (val(worksheet, `B${row}`).trim() || val(worksheet, `C${row}`).trim()) {
        activeRows.push(row);
      }
    }
    const rows = activeRows.length > 0 ? activeRows : [5, 6, 7];
    const tableRows = rows
      .map(
        (row, index) => `<tr>
        <td class="cat-cell">方針 ${index + 1}</td>
        <td class="item-cell" style="font-size:10pt;color:var(--primary);">${global.fmtCell(val(worksheet, `B${row}`))}</td>
        <td style="white-space:pre-wrap;line-height:1.65;">${global.fmtCell(val(worksheet, `C${row}`))}</td>
      </tr>`,
      )
      .join('');
    const fontSize = rows.length <= 4 ? 'font-size:9.6pt;' : 'font-size:8.8pt;';
    makePage(
      '09 / MANAGEMENT POLICY',
      '重点経営方針',
      `
        <table class="exec fill-height" style="${fontSize}">
          <colgroup><col style="width:10%;"><col style="width:30%;"><col style="width:60%;"></colgroup>
          <thead><tr><th>No.</th><th>経営方針</th><th>説明・具体的な取り組み</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      `,
    );
  }

  global.renderStrategicIssuesPage = renderStrategicIssuesPage;
  global.renderManagementPolicyPage = renderManagementPolicyPage;
})(window);
