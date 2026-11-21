(function (global) {
  function renderSelectedWorkbookPages({
    selected,
    workbook,
    val,
    makePage,
    container,
    coverData,
  }) {
    selected.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) return;

      switch (sheetName) {
        case '01_表紙':
          global.setCoverPageData({ ...coverData, subTitle: val(worksheet, 'B11') });
          makePage('COVER', '表紙', '', true, 'coverPageContainer');
          global.renderCoverPage();
          break;
        case '02_経営姿勢の確立':
          global.renderStancePage(worksheet, val, makePage);
          break;
        case '03_経営理念':
          global.renderPhilosophyPage(worksheet, val, makePage);
          break;
        case '04_長期ビジョン検討':
          global.renderVisionPlanningPage(worksheet, val, makePage);
          break;
        case '05_長期ビジョン': {
          const mainVis = val(worksheet, 'C5').trim();
          const subCards = [];
          for (let row = 6; row <= 8; row++) {
            const body = val(worksheet, 'C' + row).trim();
            if (body) subCards.push({ title: val(worksheet, 'B' + row), body });
          }
          global.setVisionPageData({ mainVis, subCards });
          makePage('03 / LONG-TERM VISION', '長期（10年）ビジョン', '', false, 'visionPageBody');
          global.renderVisionBody();
          break;
        }
        case '06_外部環境分析マクロ':
          global.renderExternalEnvironmentPage(worksheet, val, makePage, 'macro');
          break;
        case '07_外部環境分析ミクロ':
          global.renderExternalEnvironmentPage(worksheet, val, makePage, 'micro');
          break;
        case '08_自社の強み弱み':
          global.renderInternalAnalysisPage(worksheet, val, makePage);
          break;
        case '09_経営課題洗出':
          global.renderCrossSwotPage(worksheet, val, makePage);
          break;
        case '10_課題抽出':
          global.renderStrategicIssuesPage(worksheet, val, makePage);
          break;
        case '11_経営方針':
          global.renderManagementPolicyPage(worksheet, val, makePage);
          break;
        case '12_変動損益計算書':
          global.renderVariableProfitPage(worksheet, val, makePage);
          break;
        case '13_利益計画検討表①':
          global.renderProfitSimulationPage(worksheet, val, makePage);
          break;
        case '14_利益資金計画検討表②':
          global.renderMidtermFinancialPlanPage(worksheet, val, makePage);
          break;
        case '15_目標設定':
          global.renderThreeYearTargetsPage(worksheet, val, makePage);
          break;
        case '16_行動計画':
          global.renderActionPlanPage(worksheet, val, makePage, coverData.startYM);
          break;
        case '17_売上計画':
          global.renderSalesPlanPage(worksheet, val, makePage);
          break;
      }
    });
    return global.paginateDenseTables(container);
  }

  global.renderSelectedWorkbookPages = renderSelectedWorkbookPages;
})(window);
