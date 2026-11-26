(function (global) {
  function getDenseTableRowLimit(section) {
    if (section.includes('MACRO ENVIRONMENT')) return 18;
    if (section.includes('MICRO ENVIRONMENT')) return 18;
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

    const totals = [0];
    units.forEach((unit) => totals.push(totals.at(-1) + unit.length));
    let best = null;

    function search(start, boundaries) {
      if (start === units.length) {
        const counts = boundaries.map(
          (end, index) => totals[end] - totals[index ? boundaries[index - 1] : 0],
        );
        const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;
        const cost = counts.reduce((sum, count) => sum + (count - mean) ** 2, 0);
        if (
          !best ||
          boundaries.length < best.boundaries.length ||
          (boundaries.length === best.boundaries.length && cost < best.cost)
        ) {
          best = { boundaries, cost };
        }
        return;
      }
      if (best && boundaries.length >= best.boundaries.length) return;

      for (let end = start + 1; end <= units.length; end++) {
        const count = totals[end] - totals[start];
        if (count > maxRows && end > start + 1) break;
        if (best && boundaries.length + 1 > best.boundaries.length) break;
        search(end, [...boundaries, end]);
      }
    }

    search(0, []);
    let start = 0;
    return best.boundaries.map((end) => {
      const chunk = units.slice(start, end).flat();
      start = end;
      return chunk;
    });
  }

  function balanceDenseTableRows(rows, maxRows) {
    const groupedChunks = chunkDenseTableRows(rows, maxRows);
    const counts = groupedChunks.map((chunk) => chunk.length);
    const imbalance = (Math.max(...counts) - Math.min(...counts)) / rows.length;
    if (groupedChunks.length < 2 || imbalance <= 0.25) return groupedChunks;

    const pageCount = Math.ceil(rows.length / maxRows);
    const baseSize = Math.floor(rows.length / pageCount);
    const extraRows = rows.length % pageCount;
    const groups = [];
    for (let index = 0; index < rows.length;) {
      const cell = rows[index].cells[0];
      const span = cell?.classList.contains('cat-cell') ? Math.max(1, cell.rowSpan || 1) : 1;
      groups.push({ start: index, end: Math.min(rows.length, index + span), cell });
      index += span;
    }

    const chunks = [];
    let start = 0;
    for (let page = 0; page < pageCount; page++) {
      const size = baseSize + (page < extraRows ? 1 : 0);
      const end = start + size;
      const chunk = rows.slice(start, end).map((row) => row.cloneNode(true));
      for (const group of groups) {
        const overlapStart = Math.max(start, group.start);
        const overlapEnd = Math.min(end, group.end);
        if (overlapStart >= overlapEnd) continue;
        const localRow = chunk[overlapStart - start];
        const categoryCell = group.cell.cloneNode(true);
        categoryCell.rowSpan = overlapEnd - overlapStart;
        if (overlapStart === group.start) {
          localRow.cells[0].rowSpan = overlapEnd - overlapStart;
        } else {
          localRow.insertBefore(categoryCell, localRow.cells[0]);
        }
      }
      chunks.push(chunk);
      start = end;
    }
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

      const chunks = balanceDenseTableRows(rows, maxRows);
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
  global.balanceDenseTableRows = balanceDenseTableRows;
  global.getDenseTableTypography = getDenseTableTypography;
  global.renumberDenseTablePages = renumberDenseTablePages;
  global.paginateDenseTables = paginateDenseTables;
})(window);
