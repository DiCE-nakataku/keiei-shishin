(function (global) {
  global.workbookState = {
    activeWorkbook: null,
    calculationAdapter: null,
    formulaResults: [],
    workbookHasErrors: true,
    workbookCalculating: false,
  };
})(window);
