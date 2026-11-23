Warning: truncated output (original token count: 17660)
Total output lines: 1808

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const stylesheet = fs.readFileSync(path.join(root, 'styles.css'), 'utf8').replace(/\r\n/g, '\n');
const uploadModuleSource = fs.readFileSync(path.join(root, 'src/upload.js'), 'utf8');
const brandingModuleSource = fs.readFileSync(path.join(root, 'src/page-branding.js'), 'utf8');
const workbookPagesModuleSource = fs.readFileSync(path.join(root, 'src/workbook-pages.js'), 'utf8');
const workbookControllerModuleSource = fs.readFileSync(
  path.join(root, 'src/workbook-controller.js'),
  'utf8',
);
const workbookStateModuleSource = fs.readFileSync(path.join(root, 'src/workbook-state.js'), 'utf8');
const inputValidationModuleSource = fs.readFileSync(
  path.join(root, 'src/input-validation.js'),
  'utf8',
);

function createUploadHarness({ parseWorkbook = () => ({ id: 'workbook' }), renderBook } = {}) {
  const readers = [];
  const inputListeners = new Map();
  const focusListeners = [];
  const status = { textContent: '' };
  const feedback = {
    textContent: '',
    hidden: true,
    classList: {
      toggle(name, enabled) {
        this[name] = enabled;
      },
    },
  };
  const errors = [];
  let printControlUpdates = 0;
  let printGuidanceClears = 0;
  const bodyClasses = new Set(['has-pages']);
  const pages = { innerHTML: '<article>previous pages</article>' };
  const scrollCalls = [];
  const uploadCta = {
    addEventListener(name, callback) {
      this.clickHandler = callback;
    },
  };
  const reselectLabel = {
    addEventListener(name, callback) {
      this.clickHandler = callback;
    },
  };
  const backToTopButton = {
    addEventListener(name, callback) {
      this.clickHandler = callback;
    },
  };
  const input = {
    value: '',
    files: [],
    clickCount: 0,
    click() {
      this.clickCount++;
      inputListeners.get('click')?.call(this);
    },
    addEventListener(name, callback) {
      inputListeners.set(name, callback);
    },
  };
  const context = {
    confirm: () => true,
    FileReader: class {
      readAsArrayBuffer(file) {
        this.file = file;
        readers.push(this);
      }
    },
    clearPrintGuidance() {
      printGuidanceClears++;
    },
    console: { error: (...args) => errors.push(args) },
    document: {
      body: {
        classList: {
          contains: (name) => bodyClasses.has(name),
          remove: (name) => bodyClasses.delete(name),
        },
      },
      title: 'previous workbook',
      querySelector(selector) {
        return selector === '.btn-reselect'
          ? reselectLabel
          : selector === '.btn-back-top'
            ? backToTopButton
            : null;
      },
      getElementById(id) {
        return id === 'statusText'
          ? status
          : id === 'uploadFeedback'
            ? feedback
            : id === 'pagesContainer'
              ? pages
              : id === 'excelInput'
                ? input
                : id === 'uploadCtaButton'
                  ? uploadCta
                  : null;
      },
    },
    addEventListener(name, callback) {
      if (name === 'focus') focusListeners.push(callback);
    },
    FormulaEngine: { parseWorkbook },
    setTimeout(callback) {
      callback();
    },
    updatePrintControls() {
      printControlUpdates++;
    },
    scrollTo: (...args) => scrollCalls.push(args),
    XLSX: {},
  };
  context.window = context;
  vm.runInNewContext(workbookStateModuleSource, context);
  context.uploadWorkbookState = context.workbookState;
  vm.runInNewContext(uploadModuleSource, context);
  context.renderBook = (workbook) => {
    if (renderBook) return renderBook(workbook);
    context.uploadWorkbookState.activeWorkbook = workbook;
    context.uploadWorkbookState.workbookCalculating = false;
  };
  return {
    context,
    readers,
    status,
    feedback,
    errors,
    input,
    uploadCta,
    reselectLabel,
    backToTopButton,
    inputListeners,
    focusListeners,
    bodyClasses,
    pages,
    scrollCalls,
    get printGuidanceClears() {
      return printGuidanceClears;
    },
    get printControlUpdates() {
      return printControlUpdates;
    },
  };
}

