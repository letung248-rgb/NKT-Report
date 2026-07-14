var PLAN_REPOSITORY_CONFIG = {
  monthly: {
    sheetName: "KẾ_HOẠCH_THÁNG",
    periodType: "month",
    headers: [
      "ID", "Tháng", "Size", "KH kiểm tra", "KH thành phẩm", "Ghi chú", "Tạo lúc", "Cập nhật lúc"
    ]
  },
  daily: {
    sheetName: "KẾ_HOẠCH_NGÀY",
    periodType: "day",
    headers: [
      "ID", "Ngày", "Size", "KH kiểm tra", "KH thành phẩm", "Ghi chú", "Tạo lúc", "Cập nhật lúc"
    ]
  },
  columnCount: 8
};

function planRepositoryListMonthly() {
  return planRepositoryList_(PLAN_REPOSITORY_CONFIG.monthly);
}

function planRepositoryListDaily() {
  return planRepositoryList_(PLAN_REPOSITORY_CONFIG.daily);
}

function planRepositoryInsertManyMonthly(records) {
  return planRepositoryInsertMany_(PLAN_REPOSITORY_CONFIG.monthly, records);
}

function planRepositoryInsertManyDaily(records) {
  return planRepositoryInsertMany_(PLAN_REPOSITORY_CONFIG.daily, records);
}

function planRepositoryUpdateMonthlyById(id, record) {
  return planRepositoryUpdateById_(PLAN_REPOSITORY_CONFIG.monthly, id, record);
}

function planRepositoryUpdateDailyById(id, record) {
  return planRepositoryUpdateById_(PLAN_REPOSITORY_CONFIG.daily, id, record);
}

function planRepositoryDeleteMonthlyById(id) {
  return planRepositoryDeleteById_(PLAN_REPOSITORY_CONFIG.monthly, id);
}

function planRepositoryDeleteDailyById(id) {
  return planRepositoryDeleteById_(PLAN_REPOSITORY_CONFIG.daily, id);
}

/**
 * Compatibility read API used by the current PlanService.
 */
function planRepositoryReadAll_() {
  var spreadsheet = getSpreadsheet();
  if (!spreadsheet) throw new Error("Không thể mở Spreadsheet dữ liệu.");

  return {
    timeZone: spreadsheet.getSpreadsheetTimeZone(),
    monthly: {
      sheetName: PLAN_REPOSITORY_CONFIG.monthly.sheetName,
      rows: planRepositoryListFromSpreadsheet_(spreadsheet, PLAN_REPOSITORY_CONFIG.monthly)
    },
    daily: {
      sheetName: PLAN_REPOSITORY_CONFIG.daily.sheetName,
      rows: planRepositoryListFromSpreadsheet_(spreadsheet, PLAN_REPOSITORY_CONFIG.daily)
    }
  };
}

function planRepositoryList_(config) {
  var spreadsheet = getSpreadsheet();
  if (!spreadsheet) throw new Error("Không thể mở Spreadsheet dữ liệu.");
  return planRepositoryListFromSpreadsheet_(spreadsheet, config);
}

function planRepositoryListFromSpreadsheet_(spreadsheet, config) {
  var sheet = planRepositoryGetSheet_(spreadsheet, config);
  planRepositoryValidateHeaders_(sheet, config);
  var timeZone = planRepositoryGetTimeZone_(spreadsheet);

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var range = sheet.getRange(2, 1, lastRow - 1, PLAN_REPOSITORY_CONFIG.columnCount);
  var values = range.getValues();
  var displayValues = range.getDisplayValues();
  var records = [];
  values.forEach(function(row, index) {
    if (!planRepositoryIsEmptyRow_(row)) {
      records.push(planRepositoryFromRow_(row, displayValues[index], config, timeZone));
    }
  });
  return records;
}

function planRepositoryInsertMany_(config, records) {
  var input = Array.isArray(records) ? records : [];
  if (!input.length) return [];

  var spreadsheet = getSpreadsheet();
  if (!spreadsheet) throw new Error("Không thể mở Spreadsheet dữ liệu.");
  var sheet = planRepositoryGetSheet_(spreadsheet, config);
  planRepositoryValidateHeaders_(sheet, config);
  var timeZone = planRepositoryGetTimeZone_(spreadsheet);
  var now = new Date();

  var rows = input.map(function(record) {
    return planRepositoryToRow_(record || {}, config, Utilities.getUuid(), timeZone, now, now);
  });
  var targetRange = sheet.getRange(
    sheet.getLastRow() + 1,
    1,
    rows.length,
    PLAN_REPOSITORY_CONFIG.columnCount
  );
  targetRange.setValues(rows);

  var persistedRows = targetRange.getValues();
  var persistedDisplayRows = targetRange.getDisplayValues();
  return persistedRows.map(function(row, index) {
    return planRepositoryFromRow_(row, persistedDisplayRows[index], config, timeZone);
  });
}

