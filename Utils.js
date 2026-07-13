/**
 * Lấy đối tượng Spreadsheet
 */
let __SS_CACHE = null;
const PERFORMANCE_DEBUG_ENABLED = false;
const DASH_DATA_CACHE_TTL_SECONDS = 300;
const DASH_DATA_CACHE_VERSION_KEY = "DASH_DATA_VER";
const DASH_DATA_CACHE_KEY_PREFIX = "dashboard:data:transactions:v1:";
const DASH_DATA_CACHE_MAX_BYTES = 90 * 1024;
const DASH_DATA_CACHE_FIELDS = [
  "date", "shift", "process", "qty", "pipeNo", "entryNo", "status",
  "defectReason", "importStatus", "washingCount", "waterMeter", "size",
  "bundleCode", "compartment", "well", "rig", "wellProfile", "worker1",
  "worker2", "recordStatus", "receiveTime", "notes", "id", "rowIdx"
];
const DASH_DATA_CACHE_DATE_FIELDS = {
  date: true,
  receiveTime: true
};
const DASH_PLAN_CACHE_TTL_SECONDS = 300;
const DASH_PLAN_CACHE_VERSION_KEY = "DASH_PLAN_VER";
const DASH_PLAN_CACHE_KEY_PREFIX = "dashboard:plan:v1:";
const DASH_PLAN_CACHE_MAX_BYTES = 90 * 1024;
const DASH_PLAN_CACHE_FIELDS = ["date", "month", "size", "qty"];

function performanceTimerStart_() {
  return PERFORMANCE_DEBUG_ENABLED ? Date.now() : 0;
}

function performanceLog_(scope, phase, startedAt, details) {
  if (!PERFORMANCE_DEBUG_ENABLED || !startedAt) return;
  const fields = [
    "PERF",
    "scope=" + scope,
    "phase=" + phase,
    "durationMs=" + (Date.now() - startedAt)
  ];
  const safeDetails = details || {};
  Object.keys(safeDetails).forEach(function(key) {
    fields.push(key + "=" + safeDetails[key]);
  });
  Logger.log(fields.join(" | "));
}

function getSpreadsheet() {
  if (__SS_CACHE) return __SS_CACHE;

  if (typeof SPREADSHEET_ID !== "undefined" && SPREADSHEET_ID) {
    try {
      __SS_CACHE = SpreadsheetApp.openById(SPREADSHEET_ID);
      return __SS_CACHE;
    } catch (e) {
      Logger.log("openById failed, fallback to active spreadsheet: " + e);
    }
  }

  __SS_CACHE = SpreadsheetApp.getActiveSpreadsheet();
  return __SS_CACHE;
}

function getDashboardDataCacheVersion_() {
  try {
    return PropertiesService.getScriptProperties().getProperty(DASH_DATA_CACHE_VERSION_KEY) || "0";
  } catch (error) {
    Logger.log("getDashboardDataCacheVersion_ error: " + error);
    return "0";
  }
}

function getDashboardDataCacheKey_(version) {
  return DASH_DATA_CACHE_KEY_PREFIX + (version || getDashboardDataCacheVersion_());
}

function serializeDashboardTransactionsCache_(transactions) {
  const rows = (transactions || []).map(function(transaction) {
    return DASH_DATA_CACHE_FIELDS.map(function(field) {
      const value = transaction[field];
      return DASH_DATA_CACHE_DATE_FIELDS[field] && value instanceof Date ? value.getTime() : value;
    });
  });
  const json = JSON.stringify(rows);
  const blob = Utilities.newBlob(json, "application/json", "dashboard-transactions.json");
  const zipped = Utilities.gzip(blob);
  return Utilities.base64Encode(zipped.getBytes());
}

