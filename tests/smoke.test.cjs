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
  assert.match(html, /<link rel="stylesheet" href="\.\/styles\.css">/);
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
  assert.equal(fixedPdfButton.hidden, false);
  context.navigator = { userAgent: 'Mozilla', platform: 'MacIntel', maxTouchPoints: 5 };
  context.configurePrintButtonVisibility();
  assert.equal(printButton.hidden, true);
  assert.equal(fixedPdfButton.hidden, false);

  context.updatePrintControls();
  assert.equal(printButton.disabled, true);
  assert.equal(presentationButton.disabled, true);
  assert.equal(fixedPdfButton.disabled, true);
  context.safePrint();
  assert.equal(printCount, 0);
  assert.match(alerts[0], /数式エラーまたは未検証/);

  context.setPrintState(null, true, false);
  context.safePrint();
  assert.match(alerts[1], /計算中/);

  context.setPrintState({ id: 'workbook' }, false, false);
  context.updatePrintControls();
  assert.equal(printButton.disabled, false);
  assert.equal(presentationButton.disabled, false);
  assert.equal(fixedPdfButton.disabled, false);
  context.safePrint();
  assert.equal(printCount, 1);
  assert.match(status.textContent, /文字を選択・検索・コピー/);
  printButton.clickHandler();
  fixedPdfButton.clickHandler();
  assert.equal(printCount, 3);
  assert.equal(context.canExportPages(), true);
  assert.ok(
    formulaInputs.some((input) => input.hasWorkbook && !input.calculating && !input.hasErrors),
  );

  pages.childElementCount = 0;
  assert.equal(context.canExportPages(), false);
  context.setPrintState({ id: 'workbook' }, false, true);
  eventListeners.get('beforeprint')();
  assert.equal(bodyClasses.has('print-blocked'), true);
  assert.equal(notice.style.display, 'block');
  eventListeners.get('afterprint')();
  assert.equal(bodyClasses.has('print-blocked'), false);
  assert.equal(notice.style.display, 'none');

  assert.doesNotMatch(html, /html2canvas|PDFLib|createFixedPdf/);
});

test('preview scaling and print guidance work in the preview module', () => {
  assert.match(html, /<script src="\.\/src\/preview\.js"><\/script>/);
  const source = fs.readFileSync(path.join(root, 'src/preview.js'), 'utf8');
  const listeners = new Map();
  const scale = [];
  const pages = {
    firstElementChild: {
      firstElementChild: { offsetWidth: 1000 },
      clientWidth: 500,
    },
    style: { setProperty: (...args) => scale.push(args) },
  };
  const printStatus = { textContent: '古い案内' };
  const context = {
    document: {
      getElementById(id) {
        return id === 'pagesContainer' ? pages : printStatus;
      },
    },
    addEventListener(name, callback) {
      listeners.set(name, callback);
    },
  };
  context.window = context;
  vm.runInNewContext(source, context);
  context.fitPreviewPages();
  assert.deepEqual(scale[0], ['--preview-scale', 0.5]);
  context.clearPrintGuidance();
  assert.equal(printStatus.textContent, '');

  pages.firstElementChild.firstElementChild.offsetWidth = 400;
  pages.firstElementChild.clientWidth = 600;
  context.fitPreviewPages();
  assert.deepEqual(scale[1], ['--preview-scale', 1]);

  const fallbackContext = {
    document: { getElementById: () => pages },
    addEventListener(name, callback) {
      listeners.set(name, callback);
    },
  };
  fallbackContext.window = fallbackContext;
  vm.runInNewContext(source, fallbackContext);
  assert.equal(listeners.has('resize'), true);
  pages.firstElementChild = null;
  assert.doesNotThrow(() => fallbackContext.fitPreviewPages());
});

