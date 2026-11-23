(function (global) {
  const formatId = 'keiei-shishin-work';
  const formatVersion = 1;
  const maxWorkFileBytes = 80 * 1024 * 1024;
  let saveNoticeAcknowledged = false;

  function updateWorkFileStatus(message) {
    const status = global.document.getElementById('workFileStatus');
    if (status)
      status.textContent =
        message || (global.workbookState.workFileDirty ? '未保存の変更があります' : '');
  }

  global.markWorkFileDirty = () => {
    global.workbookState.workFileDirty = true;
    updateWorkFileStatus();
  };
  global.markWorkFileClean = (message = '') => {
    global.workbookState.workFileDirty = false;
    updateWorkFileStatus(message);
  };

  function encodeBytes(bytes) {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return global.btoa(binary);
  }

  function decodeBytes(value) {
    const binary = global.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function safeName(value) {
    return String(value || '経営指針書')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
      .slice(0, 60);
  }

  function currentBranding() {
    return global.getBrandingState?.() || {};
  }

  function getSuggestedName() {
    const workbook = global.workbookState.activeWorkbook;
    const val = global.createWorkbookValueReader(
      workbook,
      global.workbookState.calculationAdapter,
      global.FormulaEngine,
      global.XLSX,
    );
    const cover = workbook.Sheets['00_出力設定・表紙'];
    const company = safeName(val(cover, 'B24').trim() || '経営指針書');
    const term = safeName(val(cover, 'B26').trim());
    return `${company}${term ? `_第${term}期` : ''}_作業ファイル.kswork`;
  }

  function saveWorkFile() {
    const state = global.workbookState;
    if (!state.activeWorkbook || !state.sourceWorkbookBytes) return;
    if (!saveNoticeAcknowledged) {
      const accepted = global.confirm(
        '作業ファイルには元のExcelと追加した画像、見た目の設定が含まれます。パスワードによる暗号化はありません。共有・保存先に注意して保管してください。保存を続けますか？',
      );
      if (!accepted) return;
      saveNoticeAcknowledged = true;
    }
    const file = {
      format: formatId,
      version: formatVersion,
      template: 'keiei-shishin-template',
      createdAt: new Date().toISOString(),
      sourceFileName: state.sourceFileName || 'input.xlsx',
      workbookBase64: encodeBytes(state.sourceWorkbookBytes),
      appearanceSettings: state.appearanceSettings || {},
      branding: currentBranding(),
      theme: global.document.getElementById('toolbarThemeSelect')?.value || '',
    };
    const blob = new global.Blob([JSON.stringify(file)], {
      type: 'application/json;charset=utf-8',
    });
    if (blob.size > maxWorkFileBytes) {
      global.alert('作業ファイルが大きすぎます。画像のサイズを小さくしてから保存してください。');
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = global.document.createElement('a');
    anchor.href = url;
    anchor.download = getSuggestedName();
    anchor.click();
    global.setTimeout(() => URL.revokeObjectURL(url), 1000);
    global.markWorkFileClean(
      '作業ファイルのダウンロードを開始しました。保存先を確認してください。',
    );
    global.document.getElementById('statusText').textContent =
      '作業ファイルのダウンロードを開始しました。保存先を確認してください。';
  }

  function safeBranding(branding) {
    const safeImage = (value) => {
      if (!value) return null;
      if (typeof value !== 'string' || value.length > 20 * 1024 * 1024) return null;
      return /^data:image\/(?:png|jpeg|svg\+xml);base64,[a-z\d+/=]+$/i.test(value) ? value : null;
    };
    return {
      coverLogoDataUrl: safeImage(branding.coverLogoDataUrl),
      coverLogoPos: branding.coverLogoPos,
      coverLogoFrame: branding.coverLogoFrame,
      visionImageDataUrl: safeImage(branding.visionImageDataUrl),
      visionLayoutMode: branding.visionLayoutMode,
    };
  }

  function safeAppearanceSettings(settings) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {};
    return Object.fromEntries(
      Object.entries(settings)
        .slice(0, 500)
        .filter(
          ([key, value]) =>
            key.length <= 300 &&
            value &&
            typeof value === 'object' &&
            ['block', 'row', 'box'].includes(value.scope) &&
            ['small', 'standard', 'large'].includes(value.size),
        )
        .map(([key, value]) => {
          const clean = { scope: value.scope, size: value.size };
          if (['auto', 'fade', 'rise', 'none'].includes(value.motion)) {
            clean.motion = value.motion;
          }
          if (
            Array.isArray(value.lineBreaks) &&
            value.lineBreaks.length <= 100 &&
            value.lineBreaks.every(
              (offset) => Number.isInteger(offset) && offset >= 0 && offset <= 20000,
            ) &&
            typeof value.sourceText === 'string' &&
            value.sourceText.length <= 20000 &&
            typeof value.renderedText === 'string' &&
            value.renderedText.length <= 20000
          ) {
            clean.lineBreaks = value.lineBreaks;
            clean.sourceText = value.sourceText;
            clean.renderedText = value.renderedText;
          }
          return [key, clean];
        }),
    );
  }

  function openWorkFile(file) {
    if (!file) return;
    const state = global.workbookState;
    if (
      state.activeWorkbook &&
      state.workFileDirty &&
      !global.confirm('保存していない変更があります。作業ファイルを開いて続けますか？')
    ) {
      return;
    }
    if (file.size > maxWorkFileBytes) {
      global.alert('作業ファイルのサイズが上限を超えています。');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const project = JSON.parse(String(reader.result));
        if (project.format !== formatId || project.version !== formatVersion) {
          throw new Error('この作業ファイルのバージョンには対応していません。');
        }
        if (
          project.template !== 'keiei-shishin-template' ||
          typeof project.workbookBase64 !== 'string' ||
          project.workbookBase64.length > maxWorkFileBytes
        ) {
          throw new Error('作業ファイルの内容を確認できませんでした。');
        }
        const bytes = decodeBytes(project.workbookBase64);
        const workbookFile = new global.File(
          [bytes],
          safeName(project.sourceFileName || 'input.xlsx'),
          {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        );
        const pending = {
          appearanceSettings: safeAppearanceSettings(project.appearanceSettings),
          branding: safeBranding(project.branding || {}),
          theme: ['theme-green', 'theme-slate'].includes(project.theme) ? project.theme : '',
        };
        global.handleExcelFile(workbookFile, { skipConfirmation: true, project: pending });
      } catch (error) {
        state.pendingWorkProject = null;
        global.setUploadFeedback(`作業ファイルを開けませんでした：${error.message || error}`, true);
      }
    };
    reader.onerror = () => {
      state.pendingWorkProject = null;
      global.setUploadFeedback('作業ファイルを読み込めませんでした。', true);
    };
    reader.readAsText(file);
  }

  global.document.getElementById('saveWorkFileButton')?.addEventListener('click', saveWorkFile);
  global.document.getElementById('openWorkFileButton')?.addEventListener('click', () => {
    global.document.getElementById('workFileInput')?.click();
  });
  global.document.getElementById('openWorkFileToolbarButton')?.addEventListener('click', () => {
    global.document.getElementById('workFileInput')?.click();
  });
  const workFileInput = global.document.getElementById('workFileInput');
  workFileInput?.addEventListener('change', () => {
    openWorkFile(workFileInput.files?.[0]);
    workFileInput.value = '';
  });
  global.saveWorkFile = saveWorkFile;
  global.openWorkFile = openWorkFile;
})(window);
