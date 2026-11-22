(function (global) {
  global.workbookState = {
    activeWorkbook: null,
    calculationAdapter: null,
    formulaResults: [],
    inputValidationResults: [],
    sourceWorkbookBytes: null,
    sourceFileName: '',
    pendingWorkProject: null,
    workbookWasReplaced: false,
    shouldReportMapping: false,
    appearanceSettings: {},
    workFileDirty: false,
    workbookHasErrors: true,
    workbookCalculating: false,
  };
})(window);
