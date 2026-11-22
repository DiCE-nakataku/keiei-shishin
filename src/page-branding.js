(function (global) {
  const { esc, fmtCell } = global;
  const document = global.document;
  const clearPrintGuidance = global.clearPrintGuidance;
  // State for Cover Logo
  let coverLogoDataUrl = null;
  let coverLogoPos = 'right-top'; // 'right-top' | 'left-top' | 'right-bottom' | 'center-hero'
  let coverLogoFrame = 'none'; // 'none' | 'plate' | 'soft'
  let currentCoverData = null;

  // State for 10-Year Vision Image
  let visionImageDataUrl = null;
  let visionLayoutMode = 'corner'; // 'corner' | 'right-half' | 'full-bg' | 'full-fg' | 'full-fg-only'
  let currentVisionData = null;

  window.bindImageDataUrlInput('coverLogoInput', (dataUrl) => {
    coverLogoDataUrl = dataUrl;
    global.markWorkFileDirty?.();
    if (!global.markWorkFileDirty && global.workbookState)
      global.workbookState.workFileDirty = true;
    renderCoverPage();
  });

  function setCoverLogoPos(pos) {
    coverLogoPos = pos;
    global.markWorkFileDirty?.();
    if (!global.markWorkFileDirty && global.workbookState)
      global.workbookState.workFileDirty = true;
    // Auto-suggest white plate when placed on dark left panel so dark logos never vanish
    if (pos === 'left-top' && coverLogoFrame === 'none') {
      coverLogoFrame = 'plate';
    }
    renderCoverPage();
  }
  function setCoverLogoFrame(frame) {
    coverLogoFrame = frame;
    global.markWorkFileDirty?.();
    if (!global.markWorkFileDirty && global.workbookState)
      global.workbookState.workFileDirty = true;
    renderCoverPage();
  }
  function removeCoverLogo() {
    coverLogoDataUrl = null;
    global.markWorkFileDirty?.();
    if (!global.markWorkFileDirty && global.workbookState)
      global.workbookState.workFileDirty = true;
    document.getElementById('coverLogoInput').value = '';
    renderCoverPage();
  }

  function renderCoverPage() {
    clearPrintGuidance();
    const el = document.getElementById('coverPageContainer');
    if (!el || !currentCoverData) return;
    const { company, rep, term, startYM, endYM, pubDate, subTitle } = currentCoverData;

    let ctrlHTML = `<div class="floating-ctrl-bar cover-ctrl-wrap no-print">`;
    if (!coverLogoDataUrl) {
      ctrlHTML += `<span class="bar-label">表紙ロゴ：未設置</span>
      <button class="mode-btn primary-action" data-branding-action="select-cover-image">🏢 自社ロゴを挿入</button>`;
    } else {
      ctrlHTML += `<span class="bar-label">ロゴ位置：</span>
      <button class="mode-btn ${coverLogoPos === 'right-top' ? 'active' : ''}" data-branding-action="cover-logo-position" data-value="right-top">右上（標準）</button>
      <button class="mode-btn ${coverLogoPos === 'left-top' ? 'active' : ''}" data-branding-action="cover-logo-position" data-value="left-top">左上（濃紺帯）</button>
      <button class="mode-btn ${coverLogoPos === 'right-bottom' ? 'active' : ''}" data-branding-action="cover-logo-position" data-value="right-bottom">右下（社名横）</button>
      <button class="mode-btn ${coverLogoPos === 'center-hero' ? 'active' : ''}" data-branding-action="cover-logo-position" data-value="center-hero">中央上部</button>
      <span class="sep"></span>
      <span class="bar-label">背景処理：</span>
      <button class="mode-btn ${coverLogoFrame === 'none' ? 'active' : ''}" data-branding-action="cover-logo-frame" data-value="none">透過そのまま</button>
      <button class="mode-btn ${coverLogoFrame === 'plate' ? 'active' : ''}" data-branding-action="cover-logo-frame" data-value="plate">白プレート</button>
      <button class="mode-btn ${coverLogoFrame === 'soft' ? 'active' : ''}" data-branding-action="cover-logo-frame" data-value="soft">淡色枠</button>
      <span class="sep"></span>
      <button class="mode-btn" data-branding-action="select-cover-image">変更</button>
      <button class="mode-btn danger-action" data-branding-action="remove-cover-image">削除</button>`;
    }
    ctrlHTML += `</div>`;

    const logoTag = coverLogoDataUrl
      ? `<div class="logo-badge frame-${coverLogoFrame}"><img src="${coverLogoDataUrl}" alt="自社ロゴ" /></div>`
      : '';

    const leftTopSlot =
      coverLogoDataUrl && coverLogoPos === 'left-top'
        ? `<div class="cover-logo-left-top">${logoTag}</div>`
        : `<div class="cover-en">MANAGEMENT<br>POLICY &amp;<br>BUSINESS PLAN</div>`;

    const rightTopSlot =
      coverLogoDataUrl && coverLogoPos === 'right-top'
        ? `<div class="cover-logo-right-top">${logoTag}</div>`
        : coverLogoDataUrl && coverLogoPos === 'center-hero'
          ? `<div class="cover-logo-center-hero">${logoTag}</div>`
          : '';

    const centerStyle =
      coverLogoDataUrl && coverLogoPos === 'center-hero' ? 'text-align:center;' : '';

    const isLongCompany =
      company.length >= 13 ||
      (coverLogoDataUrl && coverLogoPos === 'right-bottom' && company.length >= 11);
    const compCls = isLongCompany ? 'cover-company compact' : 'cover-company';

    const textColHTML = `
    <div class="cover-sign-text-col">
      <div class="${compCls}">${esc(company)}</div>
      <div class="cover-rep-row">
        <div class="cover-rep">${rep ? '代表取締役　' + esc(rep) : ''}</div>
        <div class="cover-date">${pubDate ? '策定日：' + esc(pubDate) : ''}</div>
      </div>
    </div>`;

    const companyBlockHTML =
      coverLogoDataUrl && coverLogoPos === 'right-bottom'
        ? `<div class="cover-sign-with-logo">${logoTag}${textColHTML}</div>`
        : textColHTML;

    el.innerHTML = `
    ${ctrlHTML}
    <div class="cover-grid">
      <div class="cover-left">
        ${leftTopSlot}
        <div class="cover-term-box">
          <div class="cover-term-label">FISCAL PERIOD</div>
          <div class="cover-term-num">第 ${esc(term || '—')} 期</div>
          <div class="cover-range">${esc(startYM)} ～ ${esc(endYM)}</div>
        </div>
        <div class="cover-left-foot">${esc(company)}</div>
      </div>
      <div class="cover-right">
        <div class="cover-main-area" style="${centerStyle}">
          ${rightTopSlot}
          <div class="cover-doc-type">EXECUTIVE MANAGEMENT GUIDELINE</div>
          <h1 class="cover-title">経営指針書</h1>
          ${subTitle ? `<div class="cover-motto" style="text-align:left;">${esc(subTitle)}</div>` : ''}
        </div>
        <div class="cover-sign-area">
          ${companyBlockHTML}
        </div>
      </div>
    </div>
  `;
    global.refreshAppearanceTargets?.();
  }

  // Vision Image Handlers
  window.bindImageDataUrlInput('visionImgInput', (dataUrl) => {
    visionImageDataUrl = dataUrl;
    global.markWorkFileDirty?.();
    if (!global.markWorkFileDirty && global.workbookState)
      global.workbookState.workFileDirty = true;
    renderVisionBody();
  });

  function setVisionMode(mode) {
    visionLayoutMode = mode;
    global.markWorkFileDirty?.();
    if (!global.markWorkFileDirty && global.workbookState)
      global.workbookState.workFileDirty = true;
    renderVisionBody();
  }

  function removeVisionImage() {
    visionImageDataUrl = null;
    global.markWorkFileDirty?.();
    if (!global.markWorkFileDirty && global.workbookState)
      global.workbookState.workFileDirty = true;
    document.getElementById('visionImgInput').value = '';
    renderVisionBody();
  }

  function renderVisionBody() {
    clearPrintGuidance();
    const container = document.getElementById('visionPageBody');
    if (!container || !currentVisionData) return;

    const { mainVis, subCards } = currentVisionData;
    const hasSubs = subCards.length > 0;
    const noSubClass = hasSubs ? '' : 'no-sub-cards';

    let ctrlHTML = `<div class="floating-ctrl-bar no-print">`;
    if (!visionImageDataUrl) {
      ctrlHTML += `<span class="bar-label" style="margin-right:auto;">レイアウト：テキスト主役モード（画像なし）</span>
      <button class="mode-btn primary-action" data-branding-action="select-vision-image">🖼️ ビジョン画像・イラストを挿入</button>`;
    } else {
      ctrlHTML += `<span class="bar-label">画像配置：</span>
      <button class="mode-btn ${visionLayoutMode === 'corner' ? 'active' : ''}" data-branding-action="vision-layout" data-value="corner">右隅（黄金比）</button>
      <button class="mode-btn ${visionLayoutMode === 'right-half' ? 'active' : ''}" data-branding-action="vision-layout" data-value="right-half">右半分</button>
      <button class="mode-btn ${visionLayoutMode === 'full-bg' ? 'active' : ''}" data-branding-action="vision-layout" data-value="full-bg">全面背景（文字重ね）</button>
      <button class="mode-btn ${visionLayoutMode === 'full-fg' ? 'active' : ''}" data-branding-action="vision-layout" data-value="full-fg">全面前面（下帯付）</button>
      <button class="mode-btn ${visionLayoutMode === 'full-fg-only' ? 'active' : ''}" data-branding-action="vision-layout" data-value="full-fg-only">全面前面（画像のみ）</button>
      <span class="sep"></span>
      <button class="mode-btn" data-branding-action="select-vision-image">変更</button>
      <button class="mode-btn danger-action" data-branding-action="remove-vision-image">削除</button>`;
    }
    ctrlHTML += `</div>`;

    function buildSubGridHTML() {
      if (!hasSubs) return '';
      const cards = subCards
        .map(
          (c, idx) => `
      <div class="panel-card ${idx % 2 === 1 ? 'accent-top' : ''}">
        <div class="panel-head">${esc(c.title)}</div>
        <div class="panel-body">${esc(c.body)}</div>
      </div>
    `,
        )
        .join('');
      return `<div class="dynamic-grid cols-${subCards.length}">${cards}</div>`;
    }

    let bodyHTML = '';

    if (!visionImageDataUrl) {
      bodyHTML = `
      <div class="vision-layout-text-only ${noSubClass}">
        <div class="hero-quote">
          <div class="hero-quote-label">10-YEAR VISION ― 10年後に目指す会社の姿</div>
          <div class="hero-quote-text vision-text">${fmtCell(mainVis, '（長期ビジョンを入力してください）')}</div>
        </div>
        ${buildSubGridHTML()}
      </div>
    `;
    } else if (visionLayoutMode === 'corner') {
      bodyHTML = `
      <div class="vision-layout-corner ${noSubClass}">
        <div class="vision-top-split">
          <div class="hero-quote">
            <div class="hero-quote-label">10-YEAR VISION ― 10年後に目指す会社の姿</div>
            <div class="hero-quote-text vision-text">${fmtCell(mainVis, '（長期ビジョンを入力してください）')}</div>
          </div>
          <div class="vision-img-frame">
            <img src="${visionImageDataUrl}" alt="10年ビジョン" />
          </div>
        </div>
        ${buildSubGridHTML()}
      </div>
    `;
    } else if (visionLayoutMode === 'right-half') {
      const stackCards = subCards
        .map(
          (c, idx) => `
      <div class="panel-card ${idx % 2 === 1 ? 'accent-top' : ''}">
        <div class="panel-head">${esc(c.title)}</div>
        <div class="panel-body">${esc(c.body)}</div>
      </div>
    `,
        )
        .join('');
      bodyHTML = `
      <div class="vision-layout-right-half">
        <div class="vision-left-stack">
          <div class="hero-quote">
            <div class="hero-quote-label">10-YEAR VISION ― 10年後に目指す会社の姿</div>
            <div class="hero-quote-text vision-text">${fmtCell(mainVis, '（長期ビジョンを入力してください）')}</div>
          </div>
          ${hasSubs ? `<div class="sub-cards-stack">${stackCards}</div>` : ''}
        </div>
        <div class="vision-right-full-img">
          <img src="${visionImageDataUrl}" alt="10年ビジョン" />
        </div>
      </div>
    `;
    } else if (visionLayoutMode === 'full-bg') {
      bodyHTML = `
      <div class="vision-layout-full-bg ${noSubClass}">
        <img class="poster-bg-img" src="${visionImageDataUrl}" alt="10年ビジョン背景" />
        <div class="poster-scrim"></div>
        <div class="poster-content">
          <div class="hero-quote">
            <div class="hero-quote-label">10-YEAR VISION ― 10年後に目指す会社の姿</div>
            <div class="hero-quote-text vision-text">${fmtCell(mainVis, '（長期ビジョンを入力してください）')}</div>
          </div>
          ${buildSubGridHTML()}
        </div>
      </div>
    `;
    } else if (visionLayoutMode === 'full-fg') {
      bodyHTML = `
      <div class="vision-layout-full-fg">
        <div class="fg-image-stage">
          <img src="${visionImageDataUrl}" alt="10年ビジョン図解" />
        </div>
        ${
          mainVis
            ? `
          <div class="fg-caption-bar">
            <span class="fg-caption-tag">10-YEAR VISION</span>
            <div class="fg-caption-text">${esc(mainVis.replace(/\n+/g, '　'))}</div>
          </div>
        `
            : ''
        }
      </div>
    `;
    } else if (visionLayoutMode === 'full-fg-only') {
      bodyHTML = `
      <div class="vision-layout-full-fg">
        <div class="fg-image-stage" style="padding:2px;">
          <img src="${visionImageDataUrl}" alt="10年ビジョン図解" />
        </div>
      </div>
    `;
    }

    container.innerHTML = ctrlHTML + `<div style="flex:1;overflow:hidden;">${bodyHTML}</div>`;
    global.refreshAppearanceTargets?.();
  }

  global.document.addEventListener('click', (event) => {
    const control = event.target?.closest?.('[data-branding-action]');
    if (!control) return;

    const value = control.dataset.value;
    switch (control.dataset.brandingAction) {
      case 'select-cover-image':
        global.document.getElementById('coverLogoInput')?.click();
        break;
      case 'cover-logo-position':
        setCoverLogoPos(value);
        break;
      case 'cover-logo-frame':
        setCoverLogoFrame(value);
        break;
      case 'remove-cover-image':
        removeCoverLogo();
        break;
      case 'select-vision-image':
        global.document.getElementById('visionImgInput')?.click();
        break;
      case 'vision-layout':
        setVisionMode(value);
        break;
      case 'remove-vision-image':
        removeVisionImage();
        break;
    }
  });

  global.setCoverPageData = (data) => {
    currentCoverData = data;
  };
  global.setVisionPageData = (data) => {
    currentVisionData = data;
  };
  global.getBrandingState = () => ({
    coverLogoDataUrl,
    coverLogoPos,
    coverLogoFrame,
    visionImageDataUrl,
    visionLayoutMode,
  });
  global.setBrandingState = (settings = {}) => {
    coverLogoDataUrl = settings.coverLogoDataUrl || null;
    coverLogoPos = ['right-top', 'left-top', 'right-bottom', 'center-hero'].includes(
      settings.coverLogoPos,
    )
      ? settings.coverLogoPos
      : 'right-top';
    coverLogoFrame = ['none', 'plate', 'soft'].includes(settings.coverLogoFrame)
      ? settings.coverLogoFrame
      : 'none';
    visionImageDataUrl = settings.visionImageDataUrl || null;
    visionLayoutMode = ['corner', 'right-half', 'full-bg', 'full-fg', 'full-fg-only'].includes(
      settings.visionLayoutMode,
    )
      ? settings.visionLayoutMode
      : 'corner';
  };
  global.renderCoverPage = renderCoverPage;
  global.renderVisionBody = renderVisionBody;
})(window);
