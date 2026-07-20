// Explicit admin-only setup. Run manually from the Apps Script editor.
function adminSetupPlanModuleSheets() {
  var spreadsheet = getSpreadsheet();
  if (!spreadsheet) throw new Error("Khong the mo Spreadsheet du lieu.");

  var configs = [PLAN_REPOSITORY_CONFIG.daily, PLAN_REPOSITORY_CONFIG.monthly];
  return {
    success: true,
    sheets: configs.map(function(config) {
      return planSheetSetupEnsureSheet_(spreadsheet, config);
    })
  };
}

function planSheetSetupEnsureSheet_(spreadsheet, config) {
  var sheet = spreadsheet.getSheetByName(config.sheetName);
  if (sheet) {
    planRepositoryValidateHeaders_(sheet, config);
    return {
      sheetName: config.sheetName,
      created: false,
      existingDataPreserved: true
    };
  }

  sheet = spreadsheet.insertSheet(config.sheetName);
  sheet.getRange(1, 1, 1, PLAN_REPOSITORY_CONFIG.columnCount).setValues([config.headers]);

  return {
    sheetName: config.sheetName,
    created: true,
    existingDataPreserved: true
  };
}