function deserializeDashboardTransactionsCache_(payload) {
  const bytes = Utilities.base64Decode(payload);
  const zipped = Utilities.newBlob(bytes, "application/octet-stream", "dashboard-transactions.gz");
  const json = Utilities.ungzip(zipped).getDataAsString();
  const rows = JSON.parse(json);

  return (rows || []).map(function(row) {
    const transaction = {};
    for (let i = 0; i < DASH_DATA_CACHE_FIELDS.length; i++) {
      const field = DASH_DATA_CACHE_FIELDS[i];
      const value = row[i];
      transaction[field] = DASH_DATA_CACHE_DATE_FIELDS[field] && typeof value === "number"
        ? new Date(value)
        : value;
    }
    return transaction;
  });
}

function readDashboardDataCache_() {
  try {
    const cacheKey = getDashboardDataCacheKey_();
    const payload = CacheService.getScriptCache().get(cacheKey);
    if (payload === null) return null;
    Logger.log("DASH_CACHE data hit | key=" + cacheKey);
    return deserializeDashboardTransactionsCache_(payload);
  } catch (error) {
    Logger.log("DASH_CACHE data read error | " + error);
    return null;
  }
}

function writeDashboardDataCache_(transactions) {
  try {
    const cacheKey = getDashboardDataCacheKey_();
    const payload = serializeDashboardTransactionsCache_(transactions);
    const payloadBytes = Utilities.newBlob(payload, "text/plain").getBytes().length;
    if (payloadBytes > DASH_DATA_CACHE_MAX_BYTES) {
      Logger.log("DASH_CACHE data write skipped payload too large | key=" + cacheKey + " | payloadBytes=" + payloadBytes);
      return false;
    }

    CacheService.getScriptCache().put(
      cacheKey,
      payload,
      DASH_DATA_CACHE_TTL_SECONDS
    );
    Logger.log("DASH_CACHE data write ok | key=" + cacheKey + " | payloadBytes=" + payloadBytes + " | ttl=" + DASH_DATA_CACHE_TTL_SECONDS);
    return true;
  } catch (error) {
    Logger.log("writeDashboardDataCache_ error: " + error);
    return false;
  }
}

function invalidateDashboardDataCache_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const currentVersion = props.getProperty(DASH_DATA_CACHE_VERSION_KEY) || "0";
    CacheService.getScriptCache().remove(getDashboardDataCacheKey_(currentVersion));
    props.setProperty(DASH_DATA_CACHE_VERSION_KEY, String(Date.now()));
    return true;
  } catch (error) {
    Logger.log("invalidateDashboardDataCache_ error: " + error);
    return false;
  }
}

function getDashboardPlanCacheVersion_() {
  try {
    return PropertiesService.getScriptProperties().getProperty(DASH_PLAN_CACHE_VERSION_KEY) || "0";
  } catch (error) {
    Logger.log("getDashboardPlanCacheVersion_ error: " + error);
    return "0";
  }
}

function getDashboardPlanCacheKey_(version) {
  return DASH_PLAN_CACHE_KEY_PREFIX + (version || getDashboardPlanCacheVersion_());
}

function serializeDashboardPlansCache_(plans) {
  const rows = (plans || []).map(function(plan) {
    return DASH_PLAN_CACHE_FIELDS.map(function(field) {
      return plan[field];
    });
  });
  const json = JSON.stringify(rows);
  const blob = Utilities.newBlob(json, "application/json", "dashboard-plans.json");
  const zipped = Utilities.gzip(blob);
  return Utilities.base64Encode(zipped.getBytes());
}

function deserializeDashboardPlansCache_(payload) {
  const bytes = Utilities.base64Decode(payload);
  const zipped = Utilities.newBlob(bytes, "application/octet-stream", "dashboard-plans.gz");
  const json = Utilities.ungzip(zipped).getDataAsString();
  const rows = JSON.parse(json);

  return (rows || []).map(function(row) {
    const plan = {};
    for (let i = 0; i < DASH_PLAN_CACHE_FIELDS.length; i++) {
      plan[DASH_PLAN_CACHE_FIELDS[i]] = row[i];
    }
    return plan;
  });
}

function readDashboardPlanCache_() {
  try {
    const cacheKey = getDashboardPlanCacheKey_();
    const payload = CacheService.getScriptCache().get(cacheKey);
    if (payload === null) return null;
    Logger.log("DASH_CACHE plan hit | key=" + cacheKey);
    return deserializeDashboardPlansCache_(payload);
  } catch (error) {
    Logger.log("DASH_CACHE plan read error | " + error);
    return null;
  }
}

