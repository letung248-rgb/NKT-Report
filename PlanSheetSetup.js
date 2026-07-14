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

// Read-only adapter: Plan Module uses the same Size options currently rendered by Worker App.
// This function does not define or persist a separate Size catalog.
function getPlanSizeCatalog() {
  var workerHtml = HtmlService.createHtmlOutputFromFile("Index").getContent();
  var selectMatch = workerHtml.match(/<select\b[^>]*\bid=["']w-loai-ong["'][^>]*>([\s\S]*?)<\/select>/i);
  if (!selectMatch) {
    throw new Error("Không tìm thấy nguồn Size #w-loai-ong trong Index.html.");
  }

  var sizes = [];
  var seen = {};
  var optionPattern = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;
  var optionMatch;

  while ((optionMatch = optionPattern.exec(selectMatch[1])) !== null) {
    var attributes = optionMatch[1] || "";
    var label = String(optionMatch[2] || "").replace(/<[^>]+>/g, "").trim();
    var valueMatch = attributes.match(/\bvalue=["']([^"']*)["']/i);
    var value = String(valueMatch ? valueMatch[1] : label).trim();
    if (!value || seen[value]) continue;
    seen[value] = true;
    sizes.push(value);
  }

  if (!sizes.length) {
    throw new Error("Nguồn Size #w-loai-ong hiện không có giá trị.");
  }

  return {
    source: "Index.html#w-loai-ong",
    sizes: sizes
  };
}

// Explicit admin-only setup. Run manually from the Apps Script editor.
function adminSetupPlanModuleSheets() {
  var ss = getSpreadsheet();
  if (!ss) throw new Error("Spreadsheet is unavailable.");

  var results = [];
  for (var i = 0; i < PLAN_SHEET_SETUP_DEFINITIONS.length; i++) {
    results.push(_setupPlanModuleSheet_(ss, PLAN_SHEET_SETUP_DEFINITIONS[i]));
  }

  return {
    success: true,
    sheets: results,
    sizeCatalogNote: "Danh mục Size sử dụng nguồn hiện có; setup không tạo MASTER_SIZE."
  };
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
