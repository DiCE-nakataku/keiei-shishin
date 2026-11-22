(function (global) {
  function setUploadFeedback(message, isError = false) {
    const feedback = global.document.getElementById('uploadFeedback');
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.toggle('is-error', isError);
    feedback.hidden = !message;
  }

  function handleExcelFile(file, options = {}) {
    if (!file) {
      setUploadFeedback('Excelファイルが選択されませんでした。もう一度選択してください。', true);
      return;
    }
    if (/\.kswork$/i.test(file.name) && !options.fromWorkFile) {
      global.openWorkFile(file);
      return;
    }
    const state = global.workbookState;
    if (
      state.activeWorkbook &&
      state.workFileDirty &&
      !options.skipConfirmation &&
      !global.confirm('保存していない作業があります。Excelを差し替えて続けますか？')
    ) {
      return;
    }
    state.workbookWasReplaced = Boolean(state.activeWorkbook);
    const statusEl = global.document.getElementById('statusText');
    if (!global.XLSX || !global.FormulaEngine) {
      const message =
        'Excel読み込みライブラリを読み込めませんでした。ページを再読み込みしてください。';
      statusEl.textContent = 'ライブラリ読込エラー';
      setUploadFeedback(message, true);
      global.console.error(message, {
        sheetjs: Boolean(global.XLSX),
        formulaEngine: Boolean(global.FormulaEngine),
      });
      return;
    }
    global.clearPrintGuidance();
    global.workbookState.activeWorkbook = null;
    global.workbookState.workbookCalculating = true;
    global.updatePrintControls();
    statusEl.textContent = 'ファイルを読み込み中...';
    setUploadFeedback(`「${file.name}」を読み込んでいます...`);
    const reader = new global.FileReader();
    reader.onload = function (event) {
      try {
        state.sourceWorkbookBytes = new Uint8Array(event.target.result);
        state.sourceFileName = file.name;
        global.markWorkFileDirty?.();
        if (!global.markWorkFileDirty) state.workFileDirty = true;
        const workbook = global.FormulaEngine.parseWorkbook(
          new Uint8Array(event.target.result),
          global.XLSX,
        );
        statusEl.textContent = '計算中...';
        setUploadFeedback('Excelの数式を計算してページを作成しています...');
        global.setTimeout(() => {
          try {
            global.renderBook(workbook);
          } catch (error) {
            global.workbookState.workbookHasErrors = true;
            global.workbookState.workbookCalculating = false;
            global.updatePrintControls();
            statusEl.textContent = '計算エラーが発生しました';
            setUploadFeedback(`ページ作成に失敗しました: ${error.message || error}`, true);
            global.console.error(error);
          }
        }, 0);
      } catch (error) {
        global.workbookState.workbookCalculating = false;
        global.updatePrintControls();
        global.console.error(error);
        statusEl.textContent = '読み込みエラーが発生しました';
        setUploadFeedback(`Excelを解析できませんでした: ${error.message || error}`, true);
      }
    };
    reader.onerror = function () {
      global.workbookState.workbookCalculating = false;
      global.updatePrintControls();
      statusEl.textContent = 'ファイル読込失敗';
      setUploadFeedback(
        'ファイルの読み込みに失敗しました。別の場所から保存し直して再度お試しください。',
        true,
      );
    };
    reader.onabort = function () {
      global.workbookState.workbookCalculating = false;
      global.updatePrintControls();
      statusEl.textContent = 'ファイル読込を中断しました';
      setUploadFeedback('ファイルの読み込みが中断されました。もう一度選択してください。', true);
    };
    if (options.project) state.pendingWorkProject = options.project;
    reader.readAsArrayBuffer(file);
  }

  function handleExcelSelection(event) {
    const file = event.currentTarget.files && event.currentTarget.files[0];
    if (!file) return;
    const fileKey = `${file.name}:${file.size}:${file.lastModified}`;
    if (fileKey === lastHandledExcelKey) return;
    lastHandledExcelKey = fileKey;
    handleExcelFile(file);
  }

  function resetToTop() {
    global.clearPrintGuidance();
    global.workbookState.activeWorkbook = null;
    global.workbookState.sourceWorkbookBytes = null;
    global.workbookState.sourceFileName = '';
    global.workbookState.pendingWorkProject = null;
    global.workbookState.workbookWasReplaced = false;
    global.workbookState.shouldReportMapping = false;
    global.workbookState.appearanceSettings = {};
    global.setBrandingState?.({});
    global.applyTheme?.('');
    global.workbookState.inputValidationResults = [];
    global.workbookState.workFileDirty = false;
    global.markWorkFileClean?.();
    global.document.body.classList.remove('has-pages');
    global.document.getElementById('pagesContainer').innerHTML = '';
    global.document.getElementById('inputDiagnostics')?.replaceChildren();
    if (global.document.getElementById('inputDiagnostics')) {
      global.document.getElementById('inputDiagnostics').hidden = true;
    }
    global.updatePrintControls();
    global.document.getElementById('statusText').textContent = 'Excelファイルを選択してください';
    setUploadFeedback('');
    global.document.title = '経営指針書 自動レイアウト＆A4横PDF出力ツール';
    global.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const excelInput = global.document.getElementById('excelInput');
  let lastHandledExcelKey = '';
  if (excelInput) {
    excelInput.addEventListener('click', function () {
      this.value = '';
      lastHandledExcelKey = '';
      setUploadFeedback('ファイル選択ダイアログでExcelを選び、「開く」を押してください。');
    });
    excelInput.addEventListener('input', handleExcelSelection);
    excelInput.addEventListener('change', handleExcelSelection);
  }
  global.document.getElementById('uploadCtaButton')?.addEventListener('click', () => {
    excelInput?.click();
  });
  global.document.querySelector('.btn-reselect')?.addEventListener('click', () => {
    if (excelInput) excelInput.value = '';
  });
  global.document.querySelector('.btn-back-top')?.addEventListener('click', resetToTop);

  // Some browser/file-picker combinations return focus without delivering change promptly.
  // Check the native input after the picker closes; the file key prevents duplicate reads.
  global.addEventListener('focus', function () {
    global.setTimeout(function () {
      if (excelInput?.files && excelInput.files[0]) {
        handleExcelSelection({ currentTarget: excelInput });
      } else if (!global.document.body.classList.contains('has-pages')) {
        const feedback = global.document.getElementById('uploadFeedback');
        if (feedback && feedback.textContent.includes('ファイル選択ダイアログ')) {
          setUploadFeedback(
            'ファイルが選択されませんでした。Excelを選び、「開く」を押してください。',
            true,
          );
        }
      }
    }, 120);
  });

  global.setUploadFeedback = setUploadFeedback;
  global.handleExcelFile = handleExcelFile;
  global.handleExcelSelection = handleExcelSelection;
  global.resetToTop = resetToTop;
})(window);