function writeDashboardPlanCache_(plans) {
  try {
    const cacheKey = getDashboardPlanCacheKey_();
    const payload = serializeDashboardPlansCache_(plans);
    const payloadBytes = Utilities.newBlob(payload, "text/plain").getBytes().length;
    if (payloadBytes > DASH_PLAN_CACHE_MAX_BYTES) {
      Logger.log("DASH_CACHE plan write skipped payload too large | key=" + cacheKey + " | payloadBytes=" + payloadBytes);
      return false;
    }

    CacheService.getScriptCache().put(
      cacheKey,
      payload,
      DASH_PLAN_CACHE_TTL_SECONDS
    );
    Logger.log("DASH_CACHE plan write ok payloadBytes=" + payloadBytes + " | key=" + cacheKey + " | ttl=" + DASH_PLAN_CACHE_TTL_SECONDS);
    return true;
  } catch (error) {
    Logger.log("DASH_CACHE plan write error | " + error);
    return false;
  }
}

const DATA_COLUMN_ALIASES = {
  date: ["ngay"],
  shift: ["ca"],
  process: ["nguyen cong"],
  qty: ["so luong ong"],
  pipeNo: ["so ong chi tiet"],
  entryNo: ["lan nhap xuong"],
  status: ["tinh trang ong", "tinh trang ong dat"],
  defectReason: ["nguyen nhan loai"],
  importStatus: ["tinh trang nhap"],
  washingCount: ["so lan rua"],
  waterMeter: ["dong ho nuoc"],
  size: ["loai ong"],
  bundleCode: ["ma bo"],
  compartment: ["khoang"],
  well: ["tu gieng"],
  rig: ["tu gian"],
  wellProfile: ["ho so gieng"],
  worker1: ["nguoi th 1"],
  worker2: ["nguoi th 2"],
  recordStatus: ["tinh trang"],
  receiveTime: ["thoi gian nhan"],
  notes: ["ghi chu"],
  id: ["id"]
};

const DATA_COLUMN_FALLBACK = {
  date: 0,
  shift: 1,
  process: 2,
  qty: 3,
  pipeNo: 4,
  entryNo: 5,
  status: 6,
  defectReason: 7,
  importStatus: 8,
  washingCount: 9,
  waterMeter: 10,
  size: 11,
  bundleCode: 12,
  compartment: 13,
  well: 14,
  rig: 15,
  wellProfile: 16,
  worker1: 17,
  worker2: 18,
  recordStatus: 19,
  receiveTime: 20,
  notes: 21,
  id: 22
};

function getDataTableInfo(values) {
  const maxScanRows = Math.min(10, values.length);

  for (let r = 0; r < maxScanRows; r++) {
    const normalizedHeader = {};
    const row = values[r] || [];

    for (let c = 0; c < row.length; c++) {
      const key = normalizeString(row[c]);
      if (key) normalizedHeader[key] = c;
    }

    const columns = buildDataColumnMap(normalizedHeader);
    if (hasDataHeaderField(normalizedHeader, "pipeNo")
        && hasDataHeaderField(normalizedHeader, "process")
        && hasDataHeaderField(normalizedHeader, "date")) {
      return { headerRowIdx: r, columns: columns };
    }
  }

  return { headerRowIdx: 0, columns: Object.assign({}, DATA_COLUMN_FALLBACK) };
}

function hasDataHeaderField(normalizedHeader, field) {
  const aliases = DATA_COLUMN_ALIASES[field] || [];
  for (let i = 0; i < aliases.length; i++) {
    if (normalizedHeader[aliases[i]] !== undefined) return true;
  }
  return false;
}

