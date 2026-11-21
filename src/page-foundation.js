(function (global) {
  function renderPhilosophyPage(worksheet, val, makePage) {
    const main = val(worksheet, 'C5').trim();
    const note = val(worksheet, 'C6').trim();
    const content = !note
      ? `
          <div class="hero-quote" style="flex:1;margin-bottom:0;padding:28px 36px;">
            <div class="hero-quote-label">CORPORATE PHILOSOPHY ― 私たちが存在する理由</div>
            <div class="hero-quote-text" style="font-size:18pt;line-height:1.85;">${global.fmtCell(main, '（経営理念を入力してください）')}</div>
          </div>
        `
      : `
          <div class="hero-quote" style="flex:0 0 46%;">
            <div class="hero-quote-label">CORPORATE PHILOSOPHY ― 私たちが存在する理由</div>
            <div class="hero-quote-text">${global.fmtCell(main, '（経営理念を入力してください）')}</div>
          </div>
          <div style="font-size:9.5pt;font-weight:700;color:var(--primary);margin:2px 0 6px;letter-spacing:0.05em;">■ 理念に込めた想い・解説</div>
          <div class="narrative-box">${global.esc(note)}</div>
        `;
    makePage('02 / PHILOSOPHY', '経営理念', content);
  }

  function renderVisionPlanningPage(worksheet, val, makePage) {
    const cards = [];
    for (let row = 5; row <= 8; row++) {
      cards.push({
        title: `${val(worksheet, `A${row}`)}：${val(worksheet, `B${row}`)}`,
        body: val(worksheet, `C${row}`),
      });
    }
    makePage(
      '03 / VISION WORK',
      '長期（10年）ビジョン検討シート',
      global.buildDynamicCardGrid(cards, '（検討内容未記入）'),
    );
  }

  global.renderPhilosophyPage = renderPhilosophyPage;
  global.renderVisionPlanningPage = renderVisionPlanningPage;
})(window);
