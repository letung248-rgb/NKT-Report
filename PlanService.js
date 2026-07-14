/**
 * Public read API used by PlanModule.html.
 * No create/update/delete operation is exposed in Sprint 8.3.1.
 */
function getPlanModuleData() {
  try {
    var repositoryData = planRepositoryReadAll_();
    var timeZone = repositoryData.timeZone || Session.getScriptTimeZone();
    var monthly = planServiceMapRows_(repositoryData.monthly, "thang", timeZone);
    var daily = planServiceMapRows_(repositoryData.daily, "ngay", timeZone);

    return {
      success: true,
      data: {
        monthly: monthly,
        daily: daily
      },
      meta: {
        monthlySheet: repositoryData.monthly.sheetName,
        dailySheet: repositoryData.daily.sheetName,
        monthlyCount: monthly.length,
        dailyCount: daily.length,
        readOnly: true
      }
    };
  } catch (error) {
    var message = error && error.message ? error.message : String(error);
    Logger.log("getPlanModuleData error: " + message);
    throw new Error("Không đọc được dữ liệu kế hoạch: " + message);
  }
}

function planServiceMapRows_(sheetData, type, timeZone) {
  var result = [];
  var rows = sheetData && Array.isArray(sheetData.rows) ? sheetData.rows : [];

  for (var index = 0; index < rows.length; index++) {
    var repositoryRow = rows[index];
    var values = repositoryRow.values || [];
    var displayValues = repositoryRow.displayValues || [];
    if (planServiceIsEmptyRow_(values, displayValues)) continue;

    result.push({
      id: (type === "thang" ? "T-" : "N-") + repositoryRow.rowNumber,
      loai: type,
      thoiGian: planServiceNormalizePeriod_(values[0], displayValues[0], type, timeZone),
      size: planServiceText_(displayValues[1], values[1]),
      kiemTra: planServiceNumber_(values[2]),
      thanhPham: planServiceNumber_(values[3]),
      ghiChu: planServiceText_(displayValues[4], values[4]),
      capNhatLuc: planServiceNormalizeUpdatedAt_(values[5], displayValues[5], timeZone),
      capNhatBoi: planServiceText_(displayValues[6], values[6]),
      rowNumber: repositoryRow.rowNumber
    });
  }

  return result;
}

function planServiceIsEmptyRow_(values, displayValues) {
  for (var index = 0; index < PLAN_REPOSITORY_CONFIG.columnCount; index++) {
    var rawValue = values[index];
    var displayValue = displayValues[index];
    if (rawValue !== "" && rawValue !== null && rawValue !== undefined) return false;
    if (String(displayValue || "").trim()) return false;
  }
  return true;
}

function planServiceNormalizePeriod_(rawValue, displayValue, type, timeZone) {
  if (rawValue instanceof Date && !isNaN(rawValue.getTime())) {
    return Utilities.formatDate(rawValue, timeZone, type === "thang" ? "yyyy-MM" : "yyyy-MM-dd");
  }

  var text = planServiceText_(displayValue, rawValue);
  if (!text) return "";

  var isoDate = text.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (isoDate) {
    return type === "thang"
      ? isoDate[1] + "-" + isoDate[2]
      : isoDate[1] + "-" + isoDate[2] + "-" + (isoDate[3] || "01");
  }

  var vietnameseDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (vietnameseDate) {
    var day = String(vietnameseDate[1]).padStart(2, "0");
    var month = String(vietnameseDate[2]).padStart(2, "0");
    return type === "thang"
      ? vietnameseDate[3] + "-" + month
      : vietnameseDate[3] + "-" + month + "-" + day;
  }

  var vietnameseMonth = text.match(/^(\d{1,2})\/(\d{4})$/);
  if (type === "thang" && vietnameseMonth) {
    return vietnameseMonth[2] + "-" + String(vietnameseMonth[1]).padStart(2, "0");
  }

  return text;
}

function planServiceNormalizeUpdatedAt_(rawValue, displayValue, timeZone) {
  if (rawValue instanceof Date && !isNaN(rawValue.getTime())) {
    return Utilities.formatDate(rawValue, timeZone, "yyyy-MM-dd'T'HH:mm:ss");
  }
  return planServiceText_(displayValue, rawValue);
}

function planServiceText_(displayValue, rawValue) {
  var value = displayValue !== "" && displayValue !== null && displayValue !== undefined
    ? displayValue
    : rawValue;
  return value === null || value === undefined ? "" : String(value).trim();
}

function planServiceNumber_(value) {
  if (typeof value === "number" && isFinite(value)) return value;
  var normalized = String(value === null || value === undefined ? "" : value)
    .replace(/\s/g, "")
    .replace(/,/g, "");
  var number = Number(normalized);
  return isFinite(number) ? number : 0;
}
