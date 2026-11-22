(function (global) {
  function numberValue(value) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const normalized = text.replace(/[\s,，]/g, '').replace(/(?:千円|万円|円|人|％|%)/g, '');
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return Number.NaN;
    return Number(normalized);
  }

  function yearMonth(value) {
    const match = String(value ?? '').match(/(20\d{2})\s*年\s*(\d{1,2})\s*月/);
    if (!match) return null;
    const month = Number(match[2]);
    if (month < 1 || month > 12) return null;
    return Number(match[1]) * 12 + month;
  }

  function isDateLike(value) {
    const text = String(value ?? '').trim();
    return (
      /^(20\d{2})\s*年\s*(\d{1,2})\s*月(?:\s*(\d{1,2})\s*日)?$/.test(text) ||
      /^20\d{2}[-/年]\d{1,2}(?:[-/月]\d{1,2}日?)?$/.test(text)
    );
  }

  function validateWorkbookInputs(workbook, val, selectedSheets) {
    const issues = [];
    const read = (sheetName, address) => val(workbook.Sheets[sheetName], address).trim();
    const required = [
      ['00_出力設定・表紙', 'B24', '会社名'],
      ['00_出力設定・表紙', 'B26', '今期（計画対象期）'],
      ['00_出力設定・表紙', 'B27', '開始年月'],
      ['00_出力設定・表紙', 'B28', '終了年月'],
    ];
    for (const [sheet, cell, label] of required) {
      if (!read(sheet, cell))
        issues.push({ sheet, cell, severity: 'warning', message: `${label}が未入力です。` });
    }

    for (const [cell, label] of [
      ['B27', '開始年月'],
      ['B28', '終了年月'],
    ]) {
      const value = read('00_出力設定・表紙', cell);
      if (value && yearMonth(value) === null) {
        issues.push({
          sheet: '00_出力設定・表紙',
          cell,
          severity: 'warning',
          message: `${label}は「2026年4月」の形式で入力してください。`,
        });
      }
    }
    const publicationDate = read('00_出力設定・表紙', 'B29');
    if (publicationDate && !isDateLike(publicationDate)) {
      issues.push({
        sheet: '00_出力設定・表紙',
        cell: 'B29',
        severity: 'warning',
        message: '策定日は年月日を含む日付形式で入力してください。',
      });
    }

    const term = read('00_出力設定・表紙', 'B26').replace(/^第/, '').replace(/期$/, '').trim();
    if (term && (!Number.isInteger(numberValue(term)) || numberValue(term) <= 0)) {
      issues.push({
        sheet: '00_出力設定・表紙',
        cell: 'B26',
        severity: 'warning',
        message: '今期は1以上の数字で入力してください。',
      });
    }

    const start = yearMonth(read('00_出力設定・表紙', 'B27'));
    const end = yearMonth(read('00_出力設定・表紙', 'B28'));
    if (start !== null && end !== null && end < start) {
      issues.push({
        sheet: '00_出力設定・表紙',
        cell: 'B28',
        severity: 'warning',
        message: '終了年月が開始年月より前になっています。',
      });
    }

    const numericInputs = [
      ['14_利益資金計画検討表②', 'B9', '固定費'],
      ['14_利益資金計画検討表②', 'B10', '人件費'],
      ['14_利益資金計画検討表②', 'B11', '減価償却費'],
      ['14_利益資金計画検討表②', 'B12', '経常利益目標'],
      ['14_利益資金計画検討表②', 'B15', '新規投資返済額'],
      ['14_利益資金計画検討表②', 'B16', '年間借入返済額'],
      ['14_利益資金計画検討表②', 'B20', '人員'],
    ];
    for (const [sheet, cell, label] of numericInputs) {
      const value = read(sheet, cell);
      if (value && Number.isNaN(numberValue(value))) {
        issues.push({
          sheet,
          cell,
          severity: 'warning',
          message: `${label}は数字で入力してください。`,
        });
      }
    }

    if (selectedSheets.includes('03_経営理念') && !read('03_経営理念', 'C5')) {
      issues.push({
        sheet: '03_経営理念',
        cell: 'C5',
        severity: 'warning',
        message: '出力対象の経営理念が未入力です。',
      });
    }
    if (selectedSheets.includes('05_長期ビジョン') && !read('05_長期ビジョン', 'C5')) {
      issues.push({
        sheet: '05_長期ビジョン',
        cell: 'C5',
        severity: 'warning',
        message: '出力対象の長期ビジョンが未入力です。',
      });
    }

    const goals = workbook.Sheets['15_目標設定'];
    if (goals) {
      for (const column of ['B', 'C', 'D']) {
        const sales = numberValue(read('15_目標設定', `${column}5`));
        const profit = numberValue(read('15_目標設定', `${column}6`));
        if (Number.isFinite(sales) && Number.isFinite(profit) && profit > sales) {
          issues.push({
            sheet: '15_目標設定',
            cell: `${column}6`,
            severity: 'warning',
            message: `${column}列の経常利益目標が売上目標を上回っています。数値を確認してください。`,
          });
        }
      }
    }
    return issues;
  }

  function renderInputDiagnostics(issues) {
    const section = global.document.getElementById('inputDiagnostics');
    if (!section) return;
    section.hidden = issues.length === 0;
    if (issues.length === 0) {
      section.replaceChildren();
      return;
    }
    const heading = global.document.createElement('strong');
    heading.textContent = `入力内容の確認：${issues.length} 件`;
    const note = global.document.createElement('p');
    note.textContent = 'Excelで修正して読み込み直すか、このまま表示を続けてください。';
    const list = global.document.createElement('ul');
    issues.forEach((issue) => {
      const item = global.document.createElement('li');
      item.textContent = `${issue.sheet}!${issue.cell}　${issue.message}`;
      list.append(item);
    });
    section.replaceChildren(heading, note, list);
    section.className = 'input-diagnostics';
  }

  global.validateWorkbookInputs = validateWorkbookInputs;
  global.renderInputDiagnostics = renderInputDiagnostics;
})(window);