function buildDataColumnMap(normalizedHeader) {
  const columns = {};

  for (let field in DATA_COLUMN_ALIASES) {
    const aliases = DATA_COLUMN_ALIASES[field];
    for (let i = 0; i < aliases.length; i++) {
      const idx = normalizedHeader[aliases[i]];
      if (idx !== undefined) {
        columns[field] = idx;
        break;
      }
    }

    if (columns[field] === undefined && DATA_COLUMN_FALLBACK[field] !== undefined) {
      columns[field] = DATA_COLUMN_FALLBACK[field];
    }
  }

  return columns;
}

function getDataValue(row, tableInfo, field) {
  const idx = tableInfo && tableInfo.columns ? tableInfo.columns[field] : DATA_COLUMN_FALLBACK[field];
  return idx === undefined ? "" : row[idx];
}

function normalizeReceiveTime(dateValue, timeValue) {
  if (timeValue instanceof Date) return timeValue;

  const text = (timeValue || "").toString().trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return timeValue;

  const baseDate = parseDashboardDate(dateValue) || new Date(1970, 0, 1);
  baseDate.setHours(parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3] || "0", 10), 0);
  return baseDate;
}

function parseDashboardDate(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return new Date(value.getTime());
  }

  const text = (value || "").toString().trim();
  if (!text) return null;

  let match = text.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (match) {
    const months = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const month = months[match[2].toLowerCase()];
    if (month !== undefined) return new Date(parseInt(match[3], 10), month, parseInt(match[1], 10));
  }

  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    return new Date(parseInt(match[3], 10), parseInt(match[2], 10) - 1, parseInt(match[1], 10));
  }

  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * 1. Đọc dữ liệu thô từ Sheet Data
 */
function getRawTransactions() {
  const totalStartedAt = performanceTimerStart_();
  const cacheStartedAt = performanceTimerStart_();
  const cachedTransactions = readDashboardDataCache_();
  if (cachedTransactions !== null) {
    performanceLog_("getRawTransactions", "cache_read", cacheStartedAt, {
      cache: "hit",
      transactionCount: cachedTransactions.length
    });
    performanceLog_("getRawTransactions", "total", totalStartedAt, {
      cache: "hit",
      transactionCount: cachedTransactions.length
    });
    return cachedTransactions;
  }
  performanceLog_("getRawTransactions", "cache_read", cacheStartedAt, { cache: "miss" });
  Logger.log("DASH_CACHE data miss | key=" + getDashboardDataCacheKey_());

  const ss = getSpreadsheet();
  if (!ss) return [];
  const sheet = ss.getSheetByName(SHEET_DATA);
  if (!sheet) return [];
  
  const sheetReadStartedAt = performanceTimerStart_();
  const data = sheet.getDataRange().getValues();
  performanceLog_("getRawTransactions", "sheet_read", sheetReadStartedAt, { rowCount: data.length });
  if (data.length <= 1) {
    writeDashboardDataCache_([]);
    performanceLog_("getRawTransactions", "total", totalStartedAt, { cache: "miss", transactionCount: 0 });
    return [];
  }

  const tableInfo = getDataTableInfo(data);
  const normalizeStartedAt = performanceTimerStart_();
  const transactions = [];
  // Đọc từ dòng sau header thật của sheet Data.
  for (let i = tableInfo.headerRowIdx + 1; i < data.length; i++) {
    let row = data[i];
    let dateVal = getDataValue(row, tableInfo, "date");
    let id = getDataValue(row, tableInfo, "id");
    let pipeNo = (getDataValue(row, tableInfo, "pipeNo") || "").toString().trim();
    let process = (getDataValue(row, tableInfo, "process") || "").toString().trim();
    
    // Bỏ qua dòng trống
    if (!dateVal && !id && !pipeNo && !process) continue;

    let rawReceiveTime = getDataValue(row, tableInfo, "receiveTime");
    
    transactions.push({
      date: dateVal,
      shift: (getDataValue(row, tableInfo, "shift") || "").toString().trim(),
      process: process,
      qty: parseFloat(getDataValue(row, tableInfo, "qty")) || 1,
      pipeNo: pipeNo,
      entryNo: (getDataValue(row, tableInfo, "entryNo") || "").toString().trim(),
      status: (getDataValue(row, tableInfo, "status") || "").toString().trim(),
      defectReason: (getDataValue(row, tableInfo, "defectReason") || "").toString().trim(),
      importStatus: (getDataValue(row, tableInfo, "importStatus") || "").toString().trim(),
      washingCount: parseFloat(getDataValue(row, tableInfo, "washingCount")) || 0,
      waterMeter: getDataValue(row, tableInfo, "waterMeter"),
      size: (getDataValue(row, tableInfo, "size") || "").toString().trim(),
      bundleCode: (getDataValue(row, tableInfo, "bundleCode") || "").toString().trim(),
      compartment: (getDataValue(row, tableInfo, "compartment") || "").toString().trim(),
      well: (getDataValue(row, tableInfo, "well") || "").toString().trim(),
      rig: (getDataValue(row, tableInfo, "rig") || "").toString().trim(),
      wellProfile: (getDataValue(row, tableInfo, "wellProfile") || "").toString().trim(),
      worker1: (getDataValue(row, tableInfo, "worker1") || "").toString().trim(),
      worker2: (getDataValue(row, tableInfo, "worker2") || "").toString().trim(),
      recordStatus: (getDataValue(row, tableInfo, "recordStatus") || "").toString().trim(),
      receiveTime: normalizeReceiveTime(dateVal, rawReceiveTime),
      notes: (getDataValue(row, tableInfo, "notes") || "").toString().trim(),
      id: (id || "").toString().trim(),
      rowIdx: i + 1
    });
  }

  performanceLog_("getRawTransactions", "normalize", normalizeStartedAt, {
    rowCount: data.length,
    transactionCount: transactions.length
  });
  const cacheWriteStartedAt = performanceTimerStart_();
  writeDashboardDataCache_(transactions);
  performanceLog_("getRawTransactions", "cache_write", cacheWriteStartedAt, {
    transactionCount: transactions.length
  });
  performanceLog_("getRawTransactions", "total", totalStartedAt, {
    cache: "miss",
    transactionCount: transactions.length
  });
  return transactions;
}