test('landing page keeps the template and full sample bundle downloads', () => {
  const downloads = [...html.matchAll(/<a\b([^>]*\bhref="\.\/downloads\/([^"]+)"[^>]*)>/g)];
  const fileNames = downloads.map(([, , fileName]) => fileName);

  assert.ok(fileNames.includes('経営指針書_ベースシート.xlsx'));
  assert.ok(fileNames.includes('サンプル製作所_サンプル一式.zip'));
  assert.ok(downloads.every(([, attributes]) => /\bdownload\b/.test(attributes)));
});

test('external stylesheet keeps screen and print page layout rules', () => {
  assert.match(html, /<link rel="stylesheet" href="\.\/styles\.css\?v=1\.4\.1">/);
  assert.doesNotMatch(html, /<style>/);
  assert.match(stylesheet, /@page\s*\{[^}]*size:\s*A4\s+landscape/is);
  assert.match(stylesheet, /@media print/);
  assert.match(stylesheet, /\.page-slot \+ \.page-slot\s*\{[^}]*break-before:\s*page/s);
  assert.match(stylesheet, /\.page\s*\{/);
});

test('static controls bind through modules without inline event attributes', () => {
  assert.doesNotMatch(html, /\son(?:click|change|input)=/i);
  const moduleSources = fs
    .readdirSync(path.join(root, 'src'))
    .filter((name) => name.endsWith('.js'))
    .map((name) => fs.readFileSync(path.join(root, 'src', name), 'utf8'))
    .join('\n');
  assert.doesNotMatch(moduleSources, /\son(?:click|change|input)=/i);
  const harness = createUploadHarness();
  harness.uploadCta.clickHandler();
  assert.equal(harness.input.clickCount, 1);
  harness.input.value = 'previous-selection';
  harness.reselectLabel.clickHandler();
  assert.equal(harness.input.value, '');
  harness.backToTopButton.clickHandler();
  assert.equal(harness.pages.innerHTML, '');
  assert.equal(harness.status.textContent, 'Excelファイルを選択してください');
  assert.deepEqual(JSON.parse(JSON.stringify(harness.scrollCalls.at(-1))), [
    { top: 0, behavior: 'smooth' },
  ]);
});

test('theme selection clears print guidance and synchronizes body, toolbar, and landing pills', () => {
  assert.match(html, /<script src="\.\/src\/theme\.js"><\/script>/);
  const source = fs.readFileSync(path.join(root, 'src/theme.js'), 'utf8');
  const bodyClasses = new Set(['theme-slate']);
  const toolbar = {
    value: 'theme-green',
    listeners: {},
    addEventListener(name, callback) {
      this.listeners[name] = callback;
    },
  };
  const buttons = ['', 'theme-green', 'theme-slate'].map((theme) => ({
    dataset: { theme },
    listeners: {},
    addEventListener(name, callback) {
      this.listeners[name] = callback;
    },
    classList: {
      toggle(name, enabled) {
        this[name] = enabled;
      },
    },
  }));
  let guidanceCleared = 0;
  const context = {
    clearPrintGuidance() {
      guidanceCleared++;
    },
    document: {
      body: {
        classList: {
          remove(...names) {
            names.forEach((name) => bodyClasses.delete(name));
          },
          add(name) {
            bodyClasses.add(name);
          },
        },
      },
      getElementById: () => toolbar,
      querySelectorAll: () => buttons,
    },
  };
  context.window = context;
  vm.runInNewContext(source, context);

  context.applyTheme('theme-green');

  assert.equal(guidanceCleared, 1);
  assert.deepEqual([...bodyClasses], ['theme-green']);
  assert.equal(toolbar.value, 'theme-green');
  assert.deepEqual(
    buttons.map((button) => button.classList.active),
    [false, true, false],
  );
  buttons[2].listeners.click();
  assert.deepEqual([...bodyClasses], ['theme-slate']);
  toolbar.value = '';
  toolbar.listeners.change();
  assert.deepEqual([...bodyClasses], []);
});

test('FAQ control toggles its open state and accessible expanded value', () => {
  assert.match(html, /<script src="\.\/src\/faq\.js"><\/script>/);
  const source = fs.readFileSync(path.join(root, 'src/faq.js'), 'utf8');
  const classes = new Set();
  const attributes = {};
  const item = {
    classList: {
      toggle(name) {
        if (classes.has(name)) {
          classes.delete(name);
          return false;
        }
        classes.add(name);
        return true;
      },
    },
  };
  const button = {
    closest: (selector) => (selector === '.faq-item' ? item : null),
    addEventListener(name, callback) {
      this.clickHandler = callback;
    },
    setAttribute: (name, value) => {
      attributes[name] = value;
    },
  };
  const context = {
    document: { querySelectorAll: () => [button] },
  };
  context.window = context;
  vm.runInNewContext(source, context);

  button.clickHandler();
  assert.equal(classes.has('open'), true);
  assert.equal(attributes['aria-expanded'], 'true');

  button.clickHandler();
  assert.equal(classes.has('open'), false);
  assert.equal(attributes['aria-expanded'], 'false');

  context.window.toggleFaq({ closest: () => null, setAttribute: () => assert.fail() });
  assert.equal(attributes['aria-expanded'], 'false');
});

test('Excel selection and landing dropzone forward files to the existing upload handler', () => {
  assert.match(html, /<input type="file" id="excelInput" accept="\.xlsx,\.xls"/);
  assert.match(html, /<script src="\.\/src\/upload\.js"><\/script>/);
  assert.match(
    uploadModuleSource,
    /excelInput\.addEventListener\('change', handleExcelSelection\)/,
  );
  assert.match(html, /<script src="\.\/src\/dropzone\.js"><\/script>/);
  const source = fs.readFileSync(path.join(root, 'src/dropzone.js'), 'utf8');
  const listeners = new Map();
  const classes = new Set();
  let openedFilePicker = 0;
  const dropzone = {
    addEventListener(name, callback) {
      const callbacks = listeners.get(name) || [];
      callbacks.push(callback);
      listeners.set(name, callbacks);
    },
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
    },
  };
  const input = { click: () => openedFilePicker++ };
  const filesOpened = [];
  const dispatch = (name, event) => listeners.get(name).forEach((callback) => callback(event));
  const context = {
    document: {
      getElementById: (id) =>
        id === 'landingDropzone' ? dropzone : id === 'excelInput' ? input : null,
    },
    handleExcelFile: (file) => filesOpened.push(file),
  };
  context.window = context;
  vm.runInNewContext(source, context);

  const dragEvent = () => ({
    prevented: false,
    stopped: false,
    preventDefault() {
      this.prevented = true;
    },
    stopPropagation() {
      this.stopped = true;
    },
  });
  for (const name of ['dragenter', 'dragover']) {
    const event = dragEvent();
    dispatch(name, event);
    assert.equal(event.prevented, true);
    assert.equal(event.stopped, true);
    assert.equal(classes.has('drag-over'), true);
  }
  for (const name of ['dragleave', 'drop']) {
    const event = dragEvent();
    dispatch(name, event);
    assert.equal(event.prevented, true);
    assert.equal(event.stopped, true);
    assert.equal(classes.has('drag-over'), false);
  }
  const file = { name: 'input.xlsx' };
  dispatch('drop', {
    ...dragEvent(),
    dataTransfer: { files: [file] },
  });
  assert.deepEqual(filesOpened, [file]);

  const clickEvent = (selector) => ({
    target: { closest: () => selector },
  });
  dispatch('click', clickEvent(null));
  dispatch('click', clickEvent('a'));
  assert.equal(openedFilePicker, 1);
});

test('landing dropzone does not register without both required elements', () => {
  const source = fs.readFileSync(path.join(root, 'src/dropzone.js'), 'utf8');
  const context = { document: { getElementById: () => null } };
  context.window = context;
  assert.doesNotThrow(() => vm.runInNewContext(source, context));
});

test('Excel upload reads, parses, renders, and clears a previous workbook on re-upload', () => {
  const harness = createUploadHarness();
  const firstFile = { name: 'first.xlsx' };
  const secondFile = { name: 'second.xlsx' };

  harness.context.handleExcelFile(firstFile);
  assert.equal(harness.readers.length, 1);
  assert.equal(harness.readers[0].file, firstFile);
  assert.equal(harness.status.textContent, 'ファイルを読み込み中...');
  assert.equal(harness.context.uploadWorkbookState.workbookCalculating, true);

  harness.readers[0].onload({ target: { result: new ArrayBuffer(0) } });
  const firstWorkbook = harness.context.uploadWorkbookState.activeWorkbook;
  assert.equal(firstWorkbook.id, 'workbook');
  assert.equal(harness.context.uploadWorkbookState.workbookCalculating, false);

  harness.context.handleExcelFile(secondFile);
  assert.equal(harness.readers.length, 2);
  assert.equal(harness.readers[1].file, secondFile);
  assert.equal(harness.context.uploadWorkbookState.activeWorkbook, null);
  assert.equal(harness.context.uploadWorkbookState.workbookCalculating, true);

  harness.readers[1].onabort();
  assert.equal(harness.context.uploadWorkbookState.workbookCalculating, false);
  assert.equal(harness.status.textContent, 'ファイル読込を中断しました');
  assert.match(harness.feedback.textContent, /中断/);
  assert.equal(harness.feedback.classList['is-error'], true);
});

test('Excel upload reports parsing, rendering, and file-read failures', () => {
  const parseFailure = createUploadHarness({
    parseWorkbook() {
      throw new Error('invalid workbook');
    },
  });
  parseFailure.context.handleExcelFile({ name: 'broken.xlsx' });
  parseFailure.readers[0].onload({ target: { result: new ArrayBuffer(0) } });
  assert.equal(parseFailure.status.textContent, '読み込みエラーが発生しました');
  assert.match(parseFailure.feedback.textContent, /invalid workbook/);
  assert.equal(parseFailure.feedback.classList['is-error'], true);
  assert.equal(parseFailure.context.uploadWorkbookState.workbookCalculating, false);

  const renderFailure = createUploadHarness({
    renderBook() {
      throw new Error('render failure');
    },
  });
  renderFailure.context.handleExcelFile({ name: 'valid.xlsx' });
  renderFailure.readers[0].onload({ target: { result: new ArrayBuffer(0) } });
  assert.equal(renderFailure.status.textContent, '計算エラーが発生しました');
  assert.match(renderFailure.feedback.textContent, /render failure/);
  assert.equal(renderFailure.feedback.classList['is-error'], true);
  assert.equal(renderFailure.context.uploadWorkbookState.workbookHasErrors, true);

  const readFailure = createUploadHarness();
  readFailure.context.handleExcelFile({ name: 'unreadable.xlsx' });
  readFailure.readers[0].onerror();
  assert.equal(readFailure.status.textContent, 'ファイル読込失敗');
  assert.match(readFailure.feedback.textContent, /読み込みに失敗/);
  assert.equal(readFailure.feedback.classList['is-error'], true);
});

test('file picker suppresses duplicate input/change events and allows selecting the same file again', () => {
  const harness = createUploadHarness();
  const file = { name: 'same.xlsx', size: 100, lastModified: 10 };
  harness.input.files = [file];
  const event = { currentTarget: harness.input };

  harness.inputListeners.get('input')(event);
  harness.inputListeners.get('change')(event);
  harness.focusListeners[0]();
  assert.equal(harness.readers.length, 1);
  assert.equal(harness.readers[0].file, file);

  harness.inputListeners.get('click').call(harness.input);
  assert.equal(harness.input.value, '');
  harness.inputListeners.get('change')(event);
  assert.equal(harness.readers.length, 2);
  assert.equal(harness.readers[1].file, file);
});

test('return to top clears the active workbook, rendered pages, status, and upload feedback', () => {
  assert.match(html, /<script src="\.\/src\/upload\.js"><\/script>/);
  const harness = createUploadHarness();
  harness.context.uploadWorkbookState.activeWorkbook = { id: 'previous' };

  harness.context.resetToTop();

  assert.equal(harness.context.uploadWorkbookState.activeWorkbook, null);
  assert.equal(harness.bodyClasses.has('has-pages'), false);
  assert.equal(harness.pages.innerHTML, '');
  assert.equal(harness.status.textContent, 'Excelファイルを選択してください');
  assert.equal(harness.feedback.textContent, '');
  assert.equal(harness.context.document.title, '経営指針書 自動レイアウト＆A4横PDF出力ツール');
  assert.equal(harness.printGuidanceClears, 1);
  assert.equal(harness.printControlUpdates, 1);
  assert.equal(harness.scrollCalls.length, 1);
  assert.equal(harness.scrollCalls[0][0].top, 0);
  assert.equal(harness.scrollCalls[0][0].behavior, 'smooth');
});

test('sample workbook still recalculates all formulas without errors', () => {
  const XLSX = require('../vendor/xlsx.full.min.js');
  const context = {};
  const engineSource = fs.readFileSync(path.join(root, 'dist/formula-engine.js'), 'utf8');
  vm.runInNewContext(engineSource, context, { filename: 'dist/formula-engine.js' });

  const bytes = fs.readFileSync(path.join(root, 'downloads/サンプル製作所_入力例.xlsx'));
  const workbook = context.FormulaEngine.parseWorkbook(new Uint8Array(bytes), XLSX);
  const adapter = context.FormulaEngine.createCalculationAdapter(workbook);
  const errors = adapter.calculateAll();
  const results = context.FormulaEngine.validateWorkbook(workbook, adapter);
  const statuses = results.reduce((counts, result) => {
    counts[result.status] = (counts[result.status] || 0) + 1;
    return counts;
  }, {});

  assert.equal(workbook.SheetNames.length, 18);
  assert.equal(results.length, 356);
  assert.equal(errors.length, 0);
  assert.deepEqual(statuses, { ok: 315, 'intentional-blank': 41 });
});

test('a workbook formula error is identified and blocks PDF eligibility', () => {
  const XLSX = require('../vendor/xlsx.full.min.js');
  const context = {};
  const engineSource = fs.readFileSync(path.join(root, 'dist/formula-engine.js'), 'utf8');
  vm.runInNewContext(engineSource, context, { filename: 'dist/formula-engine.js' });

  const bytes = fs.readFileSync(path.join(root, 'downloads/サンプル製作所_入力例.xlsx'));
  const workbook = context.FormulaEngine.parseWorkbook(new Uint8Array(bytes), XLSX);
  workbook.Sheets['00_出力設定・表紙'].ZZ999 = { t: 'n', f: 'BOGUS(1)' };
  const adapter = context.FormulaEngine.createCalculationAdapter(workbook);
  const errors = adapter.calculateAll();
  const results = context.FormulaEngine.validateWorkbook(workbook, adapter);
  const formulaError = results.find(
    (result) => result.sheet === '00_出力設定・表紙' && result.cell === 'ZZ999',
  );

  assert.equal(errors.length, 1);
  assert.equal(formulaError.status, 'error');
  assert.match(formulaError.message, /Function BOGUS is not implemented/);
  assert.equal(
    context.FormulaEngine.canPrint({ hasWorkbook: true, calculating: false, hasErrors: true }),
    false,
  );
});

test('calculation diagnostics show success or safely escaped formula errors', () => {
  assert.match(html, /<script src="\.\/src\/diagnostics\.js"><\/script>/);
  const formattingSource = fs.readFileSync(path.join(root, 'src/cell-formatting.js'), 'utf8');
  const source = fs.readFileSync(path.join(root, 'src/diagnostics.js'), 'utf8');
  const diagnostics = { hidden: true, innerHTML: '' };
  const context = {
    document: { getElementById: (id) => (id === 'calcDiagnostics' ? diagnostics : null) },
  };
  context.window = context;
  vm.runInNewContext(formattingSource, context);
  vm.runInNewContext(source, context);

  context.renderCalculationDiagnostics([
    { status: 'ok' },
    { status: 'intentional-blank' },
    { status: 'ok' },
  ]);
  assert.equal(diagnostics.hidden, false);
  assert.match(diagnostics.innerHTML, /計算確認OK：数式 3 件（正常な空欄 1 件）/);

  context.renderCalculationDiagnostics([
    {
      status: 'error',
      sheet: '<Sheet>',
      cell: 'A&1',
      formula: '=BAD("<tag>")',
      message: 'invalid & <value>',
    },
  ]);
  assert.match(diagnostics.innerHTML, /要確認：1 件の数式エラー/);
  assert.match(diagnostics.innerHTML, /&lt;Sheet&gt;!A&amp;1/);
  assert.match(diagnostics.innerHTML, /invalid &amp; &lt;value&gt;/);
  assert.doesNotMatch(diagnostics.innerHTML, /<Sheet>|<tag>|<value>/);
});

test('PDF export remains guarded and uses native browser printing', () => {
  assert.match(html, /<script src="\.\/src\/printing\.js"><\/script>/);
  assert.match(html, /window\.configurePrintButtonVisibility\(\)/);
  assert.equal(fs.existsSync(path.join(root, 'vendor/html2canvas-1.4.1.min.js')), false);
  assert.equal(fs.existsSync(path.join(root, 'vendor/pdf-lib-1.17.1.min.js')), false);
  const source = fs.readFileSync(path.join(root, 'src/printing.js'), 'utf8');
  const eventListeners = new Map();
  const bodyClasses = new Set();
  const status = { textContent: '' };
  const notice = { style: { display: 'none' } };
  const alerts = [];
  const printButton = {
    disabled: false,
    addEventListener(name, callback) {
      this.clickHandler = callback;
    },
  };
  const presentationButton = { disabled: false };
  const fixedPdfButton = {
    disabled: false,
    addEventListener(name, callback) {
      this.clickHandler = callback;
    },
  };
  const pages = { childElementCount: 1 };
  let printCount = 0;
  const formulaInputs = [];
  const context = {
    addEventListener: (name, callback) => eventListeners.set(name, callback),
    alert: (message) => alerts.push(message),
    navigator: { userAgent: 'Mozilla', platform: 'Win32', maxTouchPoints: 0 },
    FormulaEngine: {
      canPrint(input) {
        formulaInputs.push(input);
        return input.hasWorkbook && !input.calculating && !input.hasErrors;
      },
    },
    document: {
      body: {
        classList: {
          add: (name) => bodyClasses.add(name),
          remove: (name) => bodyClasses.delete(name),
        },
      },
      getElementById(id) {
        return id === 'printPdfStatus'
          ? status
          : id === 'printBlockedNotice'
            ? notice
            : id === 'pagesContainer'
              ? pages
              : id === 'printButton'
                ? printButton
                : id === 'presentationButton'
                  ? presentationButton
                  : id === 'fixedPdfButton'
                    ? fixedPdfButton
                    : null;
      },
    },
    print: () => printCount++,
  };
  context.window = context;
  vm.runInNewContext(workbookStateModuleSource, context);
  vm.runInNewContext(source, context);
  context.setPrintState = (workbook, calculating, errors) => {
    Object.assign(context.workbookState, {
      activeWorkbook: workbook,
      workbookCalculating: calculating,
      workbookHasErrors: errors,
    });
  };

  context.configurePrintButtonVisibility();
  assert.equal(printButton.hidden, false);
  assert.equal(fixedPdfButton.hidden, true);
  context.navigator = { userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 0 };
  context.configurePrintButtonVisibility();
  assert.equal(printButton.hidden, true);
  assert.equal(fixedPdfButton.hidden, …5660 tokens truncated…, val, makePage);
  const fallbackPolicyPage = pageCalls.at(-1);
  assert.match(fallbackPolicyPage[2], /font-size:9\.6pt/);
  assert.match(fallbackPolicyPage[2], /方針 3/);
});

test('financial pages preserve active columns, summaries, and memo layout', () => {
  assert.match(html, /<script src="\.\/src\/page-financial\.js"><\/script>/);
  const context = {
    XLSX: { utils: { encode_col: (index) => String.fromCharCode(65 + index) } },
  };
  context.window = context;
  for (const name of ['cell-formatting.js', 'page-financial.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(root, 'src', name), 'utf8'), context);
  }
  const val = (sheet, address) => sheet[address] || '';
  const pages = [];
  const makePage = (...args) => pages.push(args);

  const variableProfit = {
    B5: '2026年',
    E5: '2025年',
    H5: '2024年',
    B25: '100',
    B27: '合計',
    D27: '20',
    A25: '<売上>',
  };
  context.renderVariableProfitPage(variableProfit, val, makePage);
  assert.equal(pages[0][0], '10 / VARIABLE P&L');
  assert.match(pages[0][2], /2026年/);
  assert.doesNotMatch(pages[0][2], /2025年|2024年/);
  assert.match(pages[0][2], /&lt;売上&gt;/);
  assert.match(pages[0][2], /row-summary/);
  assert.match(pages[0][2], /width:34%/);
  pages.length = 0;
  context.renderVariableProfitPage({ B5: '2026年', E5: '2025年', H5: '2024年' }, val, makePage);
  assert.match(pages[0][2], /2026年[\s\S]*2025年[\s\S]*2024年/);
  assert.match(pages[0][2], /width:22%/);

  pages.length = 0;
  const simulation = { B4: '実績', C4: '計画A', F4: '計画B', C5: '1', F7: '2', A8: '除外行' };
  context.renderProfitSimulationPage(simulation, val, makePage);
  assert.equal(pages[0][0], '11 / PROFIT SIMULATION');
  assert.match(pages[0][2], /実績[\s\S]*計画A[\s\S]*計画B/);
  assert.doesNotMatch(pages[0][2], /除外行/);
  assert.match(pages[0][2], /row-summary/);
  pages.length = 0;
  context.renderProfitSimulationPage(
    { B4: '実績', C4: '標準C', D4: '標準D', E4: '標準E' },
    val,
    makePage,
  );
  assert.match(pages[0][2], /実績[\s\S]*標準C[\s\S]*標準D[\s\S]*標準E/);

  pages.length = 0;
  const midterm = {
    B4: '第1期',
    D4: '第2期',
    F4: '第3期',
    H4: '第4期',
    A6: '売上',
    B24: '<メモ>\n次行',
  };
  context.renderMidtermFinancialPlanPage(midterm, val, makePage);
  assert.equal(pages[0][0], '12 / MID-TERM FINANCIAL PLAN');
  assert.match(pages[0][2], /第1期[\s\S]*第4期/);
  assert.match(pages[0][2], /font-size:7\.2pt/);
  assert.match(pages[0][2], /&lt;メモ&gt;　次行/);
  assert.match(pages[0][2], /row-summary/);
  pages.length = 0;
  context.renderMidtermFinancialPlanPage({}, val, makePage);
  assert.match(pages[0][2], /font-size:7\.6pt/);
  assert.doesNotMatch(pages[0][2], /検討事項メモ/);
});

test('targets, action plan, and sales pages preserve workbook-driven layouts', () => {
  assert.match(html, /<script src="\.\/src\/page-planning\.js\?v=1\.4\.1"><\/script>/);
  const context = {
    XLSX: { utils: { encode_col: (index) => String.fromCharCode(65 + index) } },
  };
  context.window = context;
  for (const name of ['cell-formatting.js', 'targets.js', 'page-planning.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(root, 'src', name), 'utf8'), context);
  }
  const val = (sheet, address) => sheet[address] || '';
  const pages = [];
  const makePage = (...args) => pages.push(args);

  const targetText = '長文'.repeat(550);
  const targets = {
    B4: '第3年',
    B5: '52400',
    B6: '6000',
    B7: '12',
    B8: targetText,
    A9: '利益率',
    B9: '70%',
    A10: '自由目標2',
  };
  context.renderThreeYearTargetsPage(targets, val, makePage);
  assert.equal(pages.length, 2);
  assert.equal(pages[0][0], '13 / 3-YEAR TARGETS');
  assert.equal(pages[0][1], '3ヵ年 目標設定シート');
  assert.equal(pages[1][1], '3ヵ年 目標設定シート（続き）');
  assert.match(pages[0][2], /目標 売上高/);
  assert.match(pages[0][2], /利益率/);
  assert.match(pages[0][2], /定量目標のみ/);
  assert.doesNotMatch(pages[0][2], /自由目標2/);
  assert.doesNotMatch(pages[1][2], /目標 売上高|定量目標のみ/);
  assert.match(pages[1][2], /定性目標（続き）/);
  pages.length = 0;
  context.renderThreeYearTargetsPage({ B4: '1年', C4: '2年', D4: '3年' }, val, makePage);
  assert.equal(pages.length, 1);
  assert.match(pages[0][2], /1年[\s\S]*2年[\s\S]*3年/);

  pages.length = 0;
  const actionPlan = {
    F5: '(　月)',
    G5: '(特別)',
    B6: '資金繰り改善',
    C6: '毎週確認',
    D6: '田中',
    E6: '佐藤',
    F6: '★完了',
  };
  context.renderActionPlanPage(actionPlan, val, makePage, '2026年4月');
  assert.equal(pages[0][0], '14 / ACTION PLAN');
  assert.match(pages[0][2], /4月[\s\S]*特別[\s\S]*6月/);
  assert.match(pages[0][2], /gantt-star/);
  assert.match(pages[0][2], /資金繰り改善/);
  assert.match(pages[0][2], /責任者/);
  pages.length = 0;
  context.renderActionPlanPage({}, val, makePage, '');
  assert.equal((pages[0][2].match(/<tr>/g) || []).length, 7);
  assert.match(pages[0][2], /font-size:8\.6pt/);
  assert.match(pages[0][2], /1月/);

  pages.length = 0;
  const sales = {
    C4: '第1年',
    F4: '第2年',
    I4: '第3年',
    A6: '主要顧客',
    B6: '継続',
    C6: '120',
    A8: '新規',
    B8: '開拓',
    F8: '80',
    C22: '200',
  };
  context.renderSalesPlanPage(sales, val, makePage);
  assert.equal(pages[0][0], '15 / SALES PLAN');
  assert.match(pages[0][2], /第1年[\s\S]*第3年/);
  assert.match(pages[0][2], /主要顧客/);
  assert.match(pages[0][2], /新規/);
  assert.match(pages[0][2], /合　計/);
  assert.match(pages[0][2], /200/);
  assert.match(pages[0][2], /font-size:9pt/);
  pages.length = 0;
  context.renderSalesPlanPage({}, val, makePage);
  assert.equal((pages[0][2].match(/<tr>/g) || []).length, 5);
  assert.match(pages[0][2], /font-size:9pt/);
});

test('cover and vision image controls and presenter mode remain available', () => {
  assert.match(html, /id="coverLogoInput" accept="image\/\*"/);
  assert.match(html, /id="visionImgInput" accept="image\/\*"/);
  assert.match(html, /id="presentationButton"/);
  assert.match(html, /src="\.\/motion\/player\.js"/);
});

test('cover and vision renderers preserve logo and image layout variants', () => {
  const documentListeners = new Map();
  const coverInput = {
    value: '',
    clickCount: 0,
    click() {
      this.clickCount++;
    },
  };
  const visionInput = {
    value: '',
    clickCount: 0,
    click() {
      this.clickCount++;
    },
  };
  const elements = new Map([
    ['coverPageContainer', { innerHTML: '' }],
    ['visionPageBody', { innerHTML: '' }],
    ['coverLogoInput', coverInput],
    ['visionImgInput', visionInput],
  ]);
  const imageHandlers = new Map();
  const context = {
    document: {
      getElementById: (id) => elements.get(id) || null,
      addEventListener: (name, callback) => documentListeners.set(name, callback),
    },
    clearPrintGuidance() {},
    confirm: () => true,
    esc: (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;'),
    fmtCell: (value, fallback) => value || fallback,
    bindImageDataUrlInput(id, callback) {
      imageHandlers.set(id, callback);
    },
  };
  context.window = context;
  vm.runInNewContext(brandingModuleSource, context);
  const dispatchBrandingAction = (action, value) =>
    documentListeners.get('click')({
      target: {
        closest: () => ({ dataset: { brandingAction: action, value } }),
      },
    });

  context.setCoverPageData({
    company: '会社名',
    rep: '代表',
    term: '7',
    startYM: '2026年4月',
    endYM: '2027年3月',
    pubDate: '2026年4月1日',
    subTitle: '理念の改行\n二行目',
  });
  context.renderCoverPage();
  assert.match(elements.get('coverPageContainer').innerHTML, /表紙ロゴ：未設置/);
  assert.match(
    elements.get('coverPageContainer').innerHTML,
    /data-branding-action="select-cover-image"/,
  );
  assert.match(elements.get('coverPageContainer').innerHTML, /理念の改行/);
  assert.match(elements.get('coverPageContainer').innerHTML, /会社名/);
  dispatchBrandingAction('select-cover-image');
  assert.equal(coverInput.clickCount, 1);
  imageHandlers.get('coverLogoInput')('data:image/png;base64,logo');
  assert.match(elements.get('coverPageContainer').innerHTML, /data:image\/png;base64,logo/);
  dispatchBrandingAction('cover-logo-position', 'left-top');
  assert.match(elements.get('coverPageContainer').innerHTML, /frame-plate/);
  dispatchBrandingAction('cover-logo-position', 'right-bottom');
  assert.match(elements.get('coverPageContainer').innerHTML, /cover-sign-with-logo/);
  dispatchBrandingAction('remove-cover-image');
  assert.equal(elements.get('coverLogoInput').value, '');
  assert.doesNotMatch(elements.get('coverPageContainer').innerHTML, /data:image\/png;base64,logo/);

  context.setVisionPageData({
    mainVis: '10年後の姿',
    subCards: [{ title: '人', body: '成長する' }],
  });
  context.renderVisionBody();
  assert.match(elements.get('visionPageBody').innerHTML, /vision-layout-text-only/);
  dispatchBrandingAction('select-vision-image');
  assert.equal(visionInput.clickCount, 1);
  assert.match(elements.get('visionPageBody').innerHTML, /成長する/);
  imageHandlers.get('visionImgInput')('data:image/png;base64,vision');
  assert.match(elements.get('visionPageBody').innerHTML, /vision-layout-corner/);
  dispatchBrandingAction('vision-layout', 'right-half');
  assert.match(elements.get('visionPageBody').innerHTML, /vision-layout-right-half/);
  dispatchBrandingAction('vision-layout', 'full-bg');
  assert.match(elements.get('visionPageBody').innerHTML, /vision-layout-full-bg/);
  dispatchBrandingAction('vision-layout', 'full-fg');
  assert.match(elements.get('visionPageBody').innerHTML, /fg-caption-bar/);
  dispatchBrandingAction('vision-layout', 'full-fg-only');
  assert.match(elements.get('visionPageBody').innerHTML, /vision-layout-full-fg/);
  assert.doesNotMatch(elements.get('visionPageBody').innerHTML, /fg-caption-bar/);
  dispatchBrandingAction('remove-vision-image');
  assert.equal(elements.get('visionImgInput').value, '');
  assert.match(elements.get('visionPageBody').innerHTML, /vision-layout-text-only/);
});

test('workbook page router dispatches every selected sheet and preserves ordering', () => {
  const calls = [];
  const global = {
    setCoverPageData: (data) => calls.push(['cover-data', data]),
    renderCoverPage: () => calls.push(['cover']),
    setVisionPageData: (data) => calls.push(['vision-data', data]),
    renderVisionBody: () => calls.push(['vision']),
    paginateDenseTables: (container) => {
      calls.push(['paginate', container]);
      return 18;
    },
  };
  const rendererMap = {
    '02_経営姿勢の確立': 'renderStancePage',
    '03_経営理念': 'renderPhilosophyPage',
    '04_長期ビジョン検討': 'renderVisionPlanningPage',
    '06_外部環境分析マクロ': 'renderExternalEnvironmentPage',
    '07_外部環境分析ミクロ': 'renderExternalEnvironmentPage',
    '08_自社の強み弱み': 'renderInternalAnalysisPage',
    '09_経営課題洗出': 'renderCrossSwotPage',
    '10_課題抽出': 'renderStrategicIssuesPage',
    '11_経営方針': 'renderManagementPolicyPage',
    '12_変動損益計算書': 'renderVariableProfitPage',
    '13_利益計画検討表①': 'renderProfitSimulationPage',
    '14_利益資金計画検討表②': 'renderMidtermFinancialPlanPage',
    '15_目標設定': 'renderThreeYearTargetsPage',
    '16_行動計画': 'renderActionPlanPage',
    '17_売上計画': 'renderSalesPlanPage',
  };
  for (const method of new Set(Object.values(rendererMap))) {
    global[method] = (...args) => calls.push([method, ...args]);
  }
  const context = { window: global };
  vm.runInNewContext(workbookPagesModuleSource, context);
  const sheetNames = ['01_表紙', ...Object.keys(rendererMap), '05_長期ビジョン', '欠落シート'];
  const workbook = {
    Sheets: Object.fromEntries(sheetNames.slice(0, -1).map((name) => [name, {}])),
  };
  const values = {
    B11: 'サブタイトル',
    C5: '10年後',
    B6: '人材',
    C6: '成長',
    B7: '地域',
    C7: '',
    B8: '商品',
    C8: '改善',
  };
  const val = (_sheet, address) => values[address] || '';
  const makePage = (...args) => calls.push(['makePage', ...args]);
  const container = { id: 'pages' };
  const renderedPages = global.renderSelectedWorkbookPages({
    selected: sheetNames,
    workbook,
    val,
    makePage,
    container,
    coverData: { company: '会社', startYM: '2026年4月' },
  });
  assert.equal(renderedPages, 18);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), [
    'cover-data',
    { company: '会社', startYM: '2026年4月', subTitle: 'サブタイトル' },
  ]);
  assert.equal(calls[1][0], 'makePage');
  assert.deepEqual(
    calls.filter((call) => call[0] === 'renderExternalEnvironmentPage').map((call) => call[4]),
    ['macro', 'micro'],
  );
  assert.deepEqual(calls.find((call) => call[0] === 'renderActionPlanPage').slice(1, 4), [
    workbook.Sheets['16_行動計画'],
    val,
    makePage,
  ]);
  assert.equal(calls.find((call) => call[0] === 'renderActionPlanPage')[4], '2026年4月');
  const visionData = calls.find((call) => call[0] === 'vision-data')[1];
  assert.deepEqual(JSON.parse(JSON.stringify(visionData)), {
    mainVis: '10年後',
    subCards: [
      { title: '人材', body: '成長' },
      { title: '商品', body: '改善' },
    ],
  });
  assert.deepEqual(calls.at(-1), ['paginate', container]);
  assert.equal(calls.filter((call) => call[0] === 'cover').length, 1);
});

test('workbook controller validates formulas, selects sheets, and finalizes page state', () => {
  const nodes = new Map([
    ['pagesContainer', { innerHTML: '', childElementCount: 0 }],
    ['statusText', { textContent: '' }],
  ]);
  const calls = [];
  const bodyClasses = new Set();
  const workbook = {
    Sheets: {
      '00_出力設定・表紙': {
        B5: '01_表紙',
        D5: '出力する',
        B24: '会社/商事',
        B25: '代表',
        B26: '第7期',
        B27: '2026年4月',
        B28: '2027年3月',
        B29: '2026年4月1日',
      },
      '01_表紙': { B11: '未来へ' },
    },
  };
  const context = {
    FormulaEngine: {
      createCalculationAdapter: () => ({ calculateAll: () => calls.push('calculated') }),
      validateWorkbook: () => [{ status: 'ok' }],
    },
    XLSX: {},
    document: {
      title: '',
      body: { classList: { add: (name) => bodyClasses.add(name) } },
      getElementById: (id) => nodes.get(id) || null,
    },
    alert: (message) => calls.push(['alert', message]),
    scrollTo: (options) => calls.push(['scroll', options]),
    renderCalculationDiagnostics: (results) => calls.push(['diagnostics', results]),
    createWorkbookValueReader: () => (sheet, address) => {
      const value = sheet?.[address];
      return value == null ? '' : String(value);
    },
    createPageFactory: (options) => {
      calls.push(['page-factory', options]);
      return () => {};
    },
    renderSelectedWorkbookPages: (args) => {
      calls.push(['render-pages', args]);
      return 5;
    },
    fitPreviewPages: () => calls.push('fit'),
    updatePrintControls: () => calls.push('controls'),
    esc: (value) => String(value),
  };
  context.window = context;
  vm.runInNewContext(workbookStateModuleSource, context);
  vm.runInNewContext(inputValidationModuleSource, context);
  vm.runInNewContext(workbookControllerModuleSource, context);
  context.renderInputDiagnostics = () => {};
  context.assignAppearanceBlockIds = () => {};
  context.applyAppearanceSettings = () => {};
  context.renderBook(workbook);

  const state = context.workbookState;
  assert.equal(state.activeWorkbook, workbook);
  assert.equal(state.workbookHasErrors, false);
  assert.equal(state.workbookCalculating, false);
  assert.deepEqual(JSON.parse(JSON.stringify(state.formulaResults)), [{ status: 'ok' }]);
  assert.equal(context.document.title, '第7期_会社_商事_経営指針書');
  assert.equal(bodyClasses.has('has-pages'), true);
  assert.equal(nodes.get('statusText').textContent, '確認OK：全 5 ページ出力対象');
  assert.deepEqual(
    calls.filter((call) => typeof call === 'string'),
    ['calculated', 'fit', 'controls'],
  );
  const renderArgs = calls.find((call) => Array.isArray(call) && call[0] === 'render-pages')[1];
  assert.deepEqual(JSON.parse(JSON.stringify(renderArgs.selected)), ['01_表紙']);
  assert.deepEqual(JSON.parse(JSON.stringify(renderArgs.coverData)), {
    company: '会社/商事',
    rep: '代表',
    term: '7',
    startYM: '2026年4月',
    endYM: '2027年3月',
    pubDate: '2026年4月1日',
  });
  assert.equal(
    calls.some((call) => Array.isArray(call) && call[0] === 'alert'),
    false,
  );
});
test('workbook input validation reports missing fields, invalid dates, and inconsistent targets', () => {
  const context = { document: {} };
  context.window = context;
  vm.runInNewContext(inputValidationModuleSource, context);
  const workbook = {
    Sheets: {
      '00_出力設定・表紙': {
        B24: '',
        B26: '0',
        B27: '2026年13月',
        B28: '2026年4月',
        B29: 'not-a-date',
      },
      '15_目標設定': { B5: '100', B6: '120' },
    },
  };
  const val = (sheet, address) => String(sheet?.[address] ?? '');
  const issues = context.validateWorkbookInputs(workbook, val, ['03_経営理念']);
  assert.ok(issues.some((issue) => issue.cell === 'B24' && /会社名/.test(issue.message)));
  assert.ok(issues.some((issue) => issue.cell === 'B26' && /1以上/.test(issue.message)));
  assert.ok(issues.some((issue) => issue.cell === 'B27' && /形式/.test(issue.message)));
  assert.ok(issues.some((issue) => issue.cell === 'B29' && /日付形式/.test(issue.message)));
  assert.ok(issues.some((issue) => issue.sheet === '15_目標設定' && issue.cell === 'B6'));
  assert.ok(issues.every((issue) => issue.severity === 'warning'));
});

test('work file and appearance controls communicate local, unencrypted save and text-only break edits', () => {
  assert.match(html, /id="saveWorkFileButton"/);
  assert.match(html, /id="openWorkFileToolbarButton"/);
  assert.match(html, /id="workFileInput" accept="\.kswork,application\/json"/);
  assert.match(
    fs.readFileSync(path.join(root, 'src/work-file.js'), 'utf8'),
    /パスワードによる暗号化はありません/,
  );
  assert.match(html, /id="resetAllAppearanceButton"/);
  assert.match(fs.readFileSync(path.join(root, 'src/work-file.js'), 'utf8'), /formatVersion = 1/);
  assert.match(
    fs.readFileSync(path.join(root, 'src/appearance-adjustments.js'), 'utf8'),
    /candidate\.replace\(\/\\n\/g, ''\) !== sourceText\.replace\(\/\\n\/g, ''\)/,
  );
});

test('appearance editor can reopen text blocks containing only generated line breaks', () => {
  const source = fs.readFileSync(path.join(root, 'src/appearance-adjustments.js'), 'utf8');
  const context = {
    document: { getElementById: () => null },
    workbookState: {
      appearanceSettings: {
        '03_経営理念|statement': {
          scope: 'block',
          size: 'standard',
          sourceText: '前向きな心を持って日々励む',
          renderedText: '前向きな心を持って\n日々励む',
          lineBreaks: [9],
        },
      },
    },
  };
  context.window = context;
  vm.runInNewContext(source, context);

  const target = {
    dataset: { appearanceKey: '03_経営理念|statement' },
    children: [{ tagName: 'BR' }],
    innerText: '前向きな心を持って\n日々励む',
    matches: () => false,
  };
  assert.equal(context.canEditAppearanceText(target), true);
  assert.equal(
    context.canEditAppearanceText({ ...target, children: [{ tagName: 'STRONG' }] }),
    false,
  );
  assert.equal(context.canEditAppearanceText({ ...target, innerText: '別の文字' }), false);
  assert.equal(
    context.canEditAppearanceText({ ...target, matches: (selector) => selector === 'th' }),
    false,
  );
});

test('cover appearance targets are restored with stable keys after logo rerenders', () => {
  const source = fs.readFileSync(path.join(root, 'src/appearance-adjustments.js'), 'utf8');
  assert.match(
    stylesheet,
    /\.appearance-editing #coverPageContainer \.cover-ctrl-wrap\s*\{\s*display:\s*none/s,
  );
  const coverClasses = ['.cover-title', '.cover-company', '.cover-term-num', '.cover-motto'];
  const makeBlock = () => ({ dataset: {} });
  const makeCoverPage = () => {
    const blocks = new Map(coverClasses.map((selector) => [selector, [makeBlock()]]));
    return {
      dataset: { section: 'COVER' },
      classList: { contains: (name) => name === 'cover-page' },
      querySelector: () => null,
      querySelectorAll(selector) {
        if (selector === '.panel-card, .hero-quote') return [];
        if (selector === '.cover-motto, .panel-body, .hero-quote-text, .vision-text') return [];
        return blocks.get(selector) || [];
      },
      blocks,
    };
  };
  const page = makeCoverPage();
  const container = { querySelectorAll: (selector) => (selector === '.page' ? [page] : []) };
  const context = {
    document: { getElementById: () => null },
    workbookState: { appearanceSettings: {} },
  };
  context.window = context;
  vm.runInNewContext(source, context);

  context.assignAppearanceBlockIds(container);
  assert.equal(page.blocks.get('.cover-title')[0].dataset.appearanceKey, 'COVER|title');
  assert.equal(
    page.blocks.get('.cover-company')[0].dataset.appearanceKey,
    'COVER|company-signature',
  );
  assert.equal(page.blocks.get('.cover-term-num')[0].dataset.appearanceKey, 'COVER|term-number');
  const subtitle = page.blocks.get('.cover-motto')[0];
  assert.equal(subtitle.dataset.appearanceKey, 'COVER|subtitle');
  assert.equal(
    context.canEditAppearanceText({
      dataset: { appearanceKey: subtitle.dataset.appearanceKey },
      children: [],
      matches: () => false,
    }),
    true,
  );

  const rerenderedPage = makeCoverPage();
  context.assignAppearanceBlockIds({
    querySelectorAll: (selector) => (selector === '.page' ? [rerenderedPage] : []),
  });
  assert.equal(rerenderedPage.blocks.get('.cover-title')[0].dataset.appearanceKey, 'COVER|title');
  assert.equal(
    rerenderedPage.blocks.get('.cover-motto')[0].dataset.appearanceKey,
    'COVER|subtitle',
  );
});

test('action plan legend and versioned assets use the revised PDCA symbols', () => {
  const planning = fs.readFileSync(path.join(root, 'src/page-planning.js'), 'utf8');
  assert.match(planning, /●<\/span> 計画（P）/);
  assert.match(planning, /→<\/span> 実施（D）/);
  assert.match(planning, /△<\/span> 評価（C）/);
  assert.match(planning, /gantt-star gantt-star-legend">★<\/span> 改善（A）/);
  assert.match(fs.readFileSync(path.join(root, 'src/cell-formatting.js'), 'utf8'), /text\.startsWith\('⭐'\).*text\.startsWith\('★'\)/s);
  assert.match(html, /page-planning\.js\?v=1\.4\.3/);
  assert.match(html, /appearance-adjustments\.js\?v=1\.4\.4/);
  assert.match(html, /styles\.css\?v=1\.4\.5/);
  assert.match(html, /v1\.4\.5 · 更新日 2026-11-23/);
});