test('three-year target narratives keep their page split and typography rules', () => {
  assert.match(html, /<script src="\.\/src\/targets\.js"><\/script>/);
  const source = fs.readFileSync(path.join(root, 'src/targets.js'), 'utf8');
  const context = { Array, String };
  context.window = context;
  vm.runInNewContext(source, context);

  assert.deepEqual(Array.from(context.splitTargetNarrative('')), ['']);
  assert.deepEqual(Array.from(context.splitTargetNarrative('abcdef\nxyz', 8)), ['abcdef\n', 'xyz']);
  assert.deepEqual(Array.from(context.splitTargetNarrative('abcdefghij', 4)), [
    'abcd',
    'efgh',
    'ij',
  ]);
  assert.equal(context.targetNarrativeStyle('あ'.repeat(200)).includes('9.5pt'), true);
  assert.equal(context.targetNarrativeStyle('あ'.repeat(201)).includes('8.6pt'), true);
  assert.equal(context.targetNarrativeStyle('あ'.repeat(301)).includes('8pt'), true);
});

test('dense-table pagination preserves grouped rows and section limits', () => {
  assert.match(html, /<script src="\.\/src\/table-pagination\.js"><\/script>/);
  assert.match(html, /<script src="\.\/src\/workbook-pages\.js"><\/script>/);
  const source = fs.readFileSync(path.join(root, 'src/table-pagination.js'), 'utf8');
  const context = { Math };
  context.window = context;
  vm.runInNewContext(source, context);

  assert.equal(context.getDenseTableRowLimit('MACRO ENVIRONMENT'), 8);
  assert.equal(context.getDenseTableRowLimit('MICRO ENVIRONMENT'), 12);
  assert.equal(context.getDenseTableRowLimit('STRATEGIC ISSUES'), 8);
  assert.equal(context.getDenseTableRowLimit('SALES PLAN'), 12);
  assert.equal(context.getDenseTableRowLimit('OTHER'), 20);
  assert.deepEqual(
    { ...context.getDenseTableTypography('STRATEGIC ISSUES', 4) },
    {
      fontSize: '8.8pt',
      lineHeight: '1.45',
    },
  );
  assert.deepEqual(
    { ...context.getDenseTableTypography('STRATEGIC ISSUES', 8) },
    {
      fontSize: '8.2pt',
      lineHeight: '1.45',
    },
  );
  assert.deepEqual(
    { ...context.getDenseTableTypography('MACRO ENVIRONMENT', 6) },
    {
      fontSize: '9.5pt',
      lineHeight: '1.55',
    },
  );
  assert.deepEqual(
    { ...context.getDenseTableTypography('MACRO ENVIRONMENT', 8) },
    {
      fontSize: '9pt',
      lineHeight: '1.4',
    },
  );
  assert.deepEqual(
    { ...context.getDenseTableTypography('MACRO ENVIRONMENT', 9) },
    {
      fontSize: '8.2pt',
      lineHeight: '1.4',
    },
  );

  const row = (id, rowSpan = 1) => ({
    id,
    cells: [
      {
        rowSpan,
        classList: { contains: (name) => name === 'cat-cell' && rowSpan > 1 },
      },
    ],
  });
  const rows = [row('a', 2), row('b'), row('c'), row('d'), row('e')];
  const chunks = context.chunkDenseTableRows(rows, 3);
  assert.deepEqual(
    Array.from(chunks, (chunk) => Array.from(chunk, (item) => item.id)),
    [
      ['a', 'b'],
      ['c', 'd', 'e'],
    ],
  );
  assert.deepEqual(
    Array.from(context.chunkDenseTableRows(rows, 20), (chunk) =>
      Array.from(chunk, (item) => item.id),
    ),
    [['a', 'b', 'c', 'd', 'e']],
  );
  const groupedRows = [
    ...Array.from({ length: 3 }, (_, index) => row(`a${index}`, index === 0 ? 3 : 1)),
    ...Array.from({ length: 6 }, (_, index) => row(`b${index}`, index === 0 ? 6 : 1)),
    ...Array.from({ length: 2 }, (_, index) => row(`c${index}`, index === 0 ? 2 : 1)),
    ...Array.from({ length: 4 }, (_, index) => row(`d${index}`, index === 0 ? 4 : 1)),
  ];
  assert.deepEqual(
    Array.from(context.chunkDenseTableRows(groupedRows, 12), (chunk) => chunk.length),
    [9, 6],
  );
  const cell = (label, rowSpan, isCategory) => ({
    label,
    rowSpan,
    classList: { contains: (name) => name === 'cat-cell' && isCategory },
    cloneNode: () => cell(label, rowSpan, isCategory),
  });
  const domRow = (label, categoryCell) => ({
    cells: [categoryCell || cell(label, 1, false)],
    cloneNode() {
      return domRow(label, this.cells[0].cloneNode(true));
    },
    insertBefore(newCell, beforeCell) {
      this.cells.splice(this.cells.indexOf(beforeCell), 0, newCell);
    },
  });
  const categoryRows = [];
  for (const [label, size] of [
    ['市場・顧客', 3],
    ['競合・新規参入', 6],
    ['成長性・収益性', 2],
    ['立地環境', 2],
  ]) {
    for (let index = 0; index < size; index++) {
      categoryRows.push(
        domRow(`row-${categoryRows.length}`, index === 0 ? cell(label, size, true) : null),
      );
    }
  }
  const balancedChunks = context.balanceDenseTableRows(categoryRows, 12);
  assert.deepEqual(
    Array.from(balancedChunks, (chunk) => chunk.length),
    [7, 6],
  );
  assert.equal(balancedChunks[1][0].cells[0].label, '競合・新規参入');
  assert.equal(balancedChunks[1][0].cells[0].rowSpan, 2);
  const pageNumbers = [{ textContent: '' }, { textContent: '' }, null];
  const pages = pageNumbers.map((number) => ({
    querySelector: () => number && number,
  }));
  assert.equal(context.renumberDenseTablePages(pages), 3);
  assert.deepEqual(
    pageNumbers.slice(0, 2).map((number) => number.textContent),
    ['01 / 03', '02 / 03'],
  );
});