/**
 * 2. Đọc dữ liệu từ Sheet Kế hoạch
 */
function getPlanData() {
  const totalStartedAt = performanceTimerStart_();
  const cacheStartedAt = performanceTimerStart_();
  const cachedPlans = readDashboardPlanCache_();
  if (cachedPlans !== null) {
    performanceLog_("getPlanData", "cache_read", cacheStartedAt, {
      cache: "hit",
      planCount: cachedPlans.length
    });
    performanceLog_("getPlanData", "total", totalStartedAt, {
      cache: "hit",
      planCount: cachedPlans.length
    });
    return cachedPlans;
  }
  performanceLog_("getPlanData", "cache_read", cacheStartedAt, { cache: "miss" });
  Logger.log("DASH_CACHE plan miss | key=" + getDashboardPlanCacheKey_());

  const ss = getSpreadsheet();
  if (!ss) return [];
  const sheet = ss.getSheetByName(SHEET_PLAN);
  if (!sheet) return [];
  
  const sheetReadStartedAt = performanceTimerStart_();
  const data = sheet.getDataRange().getValues();
  performanceLog_("getPlanData", "sheet_read", sheetReadStartedAt, { rowCount: data.length });
  if (data.length <= 1) {
    writeDashboardPlanCache_([]);
    performanceLog_("getPlanData", "total", totalStartedAt, { cache: "miss", planCount: 0 });
    return []; // Bỏ qua tiêu đề
  }
  
  let header = data[0];
  let dateIdx = 0;
  let sizeIdx = 1;
  let qtyIdx = 2;
  
  if (header && header.length > 0) {
    for (let j = 0; j < header.length; j++) {
      let hName = normalizeString(header[j]);
      if (hName === "ngay") dateIdx = j;
      else if (hName === "loai ong") sizeIdx = j;
      else if (hName === "ke hoach" || hName === "so luong ke hoach") qtyIdx = j;
    }
  }
  
  const normalizeStartedAt = performanceTimerStart_();
  const plans = [];
  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    let dateVal = row[dateIdx];
    let sizeVal = (row[sizeIdx] || "").toString().trim();
    let qty = parseFloat(row[qtyIdx]) || 0;
    
    if (!dateVal || qty === 0) continue;
    
    let dateStr = "";
    let monthStr = "";
    if (dateVal instanceof Date) {
       dateStr = dateVal.toLocaleDateString('vi-VN');
       monthStr = (dateVal.getMonth() + 1) + "/" + dateVal.getFullYear();
    } else {
       dateStr = dateVal.toString().trim();
       monthStr = dateStr; 
    }
    
    plans.push({
      date: dateStr,
      month: monthStr,
      size: sizeVal,
      qty: qty
    });
  }
  performanceLog_("getPlanData", "normalize", normalizeStartedAt, {
    rowCount: data.length,
    planCount: plans.length
  });
  const cacheWriteStartedAt = performanceTimerStart_();
  writeDashboardPlanCache_(plans);
  performanceLog_("getPlanData", "cache_write", cacheWriteStartedAt, { planCount: plans.length });
  performanceLog_("getPlanData", "total", totalStartedAt, {
    cache: "miss",
    planCount: plans.length
  });
  return plans;
}

