(function (global) {
  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function fmtCell(value, placeholder = '—') {
    const text = String(value || '').trim();
    return text ? esc(text) : `<span class="empty-dash">${placeholder}</span>`;
  }

  function fmtNum(value) {
    const text = String(value || '').trim();
    if (!text || text === '-') return `<span class="empty-dash">—</span>`;
    if (text.startsWith('-') && text.length > 1) {
      return `<span style="color:#c5221f;">${esc(text)}</span>`;
    }
    return esc(text);
  }

  function impactBadge(value) {
    const text = String(value || '').trim();
    if (!text) return `<span class="empty-dash">—</span>`;
    if (text.includes('両面')) return `<span class="badge badge-both">${esc(text)}</span>`;
    if (text.includes('機会')) return `<span class="badge badge-opp">${esc(text)}</span>`;
    if (text.includes('脅威')) return `<span class="badge badge-thr">${esc(text)}</span>`;
    return `<span class="badge badge-neutral">${esc(text)}</span>`;
  }

  function ganttMark(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (text === '●' || text === '•') return `<span class="gantt-dot">●</span>`;
    if (text.startsWith('★') || text.includes('完了')) return `<span class="gantt-star">★</span>`;
    if (text.startsWith('△') || text.includes('継続')) return `<span class="gantt-tri">△</span>`;
    if (text === '→') return `<span class="gantt-arrow">→</span>`;
    return `<span style="font-weight:700;font-size:8pt;color:var(--primary);">${esc(text)}</span>`;
  }

  Object.assign(global, { esc, fmtCell, fmtNum, impactBadge, ganttMark });
})(window);
