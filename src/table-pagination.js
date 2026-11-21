(function (global) {
  function getDenseTableRowLimit(section) {
    if (section.includes('MACRO ENVIRONMENT')) return 8;
    if (section.includes('MICRO ENVIRONMENT')) return 12;
    if (section.includes('INTERNAL ANALYSIS')) return 20;
    if (section.includes('STRATEGIC ISSUES')) return 8;
    if (section.includes('ACTIONS') || section.includes('SALES PLAN')) return 12;
    return 20;
  }

  function chunkDenseTableRows(rows, maxRows) {
    const units = [];
    for (let index = 0; index < rows.length;) {
      const firstCell = rows[index].cells[0];
      const span = firstCell?.classList.contains('cat-cell')
        ? Math.max(1, firstCell.rowSpan || 1)
        : 1;
      units.push(rows.slice(index, Math.min(rows.length, index + span)));
      index += span;
    }

    const chunks = [];
    let chunk = [];
    let count = 0;
    for (const unit of units) {
      if (chunk.length && count + unit.length > maxRows) {
        chunks.push(chunk.flat());
        chunk = [];
        count = 0;
      }
      chunk.push(unit);
      count += unit.length;
    }
    if (chunk.length) chunks.push(chunk.flat());
    return chunks;
  }

  function getDenseTableTypography(section, rowCount) {
    if (section.includes('STRATEGIC ISSUES')) {
      return { fontSize: rowCount <= 4 ? '8.8pt' : '8.2pt', lineHeight: '1.45' };
    }
    return {
      fontSize: rowCount <= 6 ? '9.5pt' : rowCount <= 8 ? '9pt' : '8.2pt',
      lineHeight: rowCount <= 6 ? '1.55' : '1.4',
    };
  }

  function renumberDenseTablePages(pages) {
    pages.forEach((page, index) => {
      const number = page.querySelector('.page-num');
      if (number) {
        number.textContent = `${String(index + 1).padStart(2, '0')} / ${String(pages.length).padStart(2, '0')}`;
      }
    });
    return pages.length;
  }

  function paginateDenseTables(container) {
    const slots = [...container.querySelectorAll('.page-slot')];
    const continuationSlots = [];
    for (const slot of slots) {
      const page = slot.querySelector('.page');
      const body = page?.querySelector('.page-body');
      const table = body?.querySelector(':scope > table.exec');
      const rows = table ? [...(table.tBodies[0]?.rows || [])] : [];
      if (rows.length < 2) continue;
      const section = page.dataset.section || '';
      const maxRows = getDenseTableRowLimit(section);
      if (rows.length <= maxRows) continue;

      const chunks = chunkDenseTableRows(rows, maxRows);
      if (chunks.length < 2) continue;

      const writeRows = (targetPage, unitsForPage) => {
        const targetTable = targetPage.querySelector('.page-body > table.exec');
        const targetBody = targetTable.tBodies[0];
        targetBody.replaceChildren(...unitsForPage.map((row) => row.cloneNode(true)));
        const rowCount = targetBody.rows.length;
        const typography = getDenseTableTypography(section, rowCount);
        targetTable.style.fontSize = typography.fontSize;
        targetTable.style.lineHeight = typography.lineHeight;
      };
      writeRows(page, chunks[0]);
      for (const rowsForPage of chunks.slice(1)) {
        const nextPage = page.cloneNode(true);
        nextPage.querySelector('h2')?.append(global.document.createTextNode('（続き）'));
        nextPage.querySelector('.sec-tag')?.append(global.document.createTextNode(' / CONT.'));
        writeRows(nextPage, rowsForPage);
        const nextSlot = global.document.createElement('div');
        nextSlot.className = 'page-slot';
        nextSlot.append(nextPage);
        continuationSlots.push({ after: slot, node: nextSlot });
      }
    }
    const afterLast = new Map();
    for (const item of continuationSlots) {
      const previous = afterLast.get(item.after) || item.after;
      previous.after(item.node);
      afterLast.set(item.after, item.node);
    }
    const pages = [...container.querySelectorAll('.page-slot > .page')];
    return renumberDenseTablePages(pages);
  }

  global.getDenseTableRowLimit = getDenseTableRowLimit;
  global.chunkDenseTableRows = chunkDenseTableRows;
  global.getDenseTableTypography = getDenseTableTypography;
  global.renumberDenseTablePages = renumberDenseTablePages;
  global.paginateDenseTables = paginateDenseTables;
})(window);