test('shared cell formatting escapes data and preserves badge and marker rules', () => {
  assert.match(html, /<script src="\.\/src\/cell-formatting\.js"><\/script>/);
  const source = fs.readFileSync(path.join(root, 'src/cell-formatting.js'), 'utf8');
  const context = {};
  context.window = context;
  vm.runInNewContext(source, context);
  assert.equal(context.esc('<x & y>'), '&lt;x &amp; y&gt;');
  assert.equal(context.fmtCell(' <script> '), '&lt;script&gt;');
  assert.equal(context.fmtCell(''), '<span class="empty-dash">—</span>');
  assert.equal(context.fmtNum('-12'), '<span style="color:#c5221f;">-12</span>');
  assert.equal(context.fmtNum('0'), '0');
  assert.match(context.impactBadge('両面（機会と脅威）'), /badge-both/);
  assert.match(context.impactBadge('機会 <A>'), /badge-opp/);
  assert.match(context.ganttMark('★完了'), /gantt-star/);
  assert.match(context.ganttMark('未分類 &'), /未分類 &amp;/);
});

test('dynamic table and card layouts preserve grouping and compactness rules', () => {
  assert.match(html, /<script src="\.\/src\/dynamic-layout\.js"><\/script>/);
  const context = {};
  context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/cell-formatting.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/dynamic-layout.js'), 'utf8'), context);

  const table = context.buildDynamicCatTable(
    [
      { cat: '<A>', hasData: true, cellsHTML: '<td>1</td>' },
      { cat: '<A>', hasData: true, cellsHTML: '<td>2</td>' },
      { cat: '空欄', hasData: false, cellsHTML: '<td>3</td>' },
    ],
    '<colgroup></colgroup>',
    '<thead></thead>',
  );
  assert.match(table, /rowspan="2" class="cat-cell">&lt;A&gt;/);
  assert.doesNotMatch(table, /空欄/);
  assert.match(table, /font-size:9\.5pt/);

  const cards = context.buildDynamicCardGrid([
    { title: '<one>', body: '本文' },
    { title: '空', body: '' },
  ]);
  assert.match(cards, /cols-1 rows-1/);
  assert.match(cards, /&lt;one&gt;/);
  assert.doesNotMatch(cards, />空</);
  assert.match(context.buildDynamicCardGrid([{ title: '未入力', body: '' }]), /（未入力）/);
});

