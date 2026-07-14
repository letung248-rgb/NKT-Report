var SIZE_REPOSITORY_CONFIG = {
  sheetName: "DANH_MUC_SIZE",
  headers: ["Size", "HoatDong", "ThuTu", "GhiChu"],
  columnCount: 4
};

var SIZE_REPOSITORY_INITIAL_SEED = [
  ["Ø60", true, 1, ""],
  ["Ø73", true, 2, ""],
  ["Ø73 NVTL", true, 3, ""],
  ["Ø89", true, 4, ""],
  ["Ø89 NVTL", true, 5, ""],
  ["Ø114", true, 6, ""],
  ["Ø114 NVTL", true, 7, ""]
];

/**
 * Reads the canonical Size catalog from Google Sheet.
 * Spreadsheet access for the Size domain is isolated in this repository.
 */
function sizeRepositoryReadAll_() {
  var spreadsheet = getSpreadsheet();
  if (!spreadsheet) {
    throw new Error("Không thể mở Spreadsheet dữ liệu.");
  }

  var sheet = spreadsheet.getSheetByName(SIZE_REPOSITORY_CONFIG.sheetName);
  if (!sheet) {
    throw new Error(
      "Không tìm thấy sheet " + SIZE_REPOSITORY_CONFIG.sheetName +
      ". Hãy chạy adminSetupAndSeedSizeCatalog() thủ công."
    );
  }
  sizeRepositoryValidateHeaders_(sheet);

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return {
      sheetName: SIZE_REPOSITORY_CONFIG.sheetName,
      rows: []
    };
  }

  var rowCount = lastRow - 1;
  var range = sheet.getRange(2, 1, rowCount, SIZE_REPOSITORY_CONFIG.columnCount);
  var values = range.getValues();
  var displayValues = range.getDisplayValues();
  var rows = [];

  for (var index = 0; index < values.length; index++) {
    rows.push({
      rowNumber: index + 2,
      values: values[index],
      displayValues: displayValues[index]
    });
  }

  return {
    sheetName: SIZE_REPOSITORY_CONFIG.sheetName,
    rows: rows
  };
}

/**
 * Creates and seeds DANH_MUC_SIZE only when the sheet does not exist.
 * An existing sheet is returned unchanged to protect production data.
 */
function sizeRepositorySetupAndSeed_() {
  var spreadsheet = getSpreadsheet();
  if (!spreadsheet) {
    throw new Error("Không thể mở Spreadsheet dữ liệu.");
  }

  var existingSheet = spreadsheet.getSheetByName(SIZE_REPOSITORY_CONFIG.sheetName);
  if (existingSheet) {
    sizeRepositoryValidateHeaders_(existingSheet);
    return {
      sheetName: SIZE_REPOSITORY_CONFIG.sheetName,
      created: false,
      seeded: false,
      existingDataPreserved: true,
      message: "Sheet đã tồn tại; không thay đổi dữ liệu hiện hữu."
    };
  }

  var sheet = spreadsheet.insertSheet(SIZE_REPOSITORY_CONFIG.sheetName);
  sheet.getRange(1, 1, 1, SIZE_REPOSITORY_CONFIG.columnCount)
    .setValues([SIZE_REPOSITORY_CONFIG.headers]);
  sheet.getRange(2, 2, SIZE_REPOSITORY_INITIAL_SEED.length, 1).insertCheckboxes();
  sheet.getRange(2, 1, SIZE_REPOSITORY_INITIAL_SEED.length, SIZE_REPOSITORY_CONFIG.columnCount)
    .setValues(SIZE_REPOSITORY_INITIAL_SEED);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, SIZE_REPOSITORY_CONFIG.columnCount)
    .setFontWeight("bold")
    .setBackground("#1F4E78")
    .setFontColor("#FFFFFF");
  sheet.autoResizeColumns(1, SIZE_REPOSITORY_CONFIG.columnCount);

  return {
    sheetName: SIZE_REPOSITORY_CONFIG.sheetName,
    created: true,
    seeded: true,
    seedCount: SIZE_REPOSITORY_INITIAL_SEED.length,
    existingDataPreserved: true
  };
}

function sizeRepositoryValidateHeaders_(sheet) {
  var actualHeaders = sheet
    .getRange(1, 1, 1, SIZE_REPOSITORY_CONFIG.columnCount)
    .getDisplayValues()[0];
  var mismatches = [];

  for (var index = 0; index < SIZE_REPOSITORY_CONFIG.headers.length; index++) {
    var expected = SIZE_REPOSITORY_CONFIG.headers[index];
    var actual = String(actualHeaders[index] || "").trim();
    if (actual !== expected) {
      mismatches.push(
        "cột " + (index + 1) + ': cần "' + expected + '", hiện là "' + (actual || "(trống)") + '"'
      );
    }
  }

  if (mismatches.length) {
    throw new Error(
      "Header sheet " + SIZE_REPOSITORY_CONFIG.sheetName + " không hợp lệ: " +
      mismatches.join("; ") + ". Cấu trúc yêu cầu: " +
      SIZE_REPOSITORY_CONFIG.headers.join(" | ") + "."
    );
  }
}