function planRepositoryUpdateById_(config, id, record) {
  var spreadsheet = getSpreadsheet();
  if (!spreadsheet) throw new Error("Không thể mở Spreadsheet dữ liệu.");
  var sheet = planRepositoryGetSheet_(spreadsheet, config);
  planRepositoryValidateHeaders_(sheet, config);
  var timeZone = planRepositoryGetTimeZone_(spreadsheet);

  var rowNumber = planRepositoryFindRowNumberById_(sheet, id);
  var existingRow = sheet.getRange(rowNumber, 1, 1, PLAN_REPOSITORY_CONFIG.columnCount).getValues()[0];
  var updateRecord = record || {};
  var row = planRepositoryToRow_({
    period: updateRecord.period,
    size: updateRecord.size,
    inspectionPlan: updateRecord.inspectionPlan,
    finishedPlan: updateRecord.finishedPlan,
    note: updateRecord.note
  }, config, String(id || ""), timeZone, existingRow[6], new Date());

  var targetRange = sheet.getRange(rowNumber, 1, 1, PLAN_REPOSITORY_CONFIG.columnCount);
  targetRange.setValues([row]);
  return planRepositoryFromRow_(
    targetRange.getValues()[0],
    targetRange.getDisplayValues()[0],
    config,
    timeZone
  );
}

function planRepositoryDeleteById_(config, id) {
  var spreadsheet = getSpreadsheet();
  if (!spreadsheet) throw new Error("Không thể mở Spreadsheet dữ liệu.");
  var sheet = planRepositoryGetSheet_(spreadsheet, config);
  planRepositoryValidateHeaders_(sheet, config);
  var timeZone = planRepositoryGetTimeZone_(spreadsheet);

  var rowNumber = planRepositoryFindRowNumberById_(sheet, id);
  var targetRange = sheet.getRange(rowNumber, 1, 1, PLAN_REPOSITORY_CONFIG.columnCount);
  var deleted = planRepositoryFromRow_(
    targetRange.getValues()[0],
    targetRange.getDisplayValues()[0],
    config,
    timeZone
  );
  sheet.deleteRow(rowNumber);
  return deleted;
}

function planRepositoryFindRowNumberById_(sheet, id) {
  var normalizedId = String(id || "");
  if (!normalizedId) throw new Error("Không tìm thấy kế hoạch ID (trống).");
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) throw new Error("Không tìm thấy kế hoạch ID " + normalizedId + ".");

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var index = 0; index < ids.length; index++) {
    if (String(ids[index][0] || "") === normalizedId) return index + 2;
  }
  throw new Error("Không tìm thấy kế hoạch ID " + normalizedId + ".");
}

function planRepositoryToRow_(record, config, id, timeZone, createdAt, updatedAt) {
  return [
    String(id || ""),
    planRepositoryToPeriod_(record.period, config.periodType, timeZone),
    planRepositoryToText_(record.size),
    planRepositoryToNumber_(record.inspectionPlan),
    planRepositoryToNumber_(record.finishedPlan),
    planRepositoryToText_(record.note),
    planRepositoryToDateTime_(createdAt),
    planRepositoryToDateTime_(updatedAt)
  ];
}

function planRepositoryFromRow_(row, displayRow, config, timeZone) {
  return {
    id: planRepositoryToText_(row[0]),
    period: planRepositoryFromPeriod_(row[1], displayRow[1], config.periodType, timeZone),
    size: planRepositoryToText_(row[2]),
    inspectionPlan: planRepositoryToNumber_(row[3]),
    finishedPlan: planRepositoryToNumber_(row[4]),
    note: planRepositoryToText_(row[5]),
    createdAt: planRepositoryFromDateTime_(row[6], timeZone),
    updatedAt: planRepositoryFromDateTime_(row[7], timeZone)
  };
}

function planRepositoryToPeriod_(value, periodType, timeZone) {
  var text = String(value === null || value === undefined ? "" : value).trim();
  var match = periodType === "month"
    ? text.match(/^(\d{4})-(\d{2})$/)
    : text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error("Không thể chuyển đổi giá trị thời gian: " + text + ".");

  var dateText = periodType === "month" ? text + "-01" : text;
  var date;
  try {
    date = Utilities.parseDate(dateText, timeZone, "yyyy-MM-dd");
  } catch (error) {
    throw new Error("Không thể chuyển đổi giá trị thời gian: " + text + ".");
  }

  var actualText = Utilities.formatDate(
    date,
    timeZone,
    periodType === "month" ? "yyyy-MM" : "yyyy-MM-dd"
  );
  if (actualText !== text) {
    throw new Error("Không thể chuyển đổi giá trị thời gian: " + text + ".");
  }
  return date;
}

function planRepositoryFromPeriod_(value, displayValue, periodType, timeZone) {
  if (!(value instanceof Date) || isNaN(value.getTime())) {
    throw new Error("Giá trị thời gian trong Google Sheet không phải Date hợp lệ.");
  }

  var parts = String(displayValue || "").trim().split("/");
  var canonical;
  if (periodType === "month" && parts.length === 2) {
    canonical = String(parts[1]).padStart(4, "0") + "-" + String(parts[0]).padStart(2, "0");
  } else if (periodType === "day" && parts.length === 3) {
    canonical = String(parts[2]).padStart(4, "0") + "-" +
      String(parts[1]).padStart(2, "0") + "-" + String(parts[0]).padStart(2, "0");
  } else {
    throw new Error("Định dạng thời gian trong Google Sheet không hợp lệ: " + displayValue + ".");
  }

  planRepositoryToPeriod_(canonical, periodType, timeZone);
  return canonical;
}

