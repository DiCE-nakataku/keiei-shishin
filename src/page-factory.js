(function (global) {
  function createPageFactory({ document, container, company, term, total, escapeHtml }) {
    let pageNum = 0;

    return function makePage(section, title, html, isCover = false, bodyId = '') {
      pageNum++;
      const page = document.createElement('div');
      page.className = isCover ? 'page cover-page' : 'page';
      page.dataset.section = section;
      page.dataset.title = title;
      if (isCover && bodyId) page.id = bodyId;
      if (isCover) {
        page.innerHTML = html;
      } else {
        page.innerHTML = `
        <div class="page-header">
          <div class="header-left">
            <span class="sec-tag">${escapeHtml(section)}</span>
            <h2 class="page-title">${escapeHtml(title)}</h2>
          </div>
          <div class="page-meta">${escapeHtml(company)}　｜　第${escapeHtml(term)}期 経営指針書</div>
        </div>
        <div class="page-body" ${bodyId ? `id="${bodyId}"` : ''}>${html}</div>
        <div class="page-footer">
          <span>CONFIDENTIAL — ${escapeHtml(company)}</span>
          <span class="page-num">${String(pageNum).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
        </div>
      `;
      }
      const slot = document.createElement('div');
      slot.className = 'page-slot';
      slot.append(page);
      container.append(slot);
    };
  }

  global.createPageFactory = createPageFactory;
})(window);
