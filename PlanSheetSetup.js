var PLAN_SHEET_SETUP_DEFINITIONS = [
  {
    name: "KẾ_HOẠCH_THÁNG",
    headers: [
      "Tháng",
      "Size ống",
      "KH kiểm tra",
      "KH thành phẩm",
      "Ghi chú",
      "Cập nhật lúc",
      "Cập nhật bởi"
    ],
    centeredColumns: [1, 2, 3, 4],
    leftAlignedColumns: [5]
  },
  {
    name: "KẾ_HOẠCH_NGÀY",
    headers: [
      "Ngày",
      "Size ống",
      "KH kiểm tra",
      "KH thành phẩm",
      "Ghi chú",
      "Cập nhật lúc",
      "Cập nhật bởi"
    ],
    centeredColumns: [1, 2, 3, 4],
    leftAlignedColumns: [5]
  }
];

// Explicit admin-only setup. Run manually from the Apps Script editor.
function adminSetupPlanModuleSheets() {
  return planRepositorySetupSheets_();
}

function _setupPlanModuleSheet_(ss, definition) {
  var sheet = ss.getSheetByName(definition.name);
  var created = false;

  if (!sheet) {
    sheet = ss.insertSheet(definition.name);
    created = true;
  }

  var maxColumns = sheet.getMaxColumns();
  if (maxColumns < definition.headers.length) {
    sheet.insertColumnsAfter(
      maxColumns,
      definition.headers.length - maxColumns
    );
  }

  var headerRange = sheet.getRange(1, 1, 1, definition.headers.length);
  var currentHeaders = headerRange.getDisplayValues()[0];
  var headersAdded = [];
  var headerConflicts = [];

  for (var columnIndex = 0; columnIndex < definition.headers.length; columnIndex++) {
    var expectedHeader = definition.headers[columnIndex];
    var currentHeader = (currentHeaders[columnIndex] || "").toString().trim();

    if (!currentHeader) {
      sheet.getRange(1, columnIndex + 1).setValue(expectedHeader);
      headersAdded.push(expectedHeader);
    } else if (currentHeader !== expectedHeader) {
      headerConflicts.push({
        column: columnIndex + 1,
        expected: expectedHeader,
        actual: currentHeader
      });
    }
  }

  sheet.setFrozenRows(1);
  headerRange
    .setFontWeight("bold")
    .setBackground("#1F4E78")
    .setFontColor("#FFFFFF");

  var sheetRowCount = Math.max(sheet.getMaxRows(), 1);
  for (var i = 0; i < definition.centeredColumns.length; i++) {
    sheet.getRange(1, definition.centeredColumns[i], sheetRowCount, 1)
      .setHorizontalAlignment("center");
  }
  for (var j = 0; j < definition.leftAlignedColumns.length; j++) {
    sheet.getRange(1, definition.leftAlignedColumns[j], sheetRowCount, 1)
      .setHorizontalAlignment("left");
  }

  var filterCreated = false;
  if (!sheet.getFilter()) {
    var filterRowCount = Math.max(sheet.getLastRow(), 2);
    sheet.getRange(1, 1, filterRowCount, definition.headers.length).createFilter();
    filterCreated = true;
  }

  sheet.autoResizeColumns(1, definition.headers.length);

  return {
    sheetName: definition.name,
    created: created,
    headersAdded: headersAdded,
    headerConflicts: headerConflicts,
    filterCreated: filterCreated,
    formatted: true,
    existingDataPreserved: true
  };
}