function planRepositoryToDateTime_(value) {
  if (value === "" || value === null || value === undefined) return "";
  if (value instanceof Date && !isNaN(value.getTime())) return new Date(value.getTime());
  throw new Error("Không thể chuyển đổi giá trị ngày giờ.");
}

function planRepositoryFromDateTime_(value, timeZone) {
  if (value === "" || value === null || value === undefined) return "";
  if (!(value instanceof Date) || isNaN(value.getTime())) {
    throw new Error("Giá trị ngày giờ trong Google Sheet không phải Date hợp lệ.");
  }
  return Utilities.formatDate(value, timeZone, "yyyy-MM-dd'T'HH:mm:ss");
}

function planRepositoryToNumber_(value) {
  if (value === "" || value === null || value === undefined) return "";
  if (typeof value === "number" && isFinite(value)) return value;
  var number = Number(value);
  if (!isFinite(number)) throw new Error("Không thể chuyển đổi giá trị số: " + value + ".");
  return number;
}

function planRepositoryToText_(value) {
  return value === null || value === undefined ? "" : String(value);
}

function planRepositoryIsEmptyRow_(row) {
  return row.every(function(value) {
    return value === "" || value === null || value === undefined;
  });
}

function planRepositoryGetSheet_(spreadsheet, config) {
  var sheet = spreadsheet.getSheetByName(config.sheetName);
  if (!sheet) throw new Error("Không tìm thấy sheet " + config.sheetName + ".");
  return sheet;
}

function planRepositoryGetTimeZone_(spreadsheet) {
  var timeZone = spreadsheet.getSpreadsheetTimeZone();
  if (!timeZone) throw new Error("Spreadsheet chưa cấu hình timezone.");
  return timeZone;
}

function planRepositoryValidateHeaders_(sheet, config) {
  var headerColumnCount = Math.max(sheet.getLastColumn(), PLAN_REPOSITORY_CONFIG.columnCount);
  var actualHeaders = sheet
    .getRange(1, 1, 1, headerColumnCount)
    .getDisplayValues()[0];
  var mismatches = [];

  for (var index = 0; index < config.headers.length; index++) {
    var actual = String(actualHeaders[index] || "").trim();
    if (actual !== config.headers[index]) {
      mismatches.push(
        "cột " + (index + 1) + ': cần "' + config.headers[index] +
        '", hiện là "' + (actual || "(trống)") + '"'
      );
    }
  }

  for (var extraIndex = config.headers.length; extraIndex < actualHeaders.length; extraIndex++) {
    var extraHeader = String(actualHeaders[extraIndex] || "").trim();
    if (extraHeader) {
      mismatches.push(
        "cột " + (extraIndex + 1) + ': header dư "' + extraHeader + '"'
      );
    }
  }

  if (mismatches.length) {
    throw new Error(
      "Header sheet " + config.sheetName + " không hợp lệ: " + mismatches.join("; ") +
      ". Cấu trúc yêu cầu: " + config.headers.join(" | ") + "."
    );
  }
}

function planRepositorySetupSheets_() {
  var spreadsheet = getSpreadsheet();
  if (!spreadsheet) throw new Error("Không thể mở Spreadsheet dữ liệu.");
  var configs = [PLAN_REPOSITORY_CONFIG.monthly, PLAN_REPOSITORY_CONFIG.daily];

  configs.forEach(function(config) {
    var existingSheet = spreadsheet.getSheetByName(config.sheetName);
    if (existingSheet) planRepositoryValidateHeaders_(existingSheet, config);
  });

  return {
    success: true,
    sheets: configs.map(function(config) {
      return planRepositorySetupSheet_(spreadsheet, config);
    })
  };
}

function planRepositorySetupSheet_(spreadsheet, config) {
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
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, PLAN_REPOSITORY_CONFIG.columnCount)
    .setFontWeight("bold")
    .setBackground("#1F4E78")
    .setFontColor("#FFFFFF");
  sheet.getRange(2, 2, Math.max(sheet.getMaxRows() - 1, 1), 1)
    .setNumberFormat(config.periodType === "month" ? "MM/yyyy" : "dd/MM/yyyy");
  sheet.getRange(2, 4, Math.max(sheet.getMaxRows() - 1, 1), 2).setNumberFormat("0");
  sheet.getRange(2, 7, Math.max(sheet.getMaxRows() - 1, 1), 2)
    .setNumberFormat("dd/MM/yyyy HH:mm:ss");
  sheet.autoResizeColumns(1, PLAN_REPOSITORY_CONFIG.columnCount);

  return {
    sheetName: config.sheetName,
    created: true,
    existingDataPreserved: true
  };
}
