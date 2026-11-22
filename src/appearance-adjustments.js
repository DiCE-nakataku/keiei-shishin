(function (global) {
  const factors = { small: 0.9, standard: 1, large: 1.1 };
  const state = global.workbookState;
  let selectedTarget = null;
  let selectedTextCanBreak = false;
  let editing = false;

  function stableKey(...parts) {
    return parts.map((part) => encodeURIComponent(part)).join('|');
  }

  function assignAppearanceBlockIds(container) {
    const rowNumbers = new Map();
    const boxNumbers = new Map();
    for (const page of container.querySelectorAll('.page')) {
      const section = page.dataset.section || 'PAGE';
      if (page.classList.contains('cover-page')) {
        const coverBlocks = [
          ['.cover-en', 'english-title'],
          ['.cover-term-label', 'term-label'],
          ['.cover-term-num', 'term-number'],
          ['.cover-range', 'term-range'],
          ['.cover-left-foot', 'company-left'],
          ['.cover-doc-type', 'document-type'],
          ['.cover-title', 'title'],
          ['.cover-motto', 'subtitle'],
          ['.cover-company', 'company-signature'],
          ['.cover-rep', 'representative'],
          ['.cover-date', 'publication-date'],
        ];
        for (const [selector, name] of coverBlocks) {
          page.querySelectorAll(selector).forEach((block) => {
            block.dataset.appearanceKey = stableKey(section, name);
            block.dataset.appearanceBox = stableKey(section, name);
          });
        }
      }
      const title = page.querySelector('.page-title');
      if (title) title.dataset.appearanceKey = stableKey(section, 'title');
      const table = page.querySelector('.page-body table.exec');
      if (table) {
        const rows = [...table.querySelectorAll('tbody tr')];
        const hasCategory = rows.some((row) => row.cells[0]?.classList.contains('cat-cell'));
        for (const row of rows) {
          const firstDataCell =
            row.cells[hasCategory ? (row.cells[0]?.classList.contains('cat-cell') ? 1 : 0) : 0];
          const rowLabel = (firstDataCell?.innerText || '').trim().replace(/\s+/g, ' ') || '項目';
          const duplicateKey = `${section}|${rowLabel}`;
          const duplicateNumber = rowNumbers.get(duplicateKey) || 0;
          rowNumbers.set(duplicateKey, duplicateNumber + 1);
          const rowKey = stableKey(section, `row-${rowLabel}-${duplicateNumber}`);
          row.dataset.appearanceRow = rowKey;
          row.dataset.appearanceBox = row.dataset.appearanceRow;
          const hasCategoryCell = row.cells[0]?.classList.contains('cat-cell');
          const missingCategoryCell = hasCategory && !hasCategoryCell;
          [...row.cells].forEach((cell, index) => {
            const column = index + (missingCategoryCell ? 1 : 0);
            cell.dataset.appearanceKey = stableKey(
              section,
              `row-${rowLabel}-${duplicateNumber}`,
              `cell-${column}`,
            );
            cell.dataset.appearanceRow = row.dataset.appearanceRow;
            cell.dataset.appearanceBox = row.dataset.appearanceBox;
          });
        }
      }

      const body = page.querySelector('.page-body') || page;
      body.querySelectorAll('.panel-card, .hero-quote').forEach((box) => {
        const index = boxNumbers.get(section) || 0;
        boxNumbers.set(section, index + 1);
        box.dataset.appearanceBox = stableKey(section, `box-${index}`);
        box
          .querySelectorAll('.panel-head, .panel-body, .hero-quote-text, .vision-text')
          .forEach((block, childIndex) => {
            block.dataset.appearanceKey = stableKey(section, `box-${index}`, `text-${childIndex}`);
            block.dataset.appearanceBox = box.dataset.appearanceBox;
          });
      });
      body
        .querySelectorAll('.cover-motto, .panel-body, .hero-quote-text, .vision-text')
        .forEach((block, index) => {
          if (block.dataset.appearanceKey) return;
          const number = boxNumbers.get(section) || 0;
          boxNumbers.set(section, number + 1);
          block.dataset.appearanceKey = stableKey(section, `text-${number + index}`);
          block.dataset.appearanceBox = stableKey(section, `box-${number + index}`);
        });
    }
  }

  function targetsFor(key, scope, container = global.document.getElementById('pagesContainer')) {
    if (!container) return [];
    if (scope === 'block') {
      return [...container.querySelectorAll('[data-appearance-key]')].filter(
        (element) => element.dataset.appearanceKey === key,
      );
    }
    const attribute = scope === 'row' ? 'appearanceRow' : 'appearanceBox';
    return [
      ...container.querySelectorAll(
        `[data-${attribute.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}]`,
      ),
    ].filter((element) => element.dataset[attribute] === key);
  }

  function applySize(element, size) {
    if (!element.dataset.baseFontSize) {
      element.dataset.baseFontSize = String(global.getComputedStyle(element).fontSize);
    }
    const base = Number.parseFloat(element.dataset.baseFontSize);
    element.style.fontSize = `${base * (factors[size] || 1)}px`;
  }

  function renderTextBreaks(element, sourceText, offsets) {
    const characters = Array.from(sourceText.replace(/\n/g, ''));
    const splitAt = new Set(offsets);
    const fragment = global.document.createDocumentFragment();
    characters.forEach((character, index) => {
      fragment.append(global.document.createTextNode(character));
      if (splitAt.has(index + 1)) fragment.append(global.document.createElement('br'));
    });
    element.replaceChildren(fragment);
  }

  function applyAppearanceSettings(container) {
    let skippedBreaks = 0;
    let unmatched = 0;
    const pages = [...container.querySelectorAll('.page')];
    for (const [key, settings] of Object.entries(state.appearanceSettings || {})) {
      const elements = targetsFor(key, settings.scope || 'block', container);
      let section = '';
      try {
        section = decodeURIComponent(key.split('|')[0] || '');
      } catch {
        unmatched++;
      }
      if (elements.length === 0 && pages.some((page) => page.dataset.section === section)) {
        unmatched++;
      }
      for (const element of elements) {
        applySize(element, settings.size || 'standard');
        if (settings.lineBreaks && settings.scope === 'block') {
          const currentText = element.innerText.replace(/\r/g, '');
          if (currentText === settings.sourceText && element.children.length === 0) {
            renderTextBreaks(element, settings.sourceText, settings.lineBreaks);
          } else if (currentText !== settings.renderedText) {
            skippedBreaks++;
          }
        }
      }
    }
    state.skippedAppearanceBreaks = skippedBreaks;
    state.unmappedAppearanceSettings = unmatched;
    return skippedBreaks;
  }

  function refreshAppearanceTargets(container = global.document.getElementById('pagesContainer')) {
    if (!container) return;
    assignAppearanceBlockIds(container);
    applyAppearanceSettings(container);
    if (!editing) return;
    container.querySelectorAll('[data-appearance-key]').forEach((element) => {
      element.tabIndex = 0;
      element.setAttribute('role', 'button');
      element.setAttribute(
        'aria-label',
        `${(element.innerText || '').trim().slice(0, 80) || 'ブロック'}：調整するにはEnterキー`,
      );
    });
  }

  function renderTransferNotice() {
    const count = (state.unmappedAppearanceSettings || 0) + (state.skippedAppearanceBreaks || 0);
    if (!count) return;
    const section = global.document.getElementById('inputDiagnostics');
    if (!section) return;
    section.hidden = false;
    section.classList.add('input-diagnostics', 'mapping-warning');
    const note = global.document.createElement('p');
    note.textContent = `更新したExcelで引き継げない見た目調整が ${count} 件あります。該当箇所は標準表示です。`;
    section.append(note);
  }

  function clearAppearanceSettings(scopeKey, scope) {
    delete state.appearanceSettings[scopeKey];
    for (const element of targetsFor(scopeKey, scope)) {
      element.style.fontSize = '';
      delete element.dataset.baseFontSize;
      const key = element.dataset.appearanceKey;
      const previous = state.appearanceSettings[key];
      if (previous?.lineBreaks && element.innerText === previous.renderedText) {
        element.textContent = previous.sourceText;
      }
    }
    applyAppearanceSettings(global.document.getElementById('pagesContainer'));
    global.markWorkFileDirty?.();
    if (!global.markWorkFileDirty) state.workFileDirty = true;
  }

  function offsetsFromText(text) {
    const offsets = [];
    let position = 0;
    for (const character of text.replace(/\r/g, '')) {
      if (character === '\n') offsets.push(position);
      else position++;
    }
    return offsets.filter((offset) => offset > 0);
  }

  function canEditTextBlock(target) {
    if (target.matches('th')) return false;
    if (target.children.length === 0) return true;
    const existing = state.appearanceSettings[target.dataset.appearanceKey];
    return Boolean(
      existing?.lineBreaks &&
      Array.from(target.children).every((child) => child.tagName === 'BR') &&
      target.innerText.replace(/\r/g, '') === existing.renderedText,
    );
  }

  function openDialog(target) {
    selectedTarget = target;
    const dialog = global.document.getElementById('appearanceDialog');
    const canChangeBreaks = canEditTextBlock(target);
    selectedTextCanBreak = canChangeBreaks;
    const rowOption = global.document.querySelector('#appearanceScope option[value="row"]');
    const boxOption = global.document.querySelector('#appearanceScope option[value="box"]');
    rowOption.hidden = !target.dataset.appearanceRow;
    boxOption.hidden = !target.dataset.appearanceBox;
    const scope = target.dataset.appearanceKey;
    const existing = state.appearanceSettings[scope] || {};
    global.document.getElementById('appearanceScope').value = existing.scope || 'block';
    global.document.getElementById('appearanceSize').value = existing.size || 'standard';
    const textInput = global.document.getElementById('appearanceText');
    textInput.value = canChangeBreaks ? target.innerText.replace(/\r/g, '') : '';
    textInput.disabled = !canChangeBreaks;
    global.document.getElementById('appearanceBlockDescription').textContent =
      target.closest('.page')?.dataset.title || '選択したブロック';
    const error = global.document.getElementById('appearanceError');
    error.hidden = true;
    dialog.showModal();
    global.document.getElementById('appearanceScope').focus();
  }

  function activateMode(active) {
    editing = active;
    global.document.body.classList.toggle('appearance-editing', active);
    global.document.querySelectorAll('[data-appearance-key]').forEach((element) => {
      if (active) {
        element.tabIndex = 0;
        element.setAttribute('role', 'button');
        element.setAttribute(
          'aria-label',
          `${(element.innerText || '').trim().slice(0, 80) || 'ブロック'}：調整するにはEnterキー`,
        );
      } else {
        element.removeAttribute('tabindex');
        element.removeAttribute('role');
        element.removeAttribute('aria-label');
      }
    });
    const button = global.document.getElementById('adjustmentModeButton');
    button.setAttribute('aria-pressed', String(active));
    button.textContent = active ? '調整を終了' : '見た目を調整';
  }

  global.document.getElementById('adjustmentModeButton')?.addEventListener('click', () => {
    activateMode(!editing);
  });
  global.document.getElementById('appearanceScope')?.addEventListener('change', (event) => {
    global.document.getElementById('appearanceText').disabled =
      !selectedTextCanBreak || event.currentTarget.value !== 'block';
  });
  global.document.getElementById('pagesContainer')?.addEventListener('click', (event) => {
    if (!editing) return;
    const target = event.target.closest('[data-appearance-key]');
    if (!target) return;
    event.preventDefault();
    openDialog(target);
  });
  global.document.getElementById('pagesContainer')?.addEventListener('keydown', (event) => {
    if (!editing || !['Enter', ' '].includes(event.key)) return;
    const target = event.target.closest('[data-appearance-key]');
    if (!target) return;
    event.preventDefault();
    openDialog(target);
  });
  global.document.getElementById('appearanceDialog')?.addEventListener('close', () => {
    if (editing) selectedTarget?.focus();
  });
  global.document.getElementById('applyAppearanceButton')?.addEventListener('click', () => {
    if (!selectedTarget) return;
    const scope = global.document.getElementById('appearanceScope').value;
    const scopeKey =
      scope === 'block'
        ? selectedTarget.dataset.appearanceKey
        : selectedTarget.dataset[scope === 'row' ? 'appearanceRow' : 'appearanceBox'];
    const size = global.document.getElementById('appearanceSize').value;
    const textarea = global.document.getElementById('appearanceText');
    const sourceText = selectedTarget.innerText.replace(/\r/g, '');
    const candidate = textarea.value.replace(/\r/g, '');
    const error = global.document.getElementById('appearanceError');
    if (!textarea.disabled && candidate.replace(/\n/g, '') !== sourceText.replace(/\n/g, '')) {
      error.textContent = '文字や数字が変更されています。改行だけを調整してください。';
      error.hidden = false;
      return;
    }
    const settings = { scope, size };
    const previous = state.appearanceSettings[scopeKey];
    if (
      scope === 'block' &&
      previous?.lineBreaks &&
      sourceText === previous.renderedText &&
      candidate === sourceText
    ) {
      settings.sourceText = previous.sourceText;
      settings.renderedText = previous.renderedText;
      settings.lineBreaks = previous.lineBreaks;
    } else if (!textarea.disabled && candidate !== sourceText) {
      settings.sourceText =
        previous?.lineBreaks && sourceText === previous.renderedText
          ? previous.sourceText
          : sourceText;
      settings.renderedText = candidate;
      settings.lineBreaks = offsetsFromText(candidate);
    }
    if (scope === 'block' && previous?.lineBreaks && selectedTarget.children.length > 0) {
      selectedTarget.textContent = previous.sourceText;
    }
    state.appearanceSettings[scopeKey] = settings;
    applyAppearanceSettings(global.document.getElementById('pagesContainer'));
    global.markWorkFileDirty?.();
    if (!global.markWorkFileDirty) state.workFileDirty = true;
    global.document.getElementById('appearanceDialog').close();
  });
  global.document.getElementById('resetAppearanceButton')?.addEventListener('click', () => {
    if (!selectedTarget) return;
    const scope = global.document.getElementById('appearanceScope').value;
    const key =
      scope === 'block'
        ? selectedTarget.dataset.appearanceKey
        : selectedTarget.dataset[scope === 'row' ? 'appearanceRow' : 'appearanceBox'];
    clearAppearanceSettings(key, scope);
    global.document.getElementById('appearanceDialog').close();
  });
  global.document.getElementById('resetAllAppearanceButton')?.addEventListener('click', () => {
    if (!global.confirm('このブックの見た目調整をすべて標準に戻しますか？')) return;
    const previousSettings = state.appearanceSettings;
    state.appearanceSettings = {};
    for (const element of global.document.querySelectorAll('[data-base-font-size]')) {
      element.style.fontSize = '';
      delete element.dataset.baseFontSize;
    }
    for (const element of global.document.querySelectorAll('[data-appearance-key]')) {
      const key = element.dataset.appearanceKey;
      const prior = previousSettings[key];
      if (prior?.lineBreaks && element.innerText === prior.renderedText) {
        element.textContent = prior.sourceText;
      }
    }
    global.applyAppearanceSettings(global.document.getElementById('pagesContainer'));
    global.markWorkFileDirty?.();
    if (!global.markWorkFileDirty) state.workFileDirty = true;
  });

  global.assignAppearanceBlockIds = assignAppearanceBlockIds;
  global.applyAppearanceSettings = applyAppearanceSettings;
  global.refreshAppearanceTargets = refreshAppearanceTargets;
  global.renderAppearanceTransferNotice = renderTransferNotice;
  global.clearAppearanceSettings = clearAppearanceSettings;
  global.canEditAppearanceText = canEditTextBlock;
  global.setAppearanceEditing = activateMode;
})(window);