test('workbook value reader formats literals and evaluated formulas', () => {
  assert.match(html, /<script src="\.\/src\/workbook-values\.js"><\/script>/);
  const source = fs.readFileSync(path.join(root, 'src/workbook-values.js'), 'utf8');
  const calls = [];
  const worksheet = {
    A1: { v: 1234, z: '#,##0' },
    A2: { f: '1+2', z: '0.00' },
    A3: { v: null },
    A4: { f: 'NO_SHEET' },
  };
  const workbook = { SheetNames: ['Main'], Sheets: { Main: worksheet } };
  const context = {
    FormulaEngine: null,
    document: null,
  };
  context.window = context;
  vm.runInNewContext(source, context);
  const reader = context.createWorkbookValueReader(
    workbook,
    { evaluateCell: (...args) => (calls.push(args), 3) },
    { formatValue: (value, format, xlsx) => `${value}|${format}|${xlsx}` },
    'XLSX',
  );
  assert.equal(reader(worksheet, 'A1'), '1234|#,##0|XLSX');
  assert.equal(reader(worksheet, 'A2'), '3|0.00|XLSX');
  assert.equal(reader(worksheet, 'A3'), '');
  assert.equal(reader(null, 'A1'), '');
  assert.equal(reader(worksheet, 'A9'), '');
  assert.equal(reader(worksheet, 'A4'), '3|General|XLSX');
  assert.equal(reader({ A1: { f: '1+2' } }, 'A1'), '');
  assert.deepEqual(calls, [
    ['Main', 'A2'],
    ['Main', 'A4'],
  ]);
});

test('shared image input reads data URLs and skips empty selections', () => {
  assert.match(html, /<script src="\.\/src\/image-upload\.js"><\/script>/);
  const source = fs.readFileSync(path.join(root, 'src/image-upload.js'), 'utf8');
  const listeners = new Map();
  const readers = [];
  const input = { addEventListener: (name, callback) => listeners.set(name, callback) };
  const context = {
    FileReader: class {
      readAsDataURL(file) {
        this.file = file;
        readers.push(this);
      }
    },
    document: { getElementById: (id) => (id === 'image' ? input : null) },
  };
  context.window = context;
  vm.runInNewContext(source, context);
  const loaded = [];
  context.bindImageDataUrlInput('image', (dataUrl) => loaded.push(dataUrl));
  const onChange = listeners.get('change');
  onChange({ target: { files: [] } });
  assert.equal(readers.length, 0);
  const file = { name: 'logo.png' };
  onChange({ target: { files: [file] } });
  assert.equal(readers[0].file, file);
  readers[0].onload({ target: { result: 'data:image/png;base64,AA==' } });
  assert.deepEqual(loaded, ['data:image/png;base64,AA==']);
  assert.doesNotThrow(() => context.bindImageDataUrlInput('missing', () => {}));
});

test('page factory preserves cover and standard page structure and numbering', () => {
  assert.match(html, /<script src="\.\/src\/page-factory\.js"><\/script>/);
  const source = fs.readFileSync(path.join(root, 'src/page-factory.js'), 'utf8');
  const pages = [];
  const document = {
    createElement() {
      return {
        dataset: {},
        append(child) {
          this.child = child;
        },
      };
    },
  };
  const container = { append: (slot) => pages.push(slot) };
  const context = {};
  context.window = context;
  vm.runInNewContext(source, context);
  const makePage = context.createPageFactory({
    document,
    container,
    company: '<会社>',
    term: '7',
    total: 2,
    escapeHtml: (value) => String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  });
  makePage('COVER', '表紙', '', true, 'coverPageContainer');
  makePage('01 / TEST', '標準ページ', '<p>本文</p>', false, 'body');
  assert.equal(pages[0].className, 'page-slot');
  assert.equal(pages[0].child.className, 'page cover-page');
  assert.equal(pages[0].child.id, 'coverPageContainer');
  assert.equal(pages[1].child.className, 'page');
  assert.match(pages[1].child.innerHTML, /&lt;会社&gt;/);
  assert.match(pages[1].child.innerHTML, /02 \/ 02/);
  assert.match(pages[1].child.innerHTML, /<div class="page-body" id="body">/);
});

