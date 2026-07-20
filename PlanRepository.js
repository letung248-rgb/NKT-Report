var PLAN_REPOSITORY_CONFIG = {
  daily: {
    sheetName: "KE_HOACH_NGAY",
    periodType: "day",
    periodHeader: "Ngay",
    headers: [
      "ID", "Ngay", "Size", "KH_KiemTra", "KH_ThanhPham", "GhiChu", "NguoiCapNhat", "CapNhatLuc"
    ]
  },
  monthly: {
    sheetName: "KE_HOACH_THANG",
    periodType: "month",
    periodHeader: "Thang",
    headers: [
      "ID", "Thang", "Size", "KH_KiemTra", "KH_ThanhPham", "GhiChu", "NguoiCapNhat", "CapNhatLuc"
    ]
  },
  columnCount: 8
};

function planRepositoryReadDaily() {
  return planRepositoryRead_(PLAN_REPOSITORY_CONFIG.daily);
}

function planRepositoryReadMonthly() {
  return planRepositoryRead_(PLAN_REPOSITORY_CONFIG.monthly);
}

function planRepositoryInsertDaily(record) {
  return planRepositoryInsert_(PLAN_REPOSITORY_CONFIG.daily, record);
}

function planRepositoryInsertMonthly(record) {
  return planRepositoryInsert_(PLAN_REPOSITORY_CONFIG.monthly, record);
}

function planRepositoryUpdateDailyById(id, record) {
  return planRepositoryUpdateById_(PLAN_REPOSITORY_CONFIG.daily, id, record);
}

function planRepositoryUpdateMonthlyById(id, record) {
  return planRepositoryUpdateById_(PLAN_REPOSITORY_CONFIG.monthly, id, record);
}

function planRepositoryExistsDaily(period, size, excludedId) {
  return planRepositoryExists_(PLAN_REPOSITORY_CONFIG.daily, period, size, excludedId);
}

function planRepositoryExistsMonthly(period, size, excludedId) {
  return planRepositoryExists_(PLAN_REPOSITORY_CONFIG.monthly, period, size, excludedId);
}

function planRepositoryReadAll_() {
  return {
    daily: {
      sheetName: PLAN_REPOSITORY_CONFIG.daily.sheetName,
      rows: planRepositoryReadDaily()
    },
    monthly: {
      sheetName: PLAN_REPOSITORY_CONFIG.monthly.sheetName,
      rows: planRepositoryReadMonthly()
    }
  };
}

function planRepositoryRead_(config) {
  var spreadsheet = getSpreadsheet();
  if (!spreadsheet) throw new Error("Khong the mo Spreadsheet du lieu.");

  var sheet = planRepositoryGetSheet_(spreadsheet, config);
  planRepositoryValidateHeaders_(sheet, config);

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var range = sheet.getRange(2, 1, lastRow - 1, PLAN_REPOSITORY_CONFIG.columnCount);
  var values = range.getValues();
  var displayValues = range.getDisplayValues();
  var rows = [];

  for (var index = 0; index < values.length; index++) {
    if (!planRepositoryIsEmptyRow_(values[index])) {
      rows.push(planRepositoryFromRow_(values[index], displayValues[index], config, index + 2));
    }
  }

  return rows;
}

function planRepositoryInsert_(config, record) {
  var spreadsheet = getSpreadsheet();
  if (!spreadsheet) throw new Error("Khong the mo Spreadsheet du lieu.");

  var sheet = planRepositoryGetSheet_(spreadsheet, config);
  planRepositoryValidateHeaders_(sheet, config);

  var normalizedRecord = planRepositoryNormalizeWriteRecord_(record, planRepositoryNewId_());
  var row = planRepositoryToRow_(normalizedRecord);
  var targetRow = sheet.getLastRow() + 1;
  var range = sheet.getRange(targetRow, 1, 1, PLAN_REPOSITORY_CONFIG.columnCount);
  range.setValues([row]);

  return planRepositoryFromRow_(range.getValues()[0], range.getDisplayValues()[0], config, targetRow);
}

function planRepositoryUpdateById_(config, id, record) {
  var spreadsheet = getSpreadsheet();
  if (!spreadsheet) throw new Error("Khong the mo Spreadsheet du lieu.");

  var sheet = planRepositoryGetSheet_(spreadsheet, config);
  planRepositoryValidateHeaders_(sheet, config);

  var rowNumber = planRepositoryFindRowNumberById_(sheet, id);
  var normalizedRecord = planRepositoryNormalizeWriteRecord_(record, String(id || ""));
  var range = sheet.getRange(rowNumber, 1, 1, PLAN_REPOSITORY_CONFIG.columnCount);
  range.setValues([planRepositoryToRow_(normalizedRecord)]);

  return planRepositoryFromRow_(range.getValues()[0], range.getDisplayValues()[0], config, rowNumber);
}

function planRepositoryExists_(config, period, size, excludedId) {
  var targetKey = planRepositoryBusinessKey_(period, size);
  var rows = planRepositoryRead_(config);

  for (var index = 0; index < rows.length; index++) {
    var row = rows[index];
    if (excludedId && String(row.id || "") === String(excludedId || "")) continue;
    if (planRepositoryBusinessKey_(row.period, row.size) === targetKey) return true;
  }

  return false;
}