/**
 * 3. Phân loại trạng thái nghiệp vụ (Master Error Catalog tối thiểu)
 */
function validateData() {
  const ss = getSpreadsheet();
  if (!ss) return { error: "No spreadsheet found" };
  const sheet = ss.getSheetByName(SHEET_DATA);
  if (!sheet) return { error: "No Data sheet found" };
  
  const data = sheet.getDataRange().getValues();
  const tableInfo = getDataTableInfo(data);
  
  let result = {
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    warnings: [],
    errors: [],
    duplicateTransactionWarnings: []
  };
  
  if (data.length <= tableInfo.headerRowIdx + 1) return result;
  
  // Danh mục chuẩn (Master Data)
  const MASTER_PROCESSES = ["đầu vào", "rửa ống", "thông nòng", "ndt", "làm sạch", "calip ren", "ép thủy lực", "tiện ren", "thay coupling", "đóng gói"];
  const MASTER_STATUSES = ["ok", "dat", "loai", "cho sua", "thanh pham", "hong"];
  const MASTER_ERRORS = [
    "khong du chieu day", "thieu chieu day", "khuyet tat ngang", "khuyet tat doc", 
    "ro than", "ro than, an mon", "tac paraffin", "tac ong", "loai ndt", "tien lai khong dat",
    "hong ren", "hong coupling", "hong ren va coupling", "xi pin", "xi box", 
    "xi ca 2 dau", "khong lap duoc coupling", "khac"
  ];
  const MASTER_SIZES = ["Ø60", "Ø73", "Ø89", "Ø89 NVTL", "Ø114", "Ø114 NVTL"];
  
  let seenTransactions = new Set();
  
  for (let i = tableInfo.headerRowIdx + 1; i < data.length; i++) {
    let row = data[i];
    let rowIdx = i + 1;
    let process = (getDataValue(row, tableInfo, "process") || "").toString().trim().toLowerCase();
    let pipeNo = (getDataValue(row, tableInfo, "pipeNo") || "").toString().trim();
    let entryNo = (getDataValue(row, tableInfo, "entryNo") || "").toString().trim();
    let status = (getDataValue(row, tableInfo, "status") || "").toString().trim().toLowerCase();
    let defectReason = (getDataValue(row, tableInfo, "defectReason") || "").toString().trim().toLowerCase();
    let size = (getDataValue(row, tableInfo, "size") || "").toString().trim();
    let dateValue = getDataValue(row, tableInfo, "date");
    let idValue = (getDataValue(row, tableInfo, "id") || "").toString().trim();
    let receiveTimeValue = (getDataValue(row, tableInfo, "receiveTime") || "").toString().trim();
    
    // Bỏ qua dòng trống hoàn toàn
    if (!dateValue && !pipeNo && !process && !idValue) continue;
    
    result.totalRows++;
    let isRowValid = true;
    let rowErrors = [];
    let rowWarnings = [];
    
    // 1. Kiểm tra Pipe Number
    if (!pipeNo) {
      rowErrors.push("Pipe Number bị rỗng");
    } else {
      // Ký tự lạ (chỉ cho phép chữ, số, và dấu gạch ngang)
      let specialCharRegex = /[^a-zA-Z0-9-]/;
      if (specialCharRegex.test(pipeNo)) {
        rowErrors.push("Pipe Number chứa ký tự lạ: " + pipeNo);
      }
    }
    
    // Kiểm tra trùng lặp giao dịch (Pipe + Entry + Process + Status + Error + Date + Time/ID)
    if (pipeNo && process && entryNo) {
      let dateStr = (dateValue || "").toString().trim();
      let timeOrId = idValue || receiveTimeValue;
      let txKey = pipeNo + "_" + entryNo + "_" + process + "_" + status + "_" + defectReason + "_" + dateStr + "_" + timeOrId;
      if (seenTransactions.has(txKey)) {
        result.duplicateTransactionWarnings.push({
          row: rowIdx,
          pipeNo: pipeNo,
          message: "Nghi ngờ trùng lặp giao dịch hoàn toàn",
          txKey: txKey
        });
      } else {
        seenTransactions.add(txKey);
      }
    }
    
    // 2. Kiểm tra Entry No
    if (!entryNo) {
      rowErrors.push("Entry No bị rỗng");
    } else if (isNaN(entryNo)) {
      rowErrors.push("Entry No không hợp lệ (phải là số): " + entryNo);
    }
    
    // 3. Kiểm tra Process
    if (process) {
      let isProcessValid = false;
      for (let p of MASTER_PROCESSES) {
        if (process.includes(p)) {
          isProcessValid = true;
          break;
        }
      }
      if (!isProcessValid) rowErrors.push("Process không đúng danh sách nguyên công chuẩn: " + process);
    } else {
      rowWarnings.push("Process bị rỗng");
    }
    
    // 4. Kiểm tra Status
    if (status) {
      let isStatusValid = false;
      for (let s of MASTER_STATUSES) {
        if (status.includes(s)) {
          isStatusValid = true;
          break;
        }
      }
      if (!isStatusValid) rowErrors.push("Status không đúng Đạt/Loại/Chờ sửa: " + status);
    }
    
    // 5. Kiểm tra Error Reason
    if (defectReason) {
      let isErrorValid = false;
      for (let err of MASTER_ERRORS) {
        if (defectReason.includes(err)) {
          isErrorValid = true;
          break;
        }
      }
      if (!isErrorValid) {
        rowWarnings.push("Error Reason không nằm trong Master Error Catalog: " + defectReason);
      }
    }
    
    // 6. Kiểm tra Size
    if (size && !MASTER_SIZES.includes(size)) {
      rowWarnings.push("Size không đúng danh mục chuẩn: " + size);
    }
    
    // 7. Bỏ qua kiểm tra Worker trong Sprint 1.0 (chờ tích hợp DS NV sau)
    
    if (rowErrors.length > 0) {
      isRowValid = false;
      result.errors.push({ row: rowIdx, pipeNo: pipeNo, issues: rowErrors });
    }
    
    if (rowWarnings.length > 0) {
      result.warnings.push({ row: rowIdx, pipeNo: pipeNo, issues: rowWarnings });
    }
    
    if (isRowValid) {
      result.validRows++;
    } else {
      result.invalidRows++;
    }
  }
  
  return result;
}

/**
 * Utility: Chuẩn hóa chuỗi (chuyển chuỗi, trim, chữ thường, bỏ dấu tiếng Việt)
 */
function normalizeString(value) {
  if (value == null) return "";
  let str = value.toString().trim().toLowerCase();
  str = str.replace(/đ/g, "d");
  
  // Hỗ trợ loại bỏ dấu bằng Unicode NFD
  if (str.normalize) {
    str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } else {
    // Fallback cho môi trường không hỗ trợ normalize
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  }
  
  return str;
}

function normalizeText(value) {
  return normalizeString(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(text) {
  return normalizeText(text).replace(/\s+/g, "");
}