test('management stance page renders the existing grouped questions', () => {
  assert.match(html, /<script src="\.\/src\/page-stance\.js"><\/script>/);
  const context = {};
  context.window = context;
  for (const name of ['cell-formatting.js', 'dynamic-layout.js', 'page-stance.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(root, 'src', name), 'utf8'), context);
  }
  const worksheet = {};
  for (let row = 5; row <= 10; row++) {
    worksheet[`B${row}`] = row === 5 ? '<項目>' : `項目${row}`;
    worksheet[`C${row}`] = row === 10 ? '' : `回答${row}`;
  }
  const pages = [];
  context.renderStancePage(
    worksheet,
    (sheet, address) => sheet[address] || '',
    (...args) => pages.push(args),
  );
  assert.equal(pages.length, 1);
  assert.equal(pages[0][0], '01 / STANCE');
  assert.equal(pages[0][1], '経営姿勢の確立（科学性・社会性・人間性）');
  assert.match(pages[0][2], /rowspan="2" class="cat-cell">Ⅰ\. マーケティングの立場（科学性）/);
  assert.match(pages[0][2], /&lt;項目&gt;/);
  assert.doesNotMatch(pages[0][2], /項目10/);
  assert.match(pages[0][2], /自社の経営姿勢/);
});

test('philosophy and vision planning pages preserve their content variants', () => {
  assert.match(html, /<script src="\.\/src\/page-foundation\.js"><\/script>/);
  const context = {};
  context.window = context;
  for (const name of ['cell-formatting.js', 'dynamic-layout.js', 'page-foundation.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(root, 'src', name), 'utf8'), context);
  }
  const pageCalls = [];
  const makePage = (...args) => pageCalls.push(args);
  const values = { C5: '<理念>', C6: '背景 & 解説' };
  const val = (sheet, address) => sheet[address] || '';
  context.renderPhilosophyPage(values, val, makePage);
  assert.equal(pageCalls[0][0], '02 / PHILOSOPHY');
  assert.match(pageCalls[0][2], /&lt;理念&gt;/);
  assert.match(pageCalls[0][2], /背景 &amp; 解説/);
  pageCalls.length = 0;
  context.renderPhilosophyPage({ C5: '' }, val, makePage);
  assert.match(pageCalls[0][2], /（経営理念を入力してください）/);
  assert.doesNotMatch(pageCalls[0][2], /narrative-box/);

  pageCalls.length = 0;
  context.renderVisionPlanningPage({ A5: 'テーマ', B5: '地域', C5: '内容' }, val, makePage);
  assert.equal(pageCalls[0][0], '03 / VISION WORK');
  assert.match(pageCalls[0][2], /テーマ：地域/);
  assert.match(pageCalls[0][2], /内容/);
});

test('macro and micro environment pages keep their different ranges and labels', () => {
  assert.match(html, /<script src="\.\/src\/page-environment\.js"><\/script>/);
  const context = {};
  context.window = context;
  for (const name of ['cell-formatting.js', 'dynamic-layout.js', 'page-environment.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(root, 'src', name), 'utf8'), context);
  }
  const worksheet = {};
  for (let row = 5; row <= 19; row++) {
    worksheet[`A${row}`] = '【政治】';
    worksheet[`B${row}`] = '●項目';
    worksheet[`C${row}`] = '予測 & 傾向';
    worksheet[`D${row}`] = '両面';
  }
  const pages = [];
  const val = (sheet, address) => sheet[address] || '';
  const makePage = (...args) => pages.push(args);
  context.renderExternalEnvironmentPage(worksheet, val, makePage, 'macro');
  context.renderExternalEnvironmentPage(worksheet, val, makePage, 'micro');
  assert.equal(pages[0][0], '04 / MACRO ENVIRONMENT');
  assert.equal(pages[1][0], '05 / MICRO ENVIRONMENT');
  assert.match(pages[0][2], /rowspan="10"/);
  assert.match(pages[1][2], /rowspan="15"/);
  assert.match(pages[0][2], /width:14%/);
  assert.match(pages[1][2], /width:15%/);
  assert.match(pages[0][2], /世の中の動向/);
  assert.match(pages[1][2], /業界・顧客・競合/);
  assert.match(pages[0][2], /予測 &amp; 傾向/);
  assert.match(pages[0][2], />項目</);
});

test('internal analysis and cross-SWOT pages preserve cleanup and display rules', () => {
  assert.match(html, /<script src="\.\/src\/page-analysis\.js"><\/script>/);
  const context = {};
  context.window = context;
  for (const name of ['cell-formatting.js', 'dynamic-layout.js', 'page-analysis.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(root, 'src', name), 'utf8'), context);
  }
  const worksheet = {};
  for (let row = 5; row <= 32; row++) {
    worksheet[`A${row}`] = '【人】\n補足';
    worksheet[`B${row}`] = row === 5 ? '●評価項目' : `項目${row}`;
    worksheet[`C${row}`] = row === 5 ? '<強み>' : '';
    worksheet[`D${row}`] = row === 5 ? '弱み &' : '';
  }
  const pages = [];
  const makePage = (...args) => pages.push(args);
  const val = (sheet, address) => sheet[address] || '';
  context.renderInternalAnalysisPage(worksheet, val, makePage);
  assert.equal(pages[0][0], '06 / INTERNAL ANALYSIS');
  assert.match(pages[0][2], /rowspan="1" class="cat-cell">人/);
  assert.match(pages[0][2], /&lt;強み&gt;/);
  assert.match(pages[0][2], /弱み &amp;/);
  assert.doesNotMatch(pages[0][2], /補足/);

  pages.length = 0;
  const swot = {
    A5: '強み\nS',
    B5: '機会',
    C5: '【E：拡大】',
    A6: '弱み\nW',
    B6: '脅威',
    C6: '改善内容',
  };
  context.renderCrossSwotPage(swot, val, makePage);
  assert.equal(pages[0][0], '07 / CROSS SWOT');
  assert.match(pages[0][2], /弱み W × 脅威/);
  assert.doesNotMatch(pages[0][2], /強み S × 機会/);
  assert.doesNotMatch(pages[0][2], /【E：拡大】/);
  assert.match(pages[0][2], /改善内容/);
  pages.length = 0;
  context.renderCrossSwotPage({ C5: '【E：拡大】' }, val, makePage);
  assert.match(pages[0][2], /（対策未記入）/);
});

test('strategic issues and management policy pages preserve row selection and formatting', () => {
  assert.match(html, /<script src="\.\/src\/page-priorities\.js"><\/script>/);
  const context = {};
  context.window = context;
  for (const name of ['cell-formatting.js', 'page-priorities.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(root, 'src', name), 'utf8'), context);
  }
  const val = (sheet, address) => sheet[address] || '';
  const pageCalls = [];
  const makePage = (...args) => pageCalls.push(args);
  const issues = {};
  for (let row = 5; row <= 10; row++) {
    issues[`B${row}`] = `課題${row}`;
    issues[`C${row}`] = `効果${row}`;
    for (const column of ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']) {
      issues[`${column}${row}`] = String(row - 4);
    }
  }
  context.renderStrategicIssuesPage(issues, val, makePage);
  const issuePage = pageCalls.at(-1);
  assert.equal(issuePage[0], '08 / STRATEGIC ISSUES');
  assert.match(issuePage[2], /font-size:8\.4pt/);
  assert.match(issuePage[2], /課題5/);
  assert.match(issuePage[2], /課題10/);
  assert.match(issuePage[2], /<td class="ctr item-cell">6<\/td>/);
  assert.match(issuePage[2], /font-weight:800;color:var\(--accent\)/);
  context.renderStrategicIssuesPage({}, val, makePage);
  const fallbackIssuePage = pageCalls.at(-1);
  assert.match(fallbackIssuePage[2], /font-size:9\.2pt/);
  assert.match(fallbackIssuePage[2], /<td class="ctr item-cell">3<\/td>/);

  const policies = {};
  for (let row = 5; row <= 9; row++) {
    policies[`B${row}`] = `方針${row}`;
    policies[`C${row}`] = `具体策${row}\n詳細`;
  }
  context.renderManagementPolicyPage(policies, val, makePage);
  const policyPage = pageCalls.at(-1);
  assert.equal(policyPage[0], '09 / MANAGEMENT POLICY');
  assert.match(policyPage[2], /font-size:8\.8pt/);
  assert.match(policyPage[2], /方針 5/);
  assert.match(policyPage[2], /具体策9\n詳細/);
  context.renderManagementPolicyPage({}, val, makePage);
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
  assert.match(html, /<script src="\.\/src\/page-planning\.js"><\/script>/);
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
  vm.runInNewContext(workbookControllerModuleSource, context);
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