function planRepositoryFindRowNumberById_(sheet, id) {
  var normalizedId = String(id || "").trim();
  if (!normalizedId) throw new Error("ID ke hoach la bat buoc.");

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) throw new Error("Khong tim thay ke hoach ID " + normalizedId + ".");

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var index = 0; index < ids.length; index++) {
    if (String(ids[index][0] || "") === normalizedId) return index + 2;
  }

  throw new Error("Khong tim thay ke hoach ID " + normalizedId + ".");
}

function planRepositoryNormalizeWriteRecord_(record, id) {
  var input = record || {};
  return {
    id: String(id || input.id || "").trim(),
    period: planRepositoryToText_(input.period),
    size: planRepositoryToText_(input.size),
    inspectionPlan: planRepositoryToNumber_(input.inspectionPlan),
    finishedPlan: planRepositoryToNumber_(input.finishedPlan),
    note: planRepositoryToText_(input.note),
    updatedBy: planRepositoryToText_(input.updatedBy),
    updatedAt: input.updatedAt instanceof Date && !isNaN(input.updatedAt.getTime())
      ? input.updatedAt
      : new Date()
  };
}

function planRepositoryToRow_(record) {
  return [
    record.id,
    record.period,
    record.size,
    record.inspectionPlan,
    record.finishedPlan,
    record.note,
    record.updatedBy,
    record.updatedAt
  ];
}

function planRepositoryFromRow_(row, displayRow, config, rowNumber) {
  return {
    id: planRepositoryToText_(row[0]),
    period: planRepositoryToText_(displayRow[1] || row[1]),
    size: planRepositoryToText_(displayRow[2] || row[2]),
    inspectionPlan: planRepositoryToNumber_(row[3]),
    finishedPlan: planRepositoryToNumber_(row[4]),
    note: planRepositoryToText_(displayRow[5] || row[5]),
    updatedBy: planRepositoryToText_(displayRow[6] || row[6]),
    updatedAt: planRepositoryDateTimeText_(row[7], displayRow[7]),
    rowNumber: rowNumber,
    sheetName: config.sheetName
  };
}

function planRepositoryValidateHeaders_(sheet, config) {
  var actualHeaders = sheet
    .getRange(1, 1, 1, PLAN_REPOSITORY_CONFIG.columnCount)
    .getDisplayValues()[0];
  var mismatches = [];

  for (var index = 0; index < config.headers.length; index++) {
    var expected = config.headers[index];
    var actual = String(actualHeaders[index] || "").trim();
    if (actual !== expected) {
      mismatches.push("cot " + (index + 1) + ': can "' + expected + '", hien la "' + (actual || "(trong)") + '"');
    }
  }

  var lastColumn = sheet.getLastColumn ? sheet.getLastColumn() : PLAN_REPOSITORY_CONFIG.columnCount;
  if (lastColumn > PLAN_REPOSITORY_CONFIG.columnCount) {
    var extraHeaders = sheet
      .getRange(1, PLAN_REPOSITORY_CONFIG.columnCount + 1, 1, lastColumn - PLAN_REPOSITORY_CONFIG.columnCount)
      .getDisplayValues()[0];
    for (var extraIndex = 0; extraIndex < extraHeaders.length; extraIndex++) {
      var extraHeader = String(extraHeaders[extraIndex] || "").trim();
      if (extraHeader) {
        mismatches.push("cot " + (PLAN_REPOSITORY_CONFIG.columnCount + extraIndex + 1) + ': header du "' + extraHeader + '"');
      }
    }
  }

  if (mismatches.length) {
    throw new Error(
      "Header sheet " + config.sheetName + " khong hop le: " + mismatches.join("; ") +
      ". Cau truc yeu cau: " + config.headers.join(" | ") + "."
    );
  }
}

function planRepositoryGetSheet_(spreadsheet, config) {
  var sheet = spreadsheet.getSheetByName(config.sheetName);
  if (!sheet) throw new Error("Khong tim thay sheet " + config.sheetName + ".");
  return sheet;
}

function planRepositoryBusinessKey_(period, size) {
  return planRepositoryToText_(period) + "\u0001" + planRepositoryToText_(size).toLocaleLowerCase("vi");
}

function planRepositoryNewId_() {
  if (typeof Utilities !== "undefined" && Utilities.getUuid) return Utilities.getUuid();
  return "plan-" + Date.now() + "-" + Math.floor(Math.random() * 1000000);
}

function planRepositoryDateTimeText_(value, displayValue) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  }
  return planRepositoryToText_(displayValue || value);
}

function planRepositoryToText_(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function planRepositoryToNumber_(value) {
  if (value === "" || value === null || value === undefined) return 0;
  if (typeof value === "number" && isFinite(value)) return value;
  var number = Number(String(value).replace(/\s/g, "").replace(/,/g, ""));
  if (!isFinite(number)) throw new Error("Gia tri so khong hop le: " + value + ".");
  return number;
}

function planRepositoryIsEmptyRow_(row) {
  for (var index = 0; index < PLAN_REPOSITORY_CONFIG.columnCount; index++) {
    var value = row[index];
    if (value !== "" && value !== null && value !== undefined) return false;
  }
  return true;
}
