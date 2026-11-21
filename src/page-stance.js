(function (global) {
  function renderStancePage(worksheet, val, makePage) {
    const categoryNames = {
      5: 'Ⅰ. マーケティングの立場（科学性）',
      6: 'Ⅰ. マーケティングの立場（科学性）',
      7: 'Ⅱ. 地域社会に対する役割（社会性）',
      8: 'Ⅱ. 地域社会に対する役割（社会性）',
      9: 'Ⅲ. 社員の立場から（人間性）',
      10: 'Ⅲ. 社員の立場から（人間性）',
    };
    const rows = [];
    for (let row = 5; row <= 10; row++) {
      const answer = val(worksheet, `C${row}`).trim();
      rows.push({
        cat: categoryNames[row],
        hasData: answer !== '',
        cellsHTML: `<td class="item-cell">${global.esc(val(worksheet, `B${row}`))}</td><td style="white-space:pre-wrap;">${global.fmtCell(answer)}</td>`,
      });
    }
    makePage(
      '01 / STANCE',
      '経営姿勢の確立（科学性・社会性・人間性）',
      global.buildDynamicCatTable(
        rows,
        '<colgroup><col style="width:23%;"><col style="width:27%;"><col style="width:50%;"></colgroup>',
        '<thead><tr><th>3つの立場</th><th>問いかけ項目</th><th>自社の経営姿勢</th></tr></thead>',
      ),
    );
  }

  global.renderStancePage = renderStancePage;
})(window);
