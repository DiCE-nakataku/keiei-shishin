(function (global) {
  function createWorkbookValueReader(workbook, calculationAdapter, formulaEngine, xlsx) {
    function formatExcelValue(rawValue, format) {
      return formulaEngine.formatValue(rawValue, format, xlsx);
    }

    return function val(worksheet, address) {
      if (!worksheet || !worksheet[address]) return '';
      const cell = worksheet[address];
      const sheet = workbook.SheetNames.find((name) => workbook.Sheets[name] === worksheet);
      if (cell.f && sheet) {
        return formatExcelValue(
          calculationAdapter.evaluateCell(sheet, address),
          cell.z || 'General',
        );
      }
      if (cell.v !== undefined && cell.v !== null) {
        return formatExcelValue(cell.v, cell.z || 'General');
      }
      return '';
    };
  }

  global.createWorkbookValueReader = createWorkbookValueReader;
})(window);
