/**
 * Ghi kết quả debug ra Sheet "DEBUG"
 */
function classifyBusinessStatus(transaction, previousStatus, currentPipeState) {
  return getBusinessCurrentState_(transaction, previousStatus, currentPipeState);
}

/**
 * Sprint Error Analysis - dictionary/classifier only, no KPI rule changes.
 */
const ERROR_MASTER_DEFAULT = {
  category: "Khác",
  process: "",
  severity: "Medium",
  color: "#6b7280"
};

function noErrorClassification_() {
  return {
    code: "NONE",
    label: "Không lỗi",
    source: "",
    raw: ""
  };
}

function getErrorMasterMeta_(code) {
  const dictionary = getBusinessRuleErrorDictionary_();
  for (let i = 0; i < dictionary.length; i++) {
    if (dictionary[i].code === code) {
      return {
        category: dictionary[i].category || ERROR_MASTER_DEFAULT.category,
        process: dictionary[i].process || ERROR_MASTER_DEFAULT.process,
        severity: dictionary[i].severity || ERROR_MASTER_DEFAULT.severity,
        color: dictionary[i].color || ERROR_MASTER_DEFAULT.color
      };
    }
  }

  return Object.assign({}, ERROR_MASTER_DEFAULT);
}

function addErrorCandidate_(candidates, source, raw) {
  if (raw === null || raw === undefined) return;
  const text = raw.toString().trim();
  if (!text) return;
  candidates.push({ source: source, raw: text });
}

function getErrorCandidates_(pipe) {
  const candidates = [];
  if (!pipe) return candidates;

  addErrorCandidate_(candidates, "currentReason", pipe.currentReason);
  addErrorCandidate_(candidates, "defectReason", pipe.defectReason);
  addErrorCandidate_(candidates, "currentStatus", pipe.currentStatus);
  addErrorCandidate_(candidates, "status", pipe.status);
  addErrorCandidate_(candidates, "recordStatus", pipe.recordStatus);
  addErrorCandidate_(candidates, "importStatus", pipe.importStatus);
  addErrorCandidate_(candidates, "notes", pipe.notes);

  if (isBusinessScrapState_(pipe.currentBusinessStatus) || isBusinessRepairState_(pipe.currentBusinessStatus)) {
    addErrorCandidate_(candidates, "currentBusinessStatus", pipe.currentBusinessStatus);
  } else {
    return candidates;
  }

  const history = pipe.history || [];
  for (let i = history.length - 1; i >= 0; i--) {
    const txn = history[i];
    if (!txn) continue;
    addErrorCandidate_(candidates, "history.defectReason", txn.defectReason);
    addErrorCandidate_(candidates, "history.status", txn.status);
    addErrorCandidate_(candidates, "history.recordStatus", txn.recordStatus);
    addErrorCandidate_(candidates, "history.importStatus", txn.importStatus);
    addErrorCandidate_(candidates, "history.notes", txn.notes);
  }

  return candidates;
}

function normalizeErrorText_(value) {
  if (typeof normalizeText === "function") return normalizeText(value);
  return normalizeString(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactErrorText_(value) {
  if (typeof compactText === "function") return compactText(value);
  return normalizeErrorText_(value).replace(/\s+/g, "");
}

function matchErrorDictionary_(source, raw) {
  const text = normalizeErrorText_(raw);
  const compact = compactErrorText_(raw);
  if (!text) return null;

  const candidates = [];
  const dictionary = getBusinessRuleErrorDictionary_();
  for (let i = 0; i < dictionary.length; i++) {
    const entry = dictionary[i];
    for (let j = 0; j < entry.keywords.length; j++) {
      const keyword = normalizeErrorText_(entry.keywords[j]);
      const compactKeyword = compactErrorText_(entry.keywords[j]);
      if (!keyword) continue;
      candidates.push({
        entry: entry,
        keyword: keyword,
        compactKeyword: compactKeyword,
        length: Math.max(keyword.length, compactKeyword.length)
      });
    }
  }

  candidates.sort((a, b) => b.length - a.length);

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (text.indexOf(candidate.keyword) !== -1 || compact.indexOf(candidate.compactKeyword) !== -1) {
      return {
        code: candidate.entry.code,
        label: candidate.entry.label,
        source: source,
        raw: raw
      };
    }
  }

  return null;
}

function classifyError(pipe) {
  const candidates = getErrorCandidates_(pipe);
  for (let i = 0; i < candidates.length; i++) {
    const matched = matchErrorDictionary_(candidates[i].source, candidates[i].raw);
    if (matched) return matched;
  }

  return noErrorClassification_();
}

function resolveErrorAnalysisItems_(data) {
  if (Array.isArray(data)) return data;
  if (data && data.pipeLists && Array.isArray(data.pipeLists.all)) return data.pipeLists.all;
  if (data && Array.isArray(data.pipes)) return data.pipes;
  return buildPipeEngine();
}

function buildErrorAnalysis(data) {
  const items = resolveErrorAnalysisItems_(data);
  const summaryByCode = {};
  const samples = [];
  let errorCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const error = classifyError(items[i]);
    if (error.code === "NONE") continue;

    errorCount++;
    if (!summaryByCode[error.code]) {
      const meta = getErrorMasterMeta_(error.code);
      summaryByCode[error.code] = {
        code: error.code,
        label: error.label,
        category: meta.category,
        process: meta.process,
        severity: meta.severity,
        color: meta.color,
        count: 0
      };
    }
    summaryByCode[error.code].count++;

    if (samples.length < 50) {
      samples.push({
        code: error.code,
        label: error.label,
        source: error.source,
        raw: error.raw,
        pipeNo: item.pipeNo || "",
        entryNo: item.currentEntryNo || item.entryNo || "",
        worker: item.currentWorker1 || item.worker1 || "",
        rig: item.rig || "",
        date: item.currentDate || item.date || ""
      });
    }
  }

  const total = items.length;
  const byError = Object.keys(summaryByCode).map(code => {
    const row = summaryByCode[code];
    return {
      code: row.code,
      label: row.label,
      count: row.count,
      rate: total > 0 ? Number(((row.count / total) * 100).toFixed(1)) : 0,
      category: row.category || ERROR_MASTER_DEFAULT.category,
      process: row.process || ERROR_MASTER_DEFAULT.process,
      severity: row.severity || ERROR_MASTER_DEFAULT.severity,
      color: row.color || ERROR_MASTER_DEFAULT.color
    };
  }).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    summary: {
      total: total,
      errorCount: errorCount,
      errorRate: total > 0 ? Number(((errorCount / total) * 100).toFixed(1)) : 0
    },
    byError: byError,
    samples: samples
  };
}

function getDashboardTime_(value) {
  const parsed = parseDashboardDate(value);
  return parsed ? parsed.getTime() || 0 : 0;
}

/**
 * 4. Xác định Current State của Pipe
 */
function getCurrentPipeState(pipe) {
  let currentEntryNo = pipe.currentEntryNo;
  let entryTransactions = pipe.entries[currentEntryNo] || [];

  if (entryTransactions.length === 0) return pipe;

  pipe.pressureTestCount = 0;
  pipe.threadRepairCount = 0;
  pipe.couplingChangeCount = 0;

  // Sắp xếp transactions theo thứ tự thời gian trước khi tính toán trạng thái
  entryTransactions.sort((a, b) => {
    let dateA = getDashboardTime_(a.date);
    let dateB = getDashboardTime_(b.date);
    if (dateA !== dateB) return dateA - dateB;

    let timeA = getDashboardTime_(a.receiveTime);
    let timeB = getDashboardTime_(b.receiveTime);
    if (timeA !== timeB) return timeA - timeB;

    let idA = (a.id || "").toString();
    let idB = (b.id || "").toString();
    return idA.localeCompare(idB);
  });

  let finalBusinessStatus = "";

  for (let txn of entryTransactions) {
    let p = normalizeString(txn.process);

    // Đếm số lần nguyên công
    if (p.includes("ep thuy luc")) {
      pipe.pressureTestCount++;
    } else if (p.includes("tien ren") || p.includes("sua ren")) {
      pipe.threadRepairCount++;
    } else if (p.includes("thay coupling")) {
      pipe.couplingChangeCount++;
    }

    // Xác định trạng thái nghiệp vụ cho bước này
    finalBusinessStatus = classifyBusinessStatus(txn, finalBusinessStatus, pipe);
  }

  let latestTxn = entryTransactions[entryTransactions.length - 1];

  pipe.currentProcess = latestTxn.process;
  pipe.currentStatus = latestTxn.status;
  pipe.currentReason = latestTxn.defectReason;
  pipe.currentBusinessStatus = finalBusinessStatus;
  pipe.currentProcessState = getBusinessProcessState_(finalBusinessStatus);
  pipe.currentNextProcess = latestTxn.nextProcess || "";
  pipe.currentWorker1 = latestTxn.worker1;
  pipe.currentWorker2 = latestTxn.worker2;
  pipe.currentShift = latestTxn.shift;
  pipe.currentDate = latestTxn.date;

  return pipe;
}

// KPI Thành phẩm dùng business rule riêng, không phụ thuộc currentBusinessStatus.
function isThanhPhamKpiPipe(pipe) {
  return isBusinessFinishedKpiPipe_(pipe);
}

/**
 * 2. Xây dựng Pipe Engine
 */
function buildPipeEngine(sourceTransactions) {
  const totalStartedAt = performanceTimerStart_();
  const transactions = sourceTransactions || getRawTransactions();
  const groupingStartedAt = performanceTimerStart_();
  const pipesMap = {};

  for (let txn of transactions) {
    let pNo = txn.pipeNo;
    if (!pNo) continue; // Bỏ qua nếu không có số ống định danh

    // Khởi tạo Object Pipe nếu chưa có
    if (!pipesMap[pNo]) {
      pipesMap[pNo] = {
        pipeNo: pNo,
        size: txn.size,
        rig: txn.rig,
        well: txn.well,
        wellProfile: txn.wellProfile,
        currentEntryNo: txn.entryNo,
        currentProcess: "",
        currentStatus: "",
        currentReason: "",
        currentBusinessStatus: "",
        currentProcessState: "",
        currentWorker1: "",
        currentWorker2: "",
        currentShift: "",
        currentDate: "",
        pressureTestCount: 0,
        threadRepairCount: 0,
        couplingChangeCount: 0,
        entryCount: 0,
        history: [],
        entries: {}
      };
    }

    let pipe = pipesMap[pNo];

    // Cập nhật thông tin nhận diện mới nhất
    if (txn.size) pipe.size = txn.size;
    if (txn.rig) pipe.rig = txn.rig;
    if (txn.well) pipe.well = txn.well;
    if (txn.wellProfile) pipe.wellProfile = txn.wellProfile;

    let eNo = txn.entryNo;
    if (!pipe.entries[eNo]) {
      pipe.entries[eNo] = [];
    }

    // Thêm transaction vào lịch sử
    pipe.entries[eNo].push(txn);
    pipe.history.push(txn);
    pipe.entryCount = Object.keys(pipe.entries).length;

    // Loại bỏ gán currentEntryNo tĩnh
  }

  performanceLog_("buildPipeEngine", "group_transactions", groupingStartedAt, {
    rowCount: transactions.length
  });

  // Xác định Current State cho từng Pipe
  const currentStateStartedAt = performanceTimerStart_();
  const pipeObjects = [];
  for (let pNo in pipesMap) {
    let pipe = pipesMap[pNo];

    // Sort toàn bộ lịch sử để tìm Entry mới nhất
    pipe.history.sort((a, b) => {
      let dateA = getDashboardTime_(a.date);
      let dateB = getDashboardTime_(b.date);
      if (dateA !== dateB) return dateA - dateB;

      let timeA = getDashboardTime_(a.receiveTime);
      let timeB = getDashboardTime_(b.receiveTime);
      if (timeA !== timeB) return timeA - timeB;

      let idA = (a.id || "").toString();
      let idB = (b.id || "").toString();
      return idA.localeCompare(idB);
    });

    if (pipe.history.length > 0) {
      let latestGlobalTxn = pipe.history[pipe.history.length - 1];
      pipe.currentEntryNo = latestGlobalTxn.entryNo;
    }

    pipeObjects.push(getCurrentPipeState(pipe));
  }

  performanceLog_("buildPipeEngine", "current_state", currentStateStartedAt, {
    rowCount: pipeObjects.length
  });
  performanceLog_("buildPipeEngine", "total", totalStartedAt, {
    success: true,
    rowCount: pipeObjects.length
  });
  return pipeObjects;
}

/**
 * 5. Hàm Debug kiểm tra Pipe Engine
 */
function debugPipeEngine() {
  try {
    const pipeObjects = buildPipeEngine();
    let totalTransactions = 0;
    let states = getBusinessStates_();
    let processStates = getBusinessProcessStates_();
    let statusSummary = {};
    statusSummary[states.THANH_PHAM] = 0;
    statusSummary[states.CHO_SUA] = 0;
    statusSummary[states.LOAI] = 0;
    let processStateSummary = {};
    processStateSummary[processStates.DANG_XU_LY] = 0;
    let processQueueSummary = {};

    for (let pipe of pipeObjects) {
      totalTransactions += pipe.history.length;

      let bStatus = pipe.currentBusinessStatus;
      if (statusSummary[bStatus] !== undefined) {
        statusSummary[bStatus]++;
      }
      if (pipe.currentProcessState && processStateSummary[pipe.currentProcessState] !== undefined) {
        processStateSummary[pipe.currentProcessState]++;
      }

      let cp = pipe.currentProcess || "Chưa có";
      if (!processQueueSummary[cp]) processQueueSummary[cp] = 0;
      processQueueSummary[cp]++;
    }

    return {
      totalTransactions: totalTransactions,
      totalPipes: pipeObjects.length,
      statusSummary: statusSummary,
      processStateSummary: processStateSummary,
      processQueueSummary: processQueueSummary,
      samplePipes: pipeObjects.slice(0, 5)
    };
  } catch (e) {
    return { success: false, error: e.toString(), stack: e.stack };
  }
}

function debugLatest10Pipes() {
  const samples = buildPipeEngine()
    .sort((a, b) => {
      const timeDiff = getDashboardTime_(b.currentDate) - getDashboardTime_(a.currentDate);
      if (timeDiff !== 0) return timeDiff;

      const latestA = a.history[a.history.length - 1] || {};
      const latestB = b.history[b.history.length - 1] || {};
      const receiveTimeDiff = getDashboardTime_(latestB.receiveTime) - getDashboardTime_(latestA.receiveTime);
      if (receiveTimeDiff !== 0) return receiveTimeDiff;
      return (latestB.id || "").toString().localeCompare((latestA.id || "").toString());
    })
    .slice(0, 10)
    .map(pipe => {
      const latestTxn = pipe.history[pipe.history.length - 1] || {};
      return {
        id: latestTxn.id || "",
        pipeNo: pipe.pipeNo || "",
        currentProcess: pipe.currentProcess || "",
        currentStep: pipe.currentProcess || "",
        currentStatus: pipe.currentStatus || "",
        quality: pipe.currentReason || "",
        defectReason: pipe.currentReason || "",
        classifiedStatus: pipe.currentBusinessStatus || "",
        currentBusinessStatus: pipe.currentBusinessStatus || "",
        isThanhPhamKpiPipe: isThanhPhamKpiPipe(pipe)
      };
    });

  return samples;
}

const DASHBOARD_OVERVIEW_DATE_EMPTY_MESSAGE = "Ngày này chưa có kế hoạch hoặc dữ liệu sản xuất.";
const DASHBOARD_OVERVIEW_DATE_FALLBACK_NOTE = "Đang hiển thị ngày sản xuất gần nhất.";
const DASHBOARD_OVERVIEW_DATE_CACHE_PREFIX = "dashboard:overview-date:v2:";
const DASHBOARD_OVERVIEW_DATE_CACHE_TTL_SECONDS = 300;
const DASHBOARD_OVERVIEW_DATE_CACHE_MAX_BYTES = 90 * 1024;

function isValidDashboardMinimalSnapshot_(snapshot) {
  const isObject = function(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  };
  const hasOwn = function(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  };
  const hasNamedCountRows = function(rows) {
    return Array.isArray(rows) && rows.every(function(row) {
      return isObject(row) && typeof row.name === "string" && hasOwn(row, "count");
    });
  };

  if (!isObject(snapshot) || snapshot.success !== true) return false;
  if (!isObject(snapshot.reportDate) ||
      typeof snapshot.reportDate.date !== "string" ||
      !snapshot.reportDate.date ||
      typeof snapshot.reportDate.displayDate !== "string" ||
      typeof snapshot.reportDate.note !== "string" ||
      typeof snapshot.reportDate.emptyMessage !== "string") return false;

  const meta = snapshot.snapshotMeta;
  if (!isObject(meta) ||
      meta.success !== true ||
      meta.reportDate !== snapshot.reportDate.date ||
      typeof meta.builtAt !== "string" ||
      !meta.builtAt ||
      typeof meta.version !== "string" ||
      !meta.version ||
      !Number.isFinite(Number(meta.durationMs)) ||
      Number(meta.durationMs) < 0) return false;

  const kpi = snapshot.kpi;
  const requiredKpiFields = ["total", "tp", "cs", "hong", "dxl", "tpPercent"];
  if (!isObject(kpi) || requiredKpiFields.some(function(field) { return !hasOwn(kpi, field); })) return false;
  if (typeof snapshot.factoryHealth !== "string" ||
      !Array.isArray(snapshot.alerts) ||
      !snapshot.alerts.every(function(alert) { return typeof alert === "string"; }) ||
      !isObject(snapshot.planStats) ||
      !Array.isArray(snapshot.planStats.byDate) ||
      !Array.isArray(snapshot.planStats.byMonth) ||
      !Array.isArray(snapshot.planStats.sizeComparison) ||
      !Array.isArray(snapshot.planStats.trend7Days) ||
      !hasNamedCountRows(snapshot.processStats) ||
      !hasNamedCountRows(snapshot.queueStats) ||
      !isObject(snapshot.processQueueSummary) ||
      !isObject(snapshot.sizeStats) ||
      !hasNamedCountRows(snapshot.errorStats) ||
      !isObject(snapshot.qualityAnalysis) ||
      !hasNamedCountRows(snapshot.rigStats) ||
      !hasNamedCountRows(snapshot.shiftStats) ||
      !Array.isArray(snapshot.recent)) return false;

  const recentFields = [
    "date", "shift", "process", "pipeNo", "qty", "size",
    "status", "statusGroup", "errorCode", "rig", "worker1", "worker2"
  ];
  return snapshot.recent.every(function(row) {
    return isObject(row) && recentFields.every(function(field) { return hasOwn(row, field); });
  });
}
/**
 * 6. Hàm lấy dữ liệu cho Dashboard theo ngày báo cáo.
 */
function getDashboardData(reportDateText) {
  try {
    const requestedText = (reportDateText || "").toString().trim();
    let requestedDate = null;
    if (requestedText) {
      requestedDate = parseDashboardOverviewDate_(requestedText);
      if (!requestedDate) return { success: false, error: "Ngày báo cáo không hợp lệ." };
    }

    let availableSnapshot = null;
    try {
      const cachedSnapshot = readDashboardSnapshotCache_();
      if (isValidDashboardMinimalSnapshot_(cachedSnapshot)) {
        availableSnapshot = cachedSnapshot;
      } else {
        const durableSnapshot = readDashboardSnapshot_();
        if (isValidDashboardMinimalSnapshot_(durableSnapshot)) {
          try {
            writeDashboardSnapshotCache_(durableSnapshot);
          } catch (cacheError) {
            Logger.log("DASH_SNAPSHOT L1 repopulate error: " + cacheError);
          }
          availableSnapshot = durableSnapshot;
        }
      }
    } catch (snapshotError) {
      Logger.log("DASH_SNAPSHOT default read error: " + snapshotError);
    }

    if (availableSnapshot &&
        (!requestedDate || availableSnapshot.reportDate.date === requestedDate.dateKey)) {
      return availableSnapshot;
    }

    if (requestedDate) {
      const historicalSnapshot = readDashboardHistoricalSnapshotForDate_(requestedDate.dateKey);
      if (isValidDashboardMinimalSnapshot_(historicalSnapshot) &&
          historicalSnapshot.reportDate.date === requestedDate.dateKey) {
        return historicalSnapshot;
      }
      return {
        success: false,
        error: "Dashboard snapshot cho ngày " + requestedDate.dateKey + " chưa sẵn sàng.",
        snapshotMeta: {
          state: "missing",
          schemaVersion: DASHBOARD_HISTORY_SNAPSHOT_SCHEMA_VERSION,
          reportDate: requestedDate.dateKey
        }
      };
    }

    return {
      success: false,
      error: "Dashboard snapshot chưa sẵn sàng.",
      snapshotMeta: { state: "missing" }
    };
  } catch (error) {
    return {
      success: false,
      error: error && error.message ? error.message : error.toString()
    };
  }
}

function parseDashboardOverviewDate_(dateText) {
  const date = parseDailyReportDate_(dateText);
  if (!date) return null;
  return {
    date: date,
    dateKey: dashboardPlanFormatDayKey_(date)
  };
}

function getDashboardOverviewDateKey_(value) {
  const date = parseDashboardDate(value);
  return date ? dashboardPlanFormatDayKey_(date) : "";
}

function getDashboardOverviewSource_() {
  return {
    transactions: getRawTransactions(),
    plans: getDashboardCanonicalPlans_()
  };
}

function hasDashboardOverviewDailyPlan_(plans, dateKey) {
  const dailyPlan = plans && plans.dailyByDate ? plans.dailyByDate[dateKey] : null;
  return !!(dailyPlan && Object.keys(dailyPlan).length > 0);
}

function resolveDefaultDashboardOverviewDate_(source) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dashboardPlanFormatDayKey_(yesterday);
  const availableDates = {};
  const transactions = source && Array.isArray(source.transactions) ? source.transactions : [];
  const plans = source && source.plans ? source.plans : { dailyByDate: {} };

  transactions.forEach(function(transaction) {
    const dateKey = getDashboardOverviewDateKey_(transaction && transaction.date);
    if (dateKey && dateKey <= yesterdayKey) availableDates[dateKey] = true;
  });

  Object.keys(plans.dailyByDate || {}).forEach(function(dateKey) {
    if (dateKey && dateKey <= yesterdayKey) availableDates[dateKey] = true;
  });

  if (availableDates[yesterdayKey]) {
    return { dateKey: yesterdayKey, usedNearestDate: false };
  }

  const fallbackKey = Object.keys(availableDates)
    .filter(function(dateKey) { return dateKey < yesterdayKey; })
    .sort()
    .reverse()[0];

  return {
    dateKey: fallbackKey || yesterdayKey,
    usedNearestDate: !!fallbackKey
  };
}

function getDashboardOverviewDateCacheKey_(dateKey) {
  return DASHBOARD_OVERVIEW_DATE_CACHE_PREFIX + dateKey +
    ":data=" + getDashboardDataCacheVersion_() +
    ":plan=" + getDashboardPlanCacheVersion_();
}

function readDashboardOverviewDateCache_(dateKey) {
  try {
    const payload = CacheService.getScriptCache().get(getDashboardOverviewDateCacheKey_(dateKey));
    if (payload === null) return null;
    return deserializeDashboardSnapshot_(payload);
  } catch (error) {
    Logger.log("DASH_OVERVIEW_DATE cache read error: " + error);
    return null;
  }
}

function writeDashboardOverviewDateCache_(dateKey, response) {
  try {
    const payload = serializeDashboardSnapshot_(response);
    const payloadBytes = Utilities.newBlob(payload, "text/plain").getBytes().length;
    if (payloadBytes > DASHBOARD_OVERVIEW_DATE_CACHE_MAX_BYTES) {
      Logger.log("DASH_OVERVIEW_DATE cache write skipped payload too large | payloadBytes=" + payloadBytes);
      return false;
    }

    CacheService.getScriptCache().put(
      getDashboardOverviewDateCacheKey_(dateKey),
      payload,
      DASHBOARD_OVERVIEW_DATE_CACHE_TTL_SECONDS
    );
    return true;
  } catch (error) {
    Logger.log("DASH_OVERVIEW_DATE cache write error: " + error);
    return false;
  }
}

function cloneDashboardOverviewResponse_(response) {
  return JSON.parse(JSON.stringify(response || {}));
}

function applyDashboardOverviewDateContext_(response, context) {
  const result = cloneDashboardOverviewResponse_(response);
  result.reportDate = result.reportDate || {};
  result.reportDate.userSelected = !!(context && context.userSelected);
  result.reportDate.usedNearestDate = !!(context && context.usedNearestDate);
  result.reportDate.note = result.reportDate.usedNearestDate
    ? DASHBOARD_OVERVIEW_DATE_FALLBACK_NOTE
    : "";
  result.reportDate.emptyMessage = result.reportDate.noData
    ? DASHBOARD_OVERVIEW_DATE_EMPTY_MESSAGE
    : "";
  return result;
}

function buildDashboardEmptyPlanStats_(asOf) {
  const dayKey = dashboardPlanFormatDayKey_(asOf);
  const monthKey = Utilities.formatDate(asOf, PRODUCTION_DASHBOARD_V2_TIME_ZONE, "yyyy-MM");
  const dayLabel = dayKey.slice(8, 10) + "/" + dayKey.slice(5, 7) + "/" + dayKey.slice(0, 4);
  const trend7Days = [];

  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date(asOf.getTime());
    date.setDate(date.getDate() - offset);
    const trendKey = dashboardPlanFormatDayKey_(date);
    trend7Days.push({
      date: trendKey,
      label: trendKey.slice(8, 10) + "/" + trendKey.slice(5, 7),
      checkedPlan: 0,
      checkedActual: 0,
      finishedPlan: 0,
      finishedActual: 0
    });
  }

  return {
    total: { plan: null, actual: 0, percent: null },
    byDate: [
      buildDashboardPlanComparisonRow_(dayLabel + " · Kiểm tra", "", "checked", null, 0, false, dayKey),
      buildDashboardPlanComparisonRow_(dayLabel + " · Thành phẩm", "", "finished", null, 0, false, dayKey)
    ],
    byMonth: [],
    bySize: [],
    sizeComparison: [],
    trend7Days: trend7Days,
    monthlyComparison: {
      checked: { plan: null, actual: 0, completionPercent: null },
      finished: { plan: null, actual: 0, completionPercent: null }
    },
    day: dayKey,
    month: monthKey,
    source: "PlanService"
  };
}

function buildDashboardOverviewDateCore_(dateKey, source) {
  const reportDate = parseDailyReportDate_(dateKey);
  if (!reportDate) return { success: false, error: "Ngày báo cáo không hợp lệ." };

  const overviewSource = source || getDashboardOverviewSource_();
  const transactions = Array.isArray(overviewSource.transactions) ? overviewSource.transactions : [];
  const plans = overviewSource.plans || getDashboardCanonicalPlans_();
  const dailyTransactions = transactions.filter(function(transaction) {
    return getDashboardOverviewDateKey_(transaction && transaction.date) === dateKey;
  });
  const hasDailyPlan = hasDashboardOverviewDailyPlan_(plans, dateKey);
  const hasDailyProduction = dailyTransactions.length > 0;
  const noData = !hasDailyPlan && !hasDailyProduction;
  const historyTransactions = noData ? [] : transactions.filter(function(transaction) {
    const transactionDateKey = getDashboardOverviewDateKey_(transaction && transaction.date);
    return transactionDateKey && transactionDateKey <= dateKey;
  });

  const response = buildDashboardDataFresh_(reportDate, historyTransactions, {
    allowEmpty: true,
    plans: plans
  });
  if (!response || response.success !== true) {
    return {
      success: false,
      error: response && response.error ? response.error : "Không tạo được dữ liệu Dashboard theo ngày."
    };
  }

  if (noData) response.planStats = buildDashboardEmptyPlanStats_(reportDate);
  const dailyQualityAnalysis = buildErrorAnalysis(dailyTransactions);
  response.qualityAnalysis = dailyQualityAnalysis;
  response.errorStats = (dailyQualityAnalysis.byError || []).map(function(row) {
    return {
      name: row.label,
      code: row.code,
      count: row.count,
      rate: row.rate,
      category: row.category,
      severity: row.severity,
      color: row.color
    };
  });
  response.alerts = (response.alerts || []).filter(function(alert) {
    return alert.toString().indexOf("Lỗi nhiều nhất:") !== 0;
  });
  if (response.errorStats.length > 0) {
    response.alerts.push("Lỗi nhiều nhất: " + response.errorStats[0].name + " (" + response.errorStats[0].count + ").");
  }
  response.reportDate = {
    date: dateKey,
    displayDate: formatDashboardDate_(reportDate),
    hasDailyPlan: hasDailyPlan,
    hasDailyProduction: hasDailyProduction,
    productionRows: dailyTransactions.length,
    noData: noData
  };
  response.snapshotMeta = {
    success: true,
    state: "ready",
    version: "overview-date-" + dateKey,
    builtAt: new Date().toISOString(),
    reportDate: dateKey
  };
  return response;
}

function getDashboardOverviewDateData_(dateKey, context, source) {
  let core = readDashboardOverviewDateCache_(dateKey);
  if (!core) {
    core = buildDashboardOverviewDateCore_(dateKey, source);
    if (core && core.success === true) writeDashboardOverviewDateCache_(dateKey, core);
  }
  return applyDashboardOverviewDateContext_(core, context);
}

function getProductionKpiData(reportDateText) {
  const totalStartedAt = Date.now();
  const timings = {};
  const counts = {};

  function measure_(name, callback) {
    const startedAt = Date.now();
    const value = callback();
    timings[name] = Date.now() - startedAt;
    return value;
  }

  try {
    const parsed = measure_("parse_report_date", function() {
      const requestedText = (reportDateText || "").toString().trim();
      if (!requestedText) return null;
      return parseDashboardOverviewDate_(requestedText);
    });
    if (!parsed) return { success: false, error: "Ngày báo cáo không hợp lệ." };

    const reportDate = parsed.date;
    const dateKey = parsed.dateKey;
    const monthKey = Utilities.formatDate(reportDate, PRODUCTION_DASHBOARD_V2_TIME_ZONE, "yyyy-MM");

    timings.cache_read = 0;
    const transactions = measure_("actual_read", function() {
      return getRawTransactions();
    });
    counts.actualRows = Array.isArray(transactions) ? transactions.length : 0;

    const plans = measure_("plan_read", function() {
      return getDashboardCanonicalPlans_();
    });
    counts.dailyPlanSizes = plans && plans.dailyByDate && plans.dailyByDate[dateKey]
      ? Object.keys(plans.dailyByDate[dateKey]).length
      : 0;
    counts.monthlyPlanSizes = plans && plans.monthlyByMonth && plans.monthlyByMonth[monthKey]
      ? Object.keys(plans.monthlyByMonth[monthKey]).length
      : 0;

    let dailyProductionRows = 0;
    const historyTransactions = measure_("actual_filter", function() {
      return transactions.filter(function(transaction) {
        const transactionDateKey = getDashboardOverviewDateKey_(transaction && transaction.date);
        if (transactionDateKey === dateKey) dailyProductionRows++;
        return transactionDateKey && transactionDateKey <= dateKey;
      });
    });
    counts.historyRows = historyTransactions.length;
    counts.dailyProductionRows = dailyProductionRows;

    const pipeObjects = measure_("pipe_engine", function() {
      return buildPipeEngine(historyTransactions);
    });
    counts.pipeCount = pipeObjects.length;

    const planStats = measure_("kpi_build", function() {
      return buildDashboardMonthlyPlanStats_(pipeObjects, reportDate, plans);
    });

    const response = {
      success: true,
      reportDate: {
        date: dateKey,
        displayDate: formatDashboardDate_(reportDate),
        hasDailyPlan: counts.dailyPlanSizes > 0,
        hasDailyProduction: dailyProductionRows > 0,
        productionRows: dailyProductionRows,
        noData: counts.dailyPlanSizes === 0 && dailyProductionRows === 0
      },
      planStats: planStats,
      meta: {
        source: "production_kpi_minimal",
        dateKey: dateKey,
        monthKey: monthKey,
        timingsMs: timings,
        counts: counts
      }
    };

    const serializeStartedAt = Date.now();
    response.meta.payloadBytes = Utilities.newBlob(JSON.stringify(response), "application/json").getBytes().length;
    timings.serialize = Date.now() - serializeStartedAt;
    response.meta.totalMs = Date.now() - totalStartedAt;
    return response;
  } catch (error) {
    timings.total_before_error = Date.now() - totalStartedAt;
    return {
      success: false,
      error: error && error.message ? error.message : error.toString(),
      stack: error && error.stack ? error.stack : "",
      meta: {
        source: "production_kpi_minimal",
        timingsMs: timings,
        counts: counts,
        totalMs: Date.now() - totalStartedAt
      }
    };
  }
}

function applyDashboardCurrentPlans_(snapshot) {
  try {
    const planStats = snapshot && snapshot.planStats;
    if (!planStats) return snapshot;
    return snapshot;
  } catch (error) {
    Logger.log("Dashboard current plan overlay unavailable: " +
      (error && error.message ? error.message : error));
    return snapshot;
  }
}

function getDashboardCanonicalPlans_() {
  const plans = {
    dailyByDate: {},
    monthlyByMonth: {},
    source: "PlanService"
  };

  try {
    const response = getPlanModuleData();
    const dailyRows = response && response.success === true && response.data &&
      Array.isArray(response.data.daily) ? response.data.daily : [];
    const monthlyRows = response && response.success === true && response.data &&
      Array.isArray(response.data.monthly) ? response.data.monthly : [];

    dailyRows.forEach(function(row) {
      if (!row || !row.thoiGian) return;
      const size = (row.size || "").toString().trim();
      if (!size) return;
      if (!plans.dailyByDate[row.thoiGian]) plans.dailyByDate[row.thoiGian] = {};
      plans.dailyByDate[row.thoiGian][size] = {
        checked: Number(row.kiemTra || 0),
        finished: Number(row.thanhPham || 0)
      };
    });

    monthlyRows.forEach(function(row) {
      if (!row || !row.thoiGian) return;
      const size = (row.size || "").toString().trim();
      if (!size) return;
      if (!plans.monthlyByMonth[row.thoiGian]) plans.monthlyByMonth[row.thoiGian] = {};
      plans.monthlyByMonth[row.thoiGian][size] = {
        checked: Number(row.kiemTra || 0),
        finished: Number(row.thanhPham || 0)
      };
    });
  } catch (error) {
    Logger.log("Dashboard plan unavailable: " + (error && error.message ? error.message : error));
  }

  return plans;
}

function buildDashboardPlanComparisonRow_(name, size, metric, plan, actual, hasPlan, periodKey) {
  const normalizedActual = Number(actual || 0);
  const normalizedPlan = hasPlan ? Number(plan || 0) : null;
  return {
    name: name,
    size: size,
    metric: metric,
    period: periodKey || "",
    plan: normalizedPlan,
    actual: normalizedActual,
    percent: hasPlan
      ? productionDashboardV2Completion_(normalizedActual, normalizedPlan)
      : null
  };
}

function dashboardPlanFormatDayKey_(date) {
  return Utilities.formatDate(date, PRODUCTION_DASHBOARD_V2_TIME_ZONE, "yyyy-MM-dd");
}

function dashboardPlanStatusEvent_(pipe, finishedEvent) {
  if (!pipe) return null;
  if (isThanhPhamKpiPipe(pipe)) return finishedEvent || null;
  if (!isBusinessRepairState_(pipe.currentBusinessStatus) && !isBusinessScrapState_(pipe.currentBusinessStatus)) return null;
  return productionDashboardV2Event_({
    date: pipe.currentDate,
    process: pipe.currentProcess,
    status: pipe.currentStatus,
    defectReason: pipe.currentReason,
    id: pipe.pipeNo,
    entryNo: pipe.currentEntryNo
  }, pipe.currentBusinessStatus);
}

function dashboardPlanBuildActuals_(pipeObjects, dayKey, monthKey) {
  const result = {
    bySize: {},
    byDate: {}
  };

  pipeObjects.forEach(function(pipe) {
    const projection = projectProductionDashboardV2Pipe_(pipe);
    const size = projection.size || "UNKNOWN";
    if (!result.bySize[size]) {
      result.bySize[size] = {
        today: { checked: 0, finished: 0 },
        monthly: { checked: 0, finished: 0 }
      };
    }

    const checkedEvent = dashboardPlanStatusEvent_(pipe, projection.finishedEvent);
    const finishedEvent = projection.finishedEvent;
    const sizeActual = result.bySize[size];

    if (checkedEvent && checkedEvent.dayKey === dayKey) sizeActual.today.checked++;
    if (checkedEvent && checkedEvent.monthKey === monthKey) sizeActual.monthly.checked++;
    if (finishedEvent && finishedEvent.dayKey === dayKey) sizeActual.today.finished++;
    if (finishedEvent && finishedEvent.monthKey === monthKey) sizeActual.monthly.finished++;

    if (checkedEvent && checkedEvent.dayKey) {
      if (!result.byDate[checkedEvent.dayKey]) result.byDate[checkedEvent.dayKey] = { checked: 0, finished: 0 };
      result.byDate[checkedEvent.dayKey].checked++;
    }
    if (finishedEvent && finishedEvent.dayKey) {
      if (!result.byDate[finishedEvent.dayKey]) result.byDate[finishedEvent.dayKey] = { checked: 0, finished: 0 };
      result.byDate[finishedEvent.dayKey].finished++;
    }
  });

  return result;
}

function dashboardPlanTotal_(plansBySize, metric) {
  let total = 0;
  Object.keys(plansBySize || {}).forEach(function(size) {
    total += Number(plansBySize[size] && plansBySize[size][metric] || 0);
  });
  return total;
}

function buildDashboardMonthlyPlanStats_(pipeObjects, asOf, plansOverride) {
  const dayKey = Utilities.formatDate(asOf, PRODUCTION_DASHBOARD_V2_TIME_ZONE, "yyyy-MM-dd");
  const monthKey = Utilities.formatDate(asOf, PRODUCTION_DASHBOARD_V2_TIME_ZONE, "yyyy-MM");
  const plans = plansOverride || getDashboardCanonicalPlans_();
  const dailyPlansBySize = plans.dailyByDate[dayKey] || {};
  const monthlyPlansBySize = plans.monthlyByMonth[monthKey] || {};
  const actuals = dashboardPlanBuildActuals_(pipeObjects, dayKey, monthKey);

  const bySize = [];
  const sizeComparison = [];
  let dailyCheckedActualTotal = 0;
  let dailyFinishedActualTotal = 0;
  let checkedActualTotal = 0;
  let finishedActualTotal = 0;
  const checkedPlanTotal = dashboardPlanTotal_(monthlyPlansBySize, "checked");
  const finishedPlanTotal = dashboardPlanTotal_(monthlyPlansBySize, "finished");
  const dailyCheckedPlanTotal = dashboardPlanTotal_(dailyPlansBySize, "checked");
  const dailyFinishedPlanTotal = dashboardPlanTotal_(dailyPlansBySize, "finished");
  const sizeSet = {};
  Object.keys(monthlyPlansBySize).forEach(function(size) { sizeSet[size] = true; });
  Object.keys(dailyPlansBySize).forEach(function(size) { sizeSet[size] = true; });
  Object.keys(actuals.bySize || {}).forEach(function(size) {
    const actual = actuals.bySize[size] || {};
    const dailyActual = actual.today || {};
    const monthlyActual = actual.monthly || {};
    if (Number(dailyActual.checked || 0) > 0 ||
        Number(dailyActual.finished || 0) > 0 ||
        Number(monthlyActual.checked || 0) > 0 ||
        Number(monthlyActual.finished || 0) > 0) {
      sizeSet[size] = true;
    }
  });
  const sizes = Object.keys(sizeSet).sort(function(left, right) {
    return left.localeCompare(right, "vi");
  });

  sizes.forEach(function(size) {
    const monthlyActual = actuals.bySize[size] && actuals.bySize[size].monthly ? actuals.bySize[size].monthly : {};
    const dailyActual = actuals.bySize[size] && actuals.bySize[size].today ? actuals.bySize[size].today : {};
    const monthlyPlan = monthlyPlansBySize[size] || {};
    const dailyPlan = dailyPlansBySize[size] || null;
    const hasMonthlySizePlan = Object.prototype.hasOwnProperty.call(monthlyPlansBySize, size);
    const hasDailySizePlan = Object.prototype.hasOwnProperty.call(dailyPlansBySize, size);
    const checkedDailyActual = Number(dailyActual.checked || 0);
    const finishedDailyActual = Number(dailyActual.finished || 0);
    const checkedMonthlyActual = Number(monthlyActual.checked || 0);
    const finishedMonthlyActual = Number(monthlyActual.finished || 0);
    const hasDailySizeActual = checkedDailyActual > 0 || finishedDailyActual > 0;
    const hasMonthlySizeActual = checkedMonthlyActual > 0 || finishedMonthlyActual > 0;
    const comparisonPlan = dailyPlan || {};

    dailyCheckedActualTotal += checkedDailyActual;
    dailyFinishedActualTotal += finishedDailyActual;
    checkedActualTotal += checkedMonthlyActual;
    finishedActualTotal += finishedMonthlyActual;

    if (hasMonthlySizePlan || hasMonthlySizeActual) {
      const checkedRow = buildDashboardPlanComparisonRow_(
        size + " · Kiểm tra", size, "checked", monthlyPlan.checked, checkedMonthlyActual, hasMonthlySizePlan, monthKey
      );
      const finishedRow = buildDashboardPlanComparisonRow_(
        size + " · Thành phẩm", size, "finished", monthlyPlan.finished, finishedMonthlyActual, hasMonthlySizePlan, monthKey
      );
      bySize.push(checkedRow, finishedRow);
    }

    if (hasDailySizePlan || hasDailySizeActual) {
      const checkedComparison = buildDashboardPlanComparisonRow_(
        size + " · Kiểm tra", size, "checked", comparisonPlan.checked, checkedDailyActual, hasDailySizePlan, dayKey
      );
      const finishedComparison = buildDashboardPlanComparisonRow_(
        size + " · Thành phẩm", size, "finished", comparisonPlan.finished, finishedDailyActual, hasDailySizePlan, dayKey
      );
      sizeComparison.push({
        size: size,
        checked: {
          plan: checkedComparison.plan,
          actual: checkedComparison.actual,
          completionPercent: checkedComparison.percent
        },
        finished: {
          plan: finishedComparison.plan,
          actual: finishedComparison.actual,
          completionPercent: finishedComparison.percent
        },
        difference: {
          checked: checkedComparison.actual - Number(comparisonPlan.checked || 0),
          finished: finishedComparison.actual - Number(comparisonPlan.finished || 0)
        }
      });
    }
  });


  const hasDailyPlan = Object.keys(dailyPlansBySize).length > 0;
  const hasMonthlyPlan = Object.keys(monthlyPlansBySize).length > 0;
  const dayLabel = dayKey.slice(8, 10) + "/" + dayKey.slice(5, 7) + "/" + dayKey.slice(0, 4);
  const monthLabel = monthKey.slice(5, 7) + "/" + monthKey.slice(0, 4);
  const dailyChecked = buildDashboardPlanComparisonRow_(
    dayLabel + " · Kiểm tra", "", "checked",
    dailyCheckedPlanTotal, dailyCheckedActualTotal, hasDailyPlan, dayKey
  );
  const dailyFinished = buildDashboardPlanComparisonRow_(
    dayLabel + " · Thành phẩm", "", "finished",
    dailyFinishedPlanTotal, dailyFinishedActualTotal, hasDailyPlan, dayKey
  );
  const monthlyChecked = buildDashboardPlanComparisonRow_(
    monthLabel + " · Kiểm tra", "", "checked",
    checkedPlanTotal, checkedActualTotal, hasMonthlyPlan, monthKey
  );
  const monthlyFinished = buildDashboardPlanComparisonRow_(
    monthLabel + " · Thành phẩm", "", "finished",
    finishedPlanTotal, finishedActualTotal, hasMonthlyPlan, monthKey
  );

  const trend7Days = [];
  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date(asOf.getTime());
    date.setDate(date.getDate() - offset);
    const trendKey = dashboardPlanFormatDayKey_(date);
    const trendPlans = plans.dailyByDate[trendKey] || {};
    const trendActual = actuals.byDate[trendKey] || { checked: 0, finished: 0 };
    trend7Days.push({
      date: trendKey,
      label: trendKey.slice(8, 10) + "/" + trendKey.slice(5, 7),
      checkedPlan: dashboardPlanTotal_(trendPlans, "checked"),
      checkedActual: Number(trendActual.checked || 0),
      finishedPlan: dashboardPlanTotal_(trendPlans, "finished"),
      finishedActual: Number(trendActual.finished || 0)
    });
  }

  return {
    total: {
      plan: monthlyFinished.plan,
      actual: monthlyFinished.actual,
      percent: monthlyFinished.percent
    },
    byDate: [dailyChecked, dailyFinished],
    byMonth: [monthlyChecked, monthlyFinished],
    bySize: bySize,
    sizeComparison: sizeComparison,
    trend7Days: trend7Days,
    monthlyComparison: {
      checked: {
        plan: monthlyChecked.plan,
        actual: monthlyChecked.actual,
        completionPercent: monthlyChecked.percent
      },
      finished: {
        plan: monthlyFinished.plan,
        actual: monthlyFinished.actual,
        completionPercent: monthlyFinished.percent
      }
    },
    day: dayKey,
    month: monthKey,
    source: plans.source
  };
}
function buildDashboardDataFresh_(asOf, sourceTransactions, options) {
  try {
    const pipeObjects = buildPipeEngine(sourceTransactions);
    if (pipeObjects.length === 0 && !(options && options.allowEmpty)) {
      return { success: false, error: "Không có dữ liệu pipe." };
    }

    let totalPipes = pipeObjects.length;
    let tpCount = 0;
    let hongCount = 0;
    let csCount = 0;
    let dxlCount = 0;

    let tpPipes = [];
    let csPipes = [];
    let hongPipes = [];
    let dxlPipes = [];

    let processQueueSummary = {};
    let errorSummary = {};
    let rigSummary = {};

    let sizeStats = {};
    let shiftSummary = {};
    let allTxns = [];

    let processPipeLists = {};
    let queueSummary = {};

    // Đếm theo Pipe Objects thay vì Transactions
    for (let pipe of pipeObjects) {
      let bStatus = pipe.currentBusinessStatus;
      let statusKey = getPipeDashboardStatusKey_(pipe);

      if (statusKey === "tp") { tpCount++; tpPipes.push(pipe); }
      else if (statusKey === "hong") { hongCount++; hongPipes.push(pipe); }
      else if (statusKey === "cs") { csCount++; csPipes.push(pipe); }
      else if (statusKey === "dxl") { dxlCount++; dxlPipes.push(pipe); }

      let cp = pipe.currentProcess || "Khác";
      if (!processQueueSummary[cp]) processQueueSummary[cp] = 0;
      processQueueSummary[cp]++;

      if (statusKey === "dxl" || statusKey === "cs") {
          if (!queueSummary[cp]) queueSummary[cp] = 0;
          queueSummary[cp]++;

          if (!processPipeLists[cp]) processPipeLists[cp] = [];
          processPipeLists[cp].push(pipe);
      }

      let reason = pipe.currentReason;
      if (reason) {
          if (!errorSummary[reason]) errorSummary[reason] = 0;
          errorSummary[reason]++;
      }

      let rig = pipe.rig || "Khác";
      if (!rigSummary[rig]) rigSummary[rig] = 0;
      rigSummary[rig]++;

      let size = pipe.size || "Khác";
      if (!sizeStats[size]) {
          sizeStats[size] = { tp: 0, cs: 0, hong: 0, dxl: 0 };
      }
      if (statusKey === "tp") { sizeStats[size].tp++; }
      else if (statusKey === "hong") { sizeStats[size].hong++; }
      else if (statusKey === "cs") { sizeStats[size].cs++; }
      else if (statusKey === "dxl") { sizeStats[size].dxl++; }

      let shift = pipe.currentShift || "Khác";
      if (!shiftSummary[shift]) shiftSummary[shift] = 0;
      shiftSummary[shift]++;

      allTxns.push(...pipe.history);
    }

    let sortedProcess = Object.keys(processQueueSummary).map(k => ({
      name: k,
      count: processQueueSummary[k]
    })).sort((a, b) => b.count - a.count);

    let queueStats = Object.keys(queueSummary).map(k => ({
      name: k,
      count: queueSummary[k]
    })).sort((a, b) => b.count - a.count);

    let errorStats = Object.keys(errorSummary).map(k => ({
        name: k, count: errorSummary[k]
    })).sort((a, b) => b.count - a.count);

    let rigStats = Object.keys(rigSummary).map(k => ({
        name: k, count: rigSummary[k]
    })).sort((a, b) => b.count - a.count);

    let shiftStats = Object.keys(shiftSummary).map(k => ({
        name: k, count: shiftSummary[k]
    })).sort((a, b) => b.count - a.count);

    // Sort all transactions to get 10 recent (Mới nhất)
    allTxns.sort((a, b) => {
      let dateA = getDashboardTime_(a.date);
      let dateB = getDashboardTime_(b.date);
      if (dateA !== dateB) return dateB - dateA; // Giảm dần

      let timeA = getDashboardTime_(a.receiveTime);
      let timeB = getDashboardTime_(b.receiveTime);
      if (timeA !== timeB) return timeB - timeA; // Giảm dần

      let idA = (a.id || "").toString();
      let idB = (b.id || "").toString();
      return idB.localeCompare(idA); // Giảm dần
    });

    let recent = allTxns.slice(0, 10).map(r => {
        let sGroup = getTransactionDashboardStatusKey_(Object.assign({}, r), "", null);
        return {
            date: r.date,
            shift: r.shift,
            process: r.process,
            pipeNo: r.pipeNo,
            qty: r.qty,
            size: r.size,
            status: r.status,
            statusGroup: sGroup,
            errorCode: r.defectReason,
            rig: r.rig,
            worker1: r.worker1,
            worker2: r.worker2
        };
    });

    const finalPlanStats = buildDashboardMonthlyPlanStats_(
      pipeObjects,
      asOf instanceof Date && !isNaN(asOf.getTime()) ? asOf : new Date(),
      options && options.plans
    );
    const qualityAnalysis = buildErrorAnalysis(pipeObjects);
    errorStats = (qualityAnalysis.byError || []).map(function(row) {
      return {
        name: row.label,
        code: row.code,
        count: row.count,
        rate: row.rate,
        category: row.category,
        severity: row.severity,
        color: row.color
      };
    });

    const dailyCheckedKpi = (finalPlanStats.byDate || []).filter(row => row && row.metric === "checked")[0] || null;
    const dailyFinishedKpi = (finalPlanStats.byDate || []).filter(row => row && row.metric === "finished")[0] || null;
    const kpiPercents = [dailyCheckedKpi, dailyFinishedKpi]
      .map(row => row && row.percent !== null && row.percent !== undefined ? Number(row.percent) : null)
      .filter(value => Number.isFinite(value));
    const factoryKpiPercent = kpiPercents.length ? Math.min.apply(null, kpiPercents) : null;

    let health = "NORMAL";
    if (factoryKpiPercent !== null && factoryKpiPercent < 80) {
      health = "CRITICAL";
    } else if (factoryKpiPercent !== null && factoryKpiPercent < 100) {
      health = "WARNING";
    } else if (factoryKpiPercent === null && (hongCount > 0 || csCount > 0)) {
      health = "WARNING";
    }

    let alerts = [];
    if (dailyCheckedKpi && dailyCheckedKpi.percent !== null && dailyCheckedKpi.percent < 100) {
      alerts.push("KPI kiểm tra ngày báo cáo đạt " + dailyCheckedKpi.percent + "%.");
    }
    if (dailyFinishedKpi && dailyFinishedKpi.percent !== null && dailyFinishedKpi.percent < 100) {
      alerts.push("KPI thành phẩm ngày báo cáo đạt " + dailyFinishedKpi.percent + "%.");
    }
    if (csCount > 0) alerts.push("Có " + csCount + " ống đang chờ sửa.");
    if (hongCount > 0) alerts.push("Có " + hongCount + " ống hỏng.");
    if (errorStats.length > 0) alerts.push("Lỗi nhiều nhất: " + errorStats[0].name + " (" + errorStats[0].count + ").");
    let resultData = {
      success: true,
      factoryHealth: health,
      alerts: alerts,
      planStats: finalPlanStats,
      kpi: {
        total: totalPipes,
        tp: tpCount,
        hong: hongCount,
        cs: csCount,
        dxl: dxlCount,
        tpPercent: totalPipes > 0 ? ((tpCount / totalPipes) * 100).toFixed(1) : 0,
        transactions: allTxns.length
      },
      processStats: sortedProcess,
      queueStats: queueStats,
      processQueueSummary: processQueueSummary,
      sizeStats: sizeStats,
      errorStats: errorStats,
      qualityAnalysis: qualityAnalysis,
      rigStats: rigStats,
      shiftStats: shiftStats,
      recent: recent,
      pipeLists: {
        tp: tpPipes,
        cs: csPipes,
        hong: hongPipes,
        dxl: dxlPipes,
        all: pipeObjects
      },
      processPipeLists: processPipeLists
    };

    function sanitizeDates(obj) {
      if (obj === null || obj === undefined) return obj;
      if (obj instanceof Date) {
        let d = obj.getDate().toString().padStart(2, '0');
        let m = (obj.getMonth() + 1).toString().padStart(2, '0');
        let y = obj.getFullYear();
        let h = obj.getHours().toString().padStart(2, '0');
        let min = obj.getMinutes().toString().padStart(2, '0');
        let sec = obj.getSeconds().toString().padStart(2, '0');
        if (h === '00' && min === '00' && sec === '00') {
            return `${d}/${m}/${y}`;
        }
        return `${d}/${m}/${y} ${h}:${min}:${sec}`;
      }
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          obj[i] = sanitizeDates(obj[i]);
        }
      } else if (typeof obj === 'object') {
        for (let key in obj) {
          if (obj.hasOwnProperty(key)) {
            obj[key] = sanitizeDates(obj[key]);
          }
        }
      }
      return obj;
    }

    return sanitizeDates(resultData);

  } catch (e) {
    return { success: false, error: e.toString(), stack: e.stack };
  }
}

function compactDashboardPipeItem_(pipe) {
  pipe = pipe || {};
  return {
    pipeNo: pipe.pipeNo || "",
    size: pipe.size || "",
    rig: pipe.rig || "",
    well: pipe.well || "",
    wellProfile: pipe.wellProfile || "",
    currentBusinessStatus: pipe.currentBusinessStatus || "",
    currentProcessState: pipe.currentProcessState || getBusinessProcessState_(pipe.currentBusinessStatus),
    statusGroup: getPipeDashboardStatusKey_(pipe),
    currentProcess: pipe.currentProcess || "",
    currentStatus: pipe.currentStatus || "",
    currentReason: pipe.currentReason || "",
    currentNextProcess: pipe.currentNextProcess || "",
    currentWorker1: pipe.currentWorker1 || "",
    currentWorker2: pipe.currentWorker2 || "",
    currentShift: pipe.currentShift || "",
    currentDate: pipe.currentDate || "",
    pressureTestCount: pipe.pressureTestCount || 0,
    threadRepairCount: pipe.threadRepairCount || 0,
    couplingChangeCount: pipe.couplingChangeCount || 0
  };
}

function compactDashboardPassport_(pipe) {
  const passport = compactDashboardPipeItem_(pipe);
  passport.history = (pipe && Array.isArray(pipe.history) ? pipe.history : []).map(txn => ({
    date: txn.date || "",
    shift: txn.shift || "",
    process: txn.process || "",
    status: txn.status || "",
    defectReason: txn.defectReason || "",
    worker1: txn.worker1 || "",
    worker2: txn.worker2 || "",
    qty: txn.qty || 0,
    entryNo: txn.entryNo || "",
    notes: txn.notes || ""
  }));
  return passport;
}

function getDashboardPipeListTitle_(statusKey) {
  const titles = {
    tp: "Thành phẩm",
    cs: "Chờ sửa",
    hong: "Hỏng / Loại",
    dxl: "Đang xử lý",
    all: "Tất cả"
  };
  return titles[statusKey] || "";
}

function getDashboardPipeNoKey_(pipeNo) {
  return (pipeNo === null || pipeNo === undefined ? "" : pipeNo.toString()).trim().toLowerCase();
}

function getDashboardPipeList(statusKey) {
  try {
    const normalizedStatusKey = (statusKey || "").toString().trim().toLowerCase();
    const title = getDashboardPipeListTitle_(normalizedStatusKey);
    if (!title) return { success: false, error: "statusKey không hợp lệ" };

    const snapshotResult = readDashboardDrilldownIndexForUser_();
    if (!snapshotResult.success) {
      return { success: false, error: snapshotResult.error || "Dashboard drilldown snapshot unavailable" };
    }

    const kpiPipeLists = snapshotResult.index.kpiPipeLists || {};
    const pipes = Array.isArray(kpiPipeLists[normalizedStatusKey])
      ? kpiPipeLists[normalizedStatusKey]
      : [];
    const compactPipes = pipes.slice();

    return {
      success: true,
      statusKey: normalizedStatusKey,
      title: title,
      total: compactPipes.length,
      snapshotMeta: snapshotResult.snapshotMeta || {},
      pipes: compactPipes
    };
  } catch (e) {
    return { success: false, error: e.toString(), stack: e.stack };
  }
}

function getDashboardProcessPipeList(processName) {
  try {
    const normalizedProcessName = (processName || "").toString().trim();
    if (!normalizedProcessName) return { success: false, error: "processName không hợp lệ" };

    const snapshotResult = readDashboardDrilldownIndexForUser_();
    if (!snapshotResult.success) {
      return { success: false, error: snapshotResult.error || "Dashboard drilldown snapshot unavailable" };
    }

    const processPipeLists = snapshotResult.index.queuePipeLists &&
      snapshotResult.index.queuePipeLists.byProcess;
    if (!processPipeLists || !Object.prototype.hasOwnProperty.call(processPipeLists, normalizedProcessName)) {
      return { success: false, error: "processName không hợp lệ" };
    }

    const pipes = Array.isArray(processPipeLists[normalizedProcessName]) ? processPipeLists[normalizedProcessName] : [];
    const compactPipes = pipes.slice();

    return {
      success: true,
      processName: normalizedProcessName,
      total: compactPipes.length,
      snapshotMeta: snapshotResult.snapshotMeta || {},
      pipes: compactPipes
    };
  } catch (e) {
    return { success: false, error: e.toString(), stack: e.stack };
  }
}

function getDashboardPassport(pipeNo) {
  try {
    const pipeKey = getDashboardPipeNoKey_(pipeNo);
    if (!pipeKey) return { success: false, error: "pipeNo không hợp lệ" };

    const indexResult = readDashboardDrilldownIndexForUser_();
    if (!indexResult.success) {
      return { success: false, error: indexResult.error || "Dashboard drilldown snapshot unavailable" };
    }

    const pipeIndex = indexResult.index && indexResult.index.pipeIndex;
    if (!pipeIndex || typeof pipeIndex !== "object") {
      return { success: false, error: "Dashboard drilldown index invalid" };
    }
    if (!Object.prototype.hasOwnProperty.call(pipeIndex, pipeKey)) {
      return { success: false, error: "Không tìm thấy ống" };
    }

    const passportResult = readDashboardDrilldownPassportForUser_(
      indexResult.manifest,
      indexResult.bundleVersion
    );
    if (!passportResult.success) {
      return { success: false, error: passportResult.error };
    }

    const passportByPipeNo = passportResult.passport.passportByPipeNo;
    if (!Object.prototype.hasOwnProperty.call(passportByPipeNo, pipeKey)) {
      return { success: false, error: "Dashboard drilldown passport payload missing" };
    }

    return {
      success: true,
      snapshotMeta: indexResult.snapshotMeta || {},
      pipe: passportByPipeNo[pipeKey]
    };
  } catch (e) {
    return { success: false, error: e.toString(), stack: e.stack };
  }
}

const DASHBOARD_SNAPSHOT_CACHE_KEY = "dashboard:snapshot:minimal:v1";
const DASHBOARD_SNAPSHOT_CACHE_TTL_SECONDS = 300;
const DASHBOARD_SNAPSHOT_PROP_MANIFEST_KEY = "DASHBOARD_SNAPSHOT_V1_MANIFEST";
const DASHBOARD_SNAPSHOT_PROP_META_KEY = "DASHBOARD_SNAPSHOT_V1_META";
const DASHBOARD_SNAPSHOT_PROP_CHUNK_PREFIX = "DASHBOARD_SNAPSHOT_V1_CHUNK_";
const DASHBOARD_SNAPSHOT_PROP_CHUNK_SIZE = 8000;
const DASHBOARD_SNAPSHOT_CACHE_MAX_BYTES = 90 * 1024;
const DASHBOARD_SNAPSHOT_DURABLE_MAX_BYTES = 450 * 1024;

const DASHBOARD_HISTORY_SNAPSHOT_SCHEMA_VERSION = "dashboard-history-v1";
const DASHBOARD_HISTORY_SNAPSHOT_CACHE_KEY_PREFIX = "dashboard:history-snapshot:v1:";
const DASHBOARD_HISTORY_SNAPSHOT_CACHE_TTL_SECONDS = 300;
const DASHBOARD_HISTORY_SNAPSHOT_CACHE_MAX_BYTES = 90 * 1024;
const DASHBOARD_HISTORY_SNAPSHOT_CATALOG_KEY = "DASHBOARD_HISTORY_V1_CATALOG";
const DASHBOARD_HISTORY_SNAPSHOT_CHUNK_PREFIX = "DASHBOARD_HISTORY_V1_";
const DASHBOARD_HISTORY_SNAPSHOT_CHUNK_SIZE = 8000;
const DASHBOARD_HISTORY_SNAPSHOT_MAX_ENTRIES = 14;
const DASHBOARD_HISTORY_SNAPSHOT_MAX_PAYLOAD_BYTES = 24 * 1024;
const DASHBOARD_HISTORY_SNAPSHOT_MAX_TOTAL_PAYLOAD_BYTES = 88 * 1024;
const DASHBOARD_HISTORY_SNAPSHOT_CATALOG_MAX_BYTES = 8 * 1024;
const DASHBOARD_HISTORY_SNAPSHOT_STORAGE_BUDGET_BYTES = 96 * 1024;
const DASHBOARD_HISTORY_SNAPSHOT_ROTATION_BUDGET_BYTES = 120 * 1024;
const DASHBOARD_HISTORY_SNAPSHOT_PROPERTY_STORE_BUDGET_BYTES = 480 * 1024;

function extractDashboardSnapshot_(fullResponse) {
  fullResponse = fullResponse || {};
  return {
    success: fullResponse.success,
    reportDate: fullResponse.reportDate || {},
    factoryHealth: fullResponse.factoryHealth,
    alerts: fullResponse.alerts || [],
    planStats: fullResponse.planStats || {},
    kpi: fullResponse.kpi || {},
    processStats: fullResponse.processStats || [],
    queueStats: fullResponse.queueStats || [],
    processQueueSummary: fullResponse.processQueueSummary || {},
    sizeStats: fullResponse.sizeStats || {},
    errorStats: fullResponse.errorStats || [],
    qualityAnalysis: fullResponse.qualityAnalysis || {},
    rigStats: fullResponse.rigStats || [],
    shiftStats: fullResponse.shiftStats || [],
    recent: fullResponse.recent || [],
    snapshotMeta: fullResponse.snapshotMeta || {}
  };
}

const DASHBOARD_DRILLDOWN_SCHEMA_VERSION = "dashboard-drilldown-v1";
const DASHBOARD_DRILLDOWN_INDEX_CACHE_KEY = "dashboard:drilldown:index:v1";
const DASHBOARD_DRILLDOWN_PASSPORT_CACHE_KEY = "dashboard:drilldown:passport:v1";
const DASHBOARD_DRILLDOWN_CACHE_TTL_SECONDS = DASHBOARD_SNAPSHOT_CACHE_TTL_SECONDS;
const DASHBOARD_DRILLDOWN_CACHE_MAX_BYTES = DASHBOARD_SNAPSHOT_CACHE_MAX_BYTES;
const DASHBOARD_DRILLDOWN_PROP_MANIFEST_KEY = "DASHBOARD_DRILLDOWN_V1_MANIFEST";
const DASHBOARD_DRILLDOWN_PROP_META_KEY = "DASHBOARD_DRILLDOWN_V1_META";
const DASHBOARD_DRILLDOWN_INDEX_CHUNK_PREFIX = "DASHBOARD_DRILLDOWN_V1_INDEX_";
const DASHBOARD_DRILLDOWN_PASSPORT_CHUNK_PREFIX = "DASHBOARD_DRILLDOWN_V1_PASSPORT_";
const DASHBOARD_DRILLDOWN_PROP_CHUNK_SIZE = DASHBOARD_SNAPSHOT_PROP_CHUNK_SIZE;
const DASHBOARD_DRILLDOWN_INDEX_MAX_BYTES = 120 * 1024;
const DASHBOARD_DRILLDOWN_PASSPORT_MAX_BYTES = 240 * 1024;
const DASHBOARD_DRILLDOWN_TOTAL_MAX_BYTES = 360 * 1024;
const DASHBOARD_DRILLDOWN_ROTATION_MAX_BYTES = 450 * 1024;
const DASHBOARD_DRILLDOWN_ROTATION_OVERHEAD_BYTES = 4096;
const DASHBOARD_DRILLDOWN_MAX_AGE_MS = 15 * 60 * 1000;

function extractDashboardDrilldownSnapshot_(fullResponse) {
  fullResponse = fullResponse || {};
  const statusKeys = ["tp", "cs", "hong", "dxl"];
  const pipeLists = fullResponse.pipeLists || {};
  const kpiPipeLists = {};
  const statusKeysByPipe = {};

  statusKeys.forEach(statusKey => {
    const pipes = Array.isArray(pipeLists[statusKey]) ? pipeLists[statusKey] : [];
    kpiPipeLists[statusKey] = pipes.map(compactDashboardPipeItem_);
    pipes.forEach(pipe => {
      const pipeKey = getDashboardPipeNoKey_(pipe && pipe.pipeNo);
      if (!pipeKey) return;
      if (!statusKeysByPipe[pipeKey]) statusKeysByPipe[pipeKey] = [];
      if (statusKeysByPipe[pipeKey].indexOf(statusKey) === -1) {
        statusKeysByPipe[pipeKey].push(statusKey);
      }
    });
  });

  const rawProcessPipeLists = fullResponse.processPipeLists || {};
  const queuePipeLists = {};
  Object.keys(rawProcessPipeLists).forEach(processName => {
    const pipes = Array.isArray(rawProcessPipeLists[processName])
      ? rawProcessPipeLists[processName]
      : [];
    queuePipeLists[processName] = pipes.map(compactDashboardPipeItem_);
  });

  const allPipes = Array.isArray(pipeLists.all) ? pipeLists.all : [];
  kpiPipeLists.all = allPipes.map(compactDashboardPipeItem_);
  const pipeIndex = {};
  const passportByPipeNo = {};

  allPipes.forEach(pipe => {
    const pipeKey = getDashboardPipeNoKey_(pipe && pipe.pipeNo);
    if (!pipeKey) return;
    if (Object.prototype.hasOwnProperty.call(passportByPipeNo, pipeKey)) {
      throw new Error("Duplicate normalized pipeNo in drilldown snapshot: " + pipeKey);
    }

    const compactPipe = compactDashboardPipeItem_(pipe);
    pipeIndex[pipeKey] = {
      pipeNo: compactPipe.pipeNo,
      statusKeys: statusKeysByPipe[pipeKey] || [],
      processName: compactPipe.currentProcess || ""
    };
    passportByPipeNo[pipeKey] = compactDashboardPassport_(pipe);
  });

  return {
    schemaVersion: DASHBOARD_DRILLDOWN_SCHEMA_VERSION,
    index: {
      kpiPipeLists: kpiPipeLists,
      queuePipeLists: {
        byProcess: queuePipeLists
      },
      pipeIndex: pipeIndex
    },
    passport: {
      passportByPipeNo: passportByPipeNo
    }
  };
}

function validateDashboardDrilldownSnapshot_(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return { valid: false, error: "Drilldown snapshot is empty" };
  }
  if (snapshot.schemaVersion !== DASHBOARD_DRILLDOWN_SCHEMA_VERSION) {
    return { valid: false, error: "Unsupported drilldown snapshot schema" };
  }
  if (!snapshot.snapshotMeta || snapshot.snapshotMeta.state !== "ready") {
    return { valid: false, error: "Drilldown snapshot is not ready" };
  }
  if (!snapshot.index || !snapshot.passport) {
    return { valid: false, error: "Missing index or passport payload" };
  }
  if (!snapshot.index.kpiPipeLists || typeof snapshot.index.kpiPipeLists !== "object") {
    return { valid: false, error: "Missing KPI pipe lists" };
  }
  if (!snapshot.index.queuePipeLists || !snapshot.index.queuePipeLists.byProcess) {
    return { valid: false, error: "Missing queue pipe lists" };
  }
  if (!snapshot.index.pipeIndex || !snapshot.passport.passportByPipeNo) {
    return { valid: false, error: "Missing pipe index or passport data" };
  }

  const requiredStatusKeys = ["tp", "cs", "hong", "dxl", "all"];
  for (let i = 0; i < requiredStatusKeys.length; i++) {
    if (!Array.isArray(snapshot.index.kpiPipeLists[requiredStatusKeys[i]])) {
      return { valid: false, error: "Invalid KPI pipe list: " + requiredStatusKeys[i] };
    }
  }
  return { valid: true, error: "" };
}

function getDashboardDrilldownPayload_(snapshot) {
  return {
    schemaVersion: snapshot.schemaVersion,
    index: snapshot.index,
    passport: snapshot.passport
  };
}

function stableDashboardDrilldownValue_(value) {
  if (Array.isArray(value)) return value.map(stableDashboardDrilldownValue_);
  if (!value || typeof value !== "object") return value;

  const stable = {};
  Object.keys(value).sort().forEach(key => {
    stable[key] = stableDashboardDrilldownValue_(value[key]);
  });
  return stable;
}

function computeDashboardDrilldownChecksum_(payload) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    payload,
    Utilities.Charset.UTF_8
  );
  return Utilities.base64Encode(digest);
}

function serializeDashboardDrilldownPayload_(payload) {
  const json = JSON.stringify(payload || {});
  const blob = Utilities.newBlob(json, "application/json", "dashboard-drilldown.json");
  const zipped = Utilities.gzip(blob);
  return Utilities.base64Encode(zipped.getBytes());
}

function deserializeDashboardDrilldownPayload_(payload) {
  const bytes = Utilities.base64Decode(payload);
  const zipped = Utilities.newBlob(bytes, "application/octet-stream", "dashboard-drilldown.gz");
  const json = Utilities.ungzip(zipped).getDataAsString();
  return JSON.parse(json);
}

function getDashboardDrilldownPayloadBytes_(payload) {
  return Utilities.newBlob(payload, "text/plain").getBytes().length;
}

function readDashboardDrilldownCacheArtifact_(cacheKey, artifactName) {
  try {
    const envelopeText = CacheService.getScriptCache().get(cacheKey);
    if (envelopeText === null) return null;

    const envelope = JSON.parse(envelopeText);
    if (envelope.schemaVersion !== DASHBOARD_DRILLDOWN_SCHEMA_VERSION ||
        envelope.artifact !== artifactName || !envelope.bundleVersion ||
        !envelope.payload) {
      throw new Error("Invalid drilldown cache envelope: " + artifactName);
    }
    if (getDashboardDrilldownPayloadBytes_(envelope.payload) !== Number(envelope.payloadBytes)) {
      throw new Error("Drilldown cache payload size mismatch: " + artifactName);
    }
    if (computeDashboardDrilldownChecksum_(envelope.payload) !== envelope.checksum) {
      throw new Error("Drilldown cache checksum mismatch: " + artifactName);
    }
    return envelope;
  } catch (error) {
    Logger.log("DASH_DRILLDOWN cache read error: " + error);
    return null;
  }
}

function readDashboardDrilldownCache_() {
  try {
    const indexEnvelope = readDashboardDrilldownCacheArtifact_(
      DASHBOARD_DRILLDOWN_INDEX_CACHE_KEY,
      "index"
    );
    const passportEnvelope = readDashboardDrilldownCacheArtifact_(
      DASHBOARD_DRILLDOWN_PASSPORT_CACHE_KEY,
      "passport"
    );
    if (indexEnvelope === null || passportEnvelope === null) return null;
    if (indexEnvelope.bundleVersion !== passportEnvelope.bundleVersion) {
      throw new Error("Drilldown cache bundle version mismatch");
    }

    const snapshot = {
      schemaVersion: DASHBOARD_DRILLDOWN_SCHEMA_VERSION,
      index: deserializeDashboardDrilldownPayload_(indexEnvelope.payload),
      passport: deserializeDashboardDrilldownPayload_(passportEnvelope.payload),
      snapshotMeta: {
        state: "ready",
        schemaVersion: DASHBOARD_DRILLDOWN_SCHEMA_VERSION,
        bundleVersion: indexEnvelope.bundleVersion
      }
    };
    const validation = validateDashboardDrilldownSnapshot_(snapshot);
    if (!validation.valid) throw new Error(validation.error);
    return snapshot;
  } catch (error) {
    Logger.log("DASH_DRILLDOWN cache snapshot read error: " + error);
    return null;
  }
}

function writeDashboardDrilldownCache_(cacheKey, artifactName, bundleVersion, payload) {
  try {
    const payloadBytes = getDashboardDrilldownPayloadBytes_(payload);
    const envelope = {
      schemaVersion: DASHBOARD_DRILLDOWN_SCHEMA_VERSION,
      artifact: artifactName,
      bundleVersion: bundleVersion,
      payloadBytes: payloadBytes,
      checksum: computeDashboardDrilldownChecksum_(payload),
      payload: payload
    };
    const envelopeText = JSON.stringify(envelope);
    const cacheBytes = getDashboardDrilldownPayloadBytes_(envelopeText);
    if (cacheBytes > DASHBOARD_DRILLDOWN_CACHE_MAX_BYTES) {
      Logger.log("DASH_DRILLDOWN cache write skipped payload too large | artifact=" + artifactName + " | cacheBytes=" + cacheBytes);
      return { success: false, skipped: true, payloadBytes: payloadBytes, cacheBytes: cacheBytes };
    }

    CacheService.getScriptCache().put(
      cacheKey,
      envelopeText,
      DASHBOARD_DRILLDOWN_CACHE_TTL_SECONDS
    );
    return { success: true, payloadBytes: payloadBytes, cacheBytes: cacheBytes, bundleVersion: bundleVersion };
  } catch (error) {
    Logger.log("DASH_DRILLDOWN cache write error: " + error);
    return { success: false, error: error.toString() };
  }
}

function readDashboardDrilldownManifest_() {
  try {
    const manifestText = PropertiesService.getScriptProperties()
      .getProperty(DASHBOARD_DRILLDOWN_PROP_MANIFEST_KEY);
    if (!manifestText) {
      return { manifest: null, error: "Drilldown manifest missing", code: "manifestMissing" };
    }

    const manifest = JSON.parse(manifestText);
    const artifacts = ["index", "passport"];
    if (manifest.schemaVersion !== DASHBOARD_DRILLDOWN_SCHEMA_VERSION ||
        manifest.state !== "ready" || !manifest.bundleVersion) {
      return { manifest: null, error: "Drilldown manifest invalid", code: "manifestInvalid" };
    }
    for (let i = 0; i < artifacts.length; i++) {
      const artifactName = artifacts[i];
      const artifact = manifest[artifactName];
      if (!artifact || artifact.state !== "ready" ||
          Number(artifact.chunkCount || 0) <= 0 ||
          Number(artifact.payloadBytes || 0) <= 0 ||
          !artifact.checksum) {
        return {
          manifest: null,
          error: "Drilldown " + artifacts[i] + " manifest metadata invalid",
          code: "manifestInvalid"
        };
      }
      const maxBytes = artifactName === "index"
        ? DASHBOARD_DRILLDOWN_INDEX_MAX_BYTES
        : DASHBOARD_DRILLDOWN_PASSPORT_MAX_BYTES;
      if (Number(artifact.payloadBytes) > maxBytes) {
        return {
          manifest: null,
          error: "Drilldown " + artifactName + " payload exceeds limit",
          code: "sizeExceeded",
          sizeExceeded: true
        };
      }
    }
    const totalPayloadBytes = Number(manifest.index.payloadBytes) + Number(manifest.passport.payloadBytes);
    if (totalPayloadBytes > DASHBOARD_DRILLDOWN_TOTAL_MAX_BYTES) {
      return {
        manifest: null,
        error: "Drilldown total payload exceeds limit",
        code: "sizeExceeded",
        sizeExceeded: true
      };
    }
    return { manifest: manifest, error: "", code: "" };
  } catch (error) {
    Logger.log("DASH_DRILLDOWN manifest read error: " + error);
    return { manifest: null, error: "Drilldown manifest read failed: " + error, code: "manifestInvalid" };
  }
}

function readDashboardDrilldownArtifact_(props, manifest, artifactName, chunkPrefix) {
  const artifact = manifest[artifactName];
  const prefix = chunkPrefix + manifest.bundleVersion + "_CHUNK_";
  let payload = "";
  for (let i = 0; i < Number(artifact.chunkCount); i++) {
    const chunk = props.getProperty(prefix + i);
    if (chunk === null) throw new Error("Missing drilldown " + artifactName + " chunk " + i);
    payload += chunk;
  }

  if (getDashboardDrilldownPayloadBytes_(payload) !== Number(artifact.payloadBytes)) {
    throw new Error("Drilldown " + artifactName + " payload size mismatch");
  }
  if (computeDashboardDrilldownChecksum_(payload) !== artifact.checksum) {
    throw new Error("Drilldown " + artifactName + " checksum mismatch");
  }
  return deserializeDashboardDrilldownPayload_(payload);
}

function validateDashboardDrilldownIndexPayload_(indexPayload) {
  if (!indexPayload || typeof indexPayload !== "object") {
    return { valid: false, error: "Dashboard drilldown index is empty" };
  }
  if (!indexPayload.kpiPipeLists || typeof indexPayload.kpiPipeLists !== "object") {
    return { valid: false, error: "Dashboard drilldown KPI lists are missing" };
  }
  if (!indexPayload.queuePipeLists || typeof indexPayload.queuePipeLists !== "object" ||
      !indexPayload.queuePipeLists.byProcess || typeof indexPayload.queuePipeLists.byProcess !== "object") {
    return { valid: false, error: "Dashboard drilldown queue pipe lists are missing" };
  }
  if (!indexPayload.pipeIndex || typeof indexPayload.pipeIndex !== "object") {
    return { valid: false, error: "Dashboard drilldown pipe index is missing" };
  }

  const requiredStatusKeys = ["tp", "cs", "hong", "dxl", "all"];
  for (let i = 0; i < requiredStatusKeys.length; i++) {
    if (!Array.isArray(indexPayload.kpiPipeLists[requiredStatusKeys[i]])) {
      return { valid: false, error: "Invalid dashboard drilldown KPI list: " + requiredStatusKeys[i] };
    }
  }
  const processNames = Object.keys(indexPayload.queuePipeLists.byProcess);
  for (let i = 0; i < processNames.length; i++) {
    if (!Array.isArray(indexPayload.queuePipeLists.byProcess[processNames[i]])) {
      return { valid: false, error: "Invalid dashboard drilldown queue list: " + processNames[i] };
    }
  }
  return { valid: true, error: "" };
}

function getDashboardDrilldownSnapshotMeta_(manifest, source) {
  const builtAt = manifest && manifest.builtAt ? manifest.builtAt : "";
  const meta = {
    stale: false,
    ageMs: 0,
    builtAt: builtAt,
    source: source || "",
    freshnessLimitMs: DASHBOARD_DRILLDOWN_MAX_AGE_MS,
    valid: true,
    error: ""
  };
  if (!builtAt) return meta;
  const builtAtMs = Date.parse(manifest.builtAt);
  if (!isFinite(builtAtMs)) {
    meta.valid = false;
    meta.error = "Dashboard drilldown builtAt is invalid";
    return meta;
  }
  meta.ageMs = Math.max(0, Date.now() - builtAtMs);
  meta.stale = meta.ageMs > DASHBOARD_DRILLDOWN_MAX_AGE_MS;
  return meta;
}

function validateDashboardDrilldownFreshness_(manifest) {
  const meta = getDashboardDrilldownSnapshotMeta_(manifest, "");
  return {
    valid: meta.valid,
    error: meta.error,
    stale: meta.stale,
    ageMs: meta.ageMs,
    builtAt: meta.builtAt,
    freshnessLimitMs: meta.freshnessLimitMs
  };
}

function readDashboardDrilldownIndexForUser_() {
  const manifestResult = readDashboardDrilldownManifest_();
  if (!manifestResult.manifest) {
    return { success: false, error: manifestResult.error || "Dashboard drilldown snapshot unavailable" };
  }

  const freshness = validateDashboardDrilldownFreshness_(manifestResult.manifest);
  if (!freshness.valid) return { success: false, error: freshness.error };

  const cacheEnvelope = readDashboardDrilldownCacheArtifact_(
    DASHBOARD_DRILLDOWN_INDEX_CACHE_KEY,
    "index"
  );
  if (cacheEnvelope && cacheEnvelope.bundleVersion === manifestResult.manifest.bundleVersion) {
    try {
      const indexPayload = deserializeDashboardDrilldownPayload_(cacheEnvelope.payload);
      const validation = validateDashboardDrilldownIndexPayload_(indexPayload);
      if (validation.valid) {
        return {
          success: true,
          source: "cache",
          bundleVersion: cacheEnvelope.bundleVersion,
          manifest: manifestResult.manifest,
          snapshotMeta: getDashboardDrilldownSnapshotMeta_(manifestResult.manifest, "cache"),
          index: indexPayload
        };
      }
      Logger.log("DASH_DRILLDOWN index cache rejected: " + validation.error);
    } catch (error) {
      Logger.log("DASH_DRILLDOWN index cache deserialize error: " + error);
    }
  }

  try {
    CacheService.getScriptCache().remove(DASHBOARD_DRILLDOWN_INDEX_CACHE_KEY);
  } catch (error) {
    Logger.log("DASH_DRILLDOWN index cache cleanup error: " + error);
  }

  try {
    const indexPayload = readDashboardDrilldownArtifact_(
      PropertiesService.getScriptProperties(),
      manifestResult.manifest,
      "index",
      DASHBOARD_DRILLDOWN_INDEX_CHUNK_PREFIX
    );
    const validation = validateDashboardDrilldownIndexPayload_(indexPayload);
    if (!validation.valid) return { success: false, error: validation.error };
    return {
      success: true,
      source: "durable",
      bundleVersion: manifestResult.manifest.bundleVersion,
      manifest: manifestResult.manifest,
      snapshotMeta: getDashboardDrilldownSnapshotMeta_(manifestResult.manifest, "durable"),
      index: indexPayload
    };
  } catch (error) {
    return {
      success: false,
      error: "Dashboard drilldown index unavailable: " + error.toString()
    };
  }
}

function validateDashboardDrilldownPassportPayload_(passportPayload) {
  if (!passportPayload || typeof passportPayload !== "object" ||
      !passportPayload.passportByPipeNo || typeof passportPayload.passportByPipeNo !== "object") {
    return { valid: false, error: "Dashboard drilldown passport payload missing" };
  }
  return { valid: true, error: "" };
}

function readDashboardDrilldownPassportForUser_(manifest, bundleVersion) {
  if (!manifest || !bundleVersion || manifest.bundleVersion !== bundleVersion) {
    return { success: false, error: "Dashboard drilldown passport bundle version mismatch" };
  }

  const cacheEnvelope = readDashboardDrilldownCacheArtifact_(
    DASHBOARD_DRILLDOWN_PASSPORT_CACHE_KEY,
    "passport"
  );
  if (cacheEnvelope && cacheEnvelope.bundleVersion === bundleVersion) {
    try {
      const passportPayload = deserializeDashboardDrilldownPayload_(cacheEnvelope.payload);
      const validation = validateDashboardDrilldownPassportPayload_(passportPayload);
      if (validation.valid) {
        return {
          success: true,
          source: "cache",
          bundleVersion: cacheEnvelope.bundleVersion,
          passport: passportPayload
        };
      }
      Logger.log("DASH_DRILLDOWN passport cache rejected: " + validation.error);
    } catch (error) {
      Logger.log("DASH_DRILLDOWN passport cache deserialize error: " + error);
    }
  }

  try {
    CacheService.getScriptCache().remove(DASHBOARD_DRILLDOWN_PASSPORT_CACHE_KEY);
  } catch (error) {
    Logger.log("DASH_DRILLDOWN passport cache cleanup error: " + error);
  }

  try {
    const passportPayload = readDashboardDrilldownArtifact_(
      PropertiesService.getScriptProperties(),
      manifest,
      "passport",
      DASHBOARD_DRILLDOWN_PASSPORT_CHUNK_PREFIX
    );
    const validation = validateDashboardDrilldownPassportPayload_(passportPayload);
    if (!validation.valid) return { success: false, error: validation.error };
    return {
      success: true,
      source: "durable",
      bundleVersion: manifest.bundleVersion,
      passport: passportPayload
    };
  } catch (error) {
    return {
      success: false,
      error: "Dashboard drilldown passport unavailable: " + error.toString()
    };
  }
}

function readDashboardDrilldown_() {
  try {
    const manifestResult = readDashboardDrilldownManifest_();
    if (!manifestResult.manifest) throw new Error(manifestResult.error);

    const props = PropertiesService.getScriptProperties();
    const snapshot = {
      schemaVersion: manifestResult.manifest.schemaVersion,
      index: readDashboardDrilldownArtifact_(
        props,
        manifestResult.manifest,
        "index",
        DASHBOARD_DRILLDOWN_INDEX_CHUNK_PREFIX
      ),
      passport: readDashboardDrilldownArtifact_(
        props,
        manifestResult.manifest,
        "passport",
        DASHBOARD_DRILLDOWN_PASSPORT_CHUNK_PREFIX
      ),
      snapshotMeta: {
        schemaVersion: manifestResult.manifest.schemaVersion,
        bundleVersion: manifestResult.manifest.bundleVersion,
        sourceSnapshotVersion: manifestResult.manifest.sourceSnapshotVersion || "",
        builtAt: manifestResult.manifest.builtAt || "",
        durationMs: manifestResult.manifest.durationMs || 0,
        state: "ready",
        success: true
      }
    };
    const validation = validateDashboardDrilldownSnapshot_(snapshot);
    if (!validation.valid) throw new Error(validation.error);
    return snapshot;
  } catch (error) {
    Logger.log("DASH_DRILLDOWN durable read error: " + error);
    return null;
  }
}

function writeDashboardDrilldownMeta_(metadata) {
  try {
    PropertiesService.getScriptProperties().setProperty(
      DASHBOARD_DRILLDOWN_PROP_META_KEY,
      JSON.stringify(metadata || {})
    );
  } catch (error) {
    Logger.log("DASH_DRILLDOWN metadata write error: " + error);
  }
}

function prepareDashboardDrilldownArtifact_(artifactName, payloadObject, maxBytes) {
  const payload = serializeDashboardDrilldownPayload_(payloadObject);
  const payloadBytes = getDashboardDrilldownPayloadBytes_(payload);
  if (payloadBytes > maxBytes) {
    return {
      success: false,
      sizeExceeded: true,
      artifact: artifactName,
      payloadBytes: payloadBytes,
      maxBytes: maxBytes,
      error: "Dashboard drilldown " + artifactName + " payload exceeds limit"
    };
  }
  return {
    success: true,
    artifact: artifactName,
    payload: payload,
    payloadBytes: payloadBytes,
    chunkCount: Math.ceil(payload.length / DASHBOARD_DRILLDOWN_PROP_CHUNK_SIZE),
    checksum: computeDashboardDrilldownChecksum_(payload)
  };
}

function writeDashboardDrilldownArtifact_(props, bundleVersion, prepared, chunkPrefix) {
  const prefix = chunkPrefix + bundleVersion + "_CHUNK_";
  const values = {};
  for (let i = 0; i < prepared.chunkCount; i++) {
    values[prefix + i] = prepared.payload.substring(
      i * DASHBOARD_DRILLDOWN_PROP_CHUNK_SIZE,
      (i + 1) * DASHBOARD_DRILLDOWN_PROP_CHUNK_SIZE
    );
  }
  props.setProperties(values);

  let persistedPayload = "";
  for (let i = 0; i < prepared.chunkCount; i++) {
    const chunk = props.getProperty(prefix + i);
    if (chunk === null) throw new Error("Missing written drilldown " + prepared.artifact + " chunk " + i);
    persistedPayload += chunk;
  }
  if (getDashboardDrilldownPayloadBytes_(persistedPayload) !== prepared.payloadBytes) {
    throw new Error("Written drilldown " + prepared.artifact + " payload size mismatch");
  }
  if (computeDashboardDrilldownChecksum_(persistedPayload) !== prepared.checksum) {
    throw new Error("Written drilldown " + prepared.artifact + " checksum mismatch");
  }
  return {
    state: "ready",
    chunkCount: prepared.chunkCount,
    payloadBytes: prepared.payloadBytes,
    checksum: prepared.checksum,
    payload: persistedPayload
  };
}

function deleteDashboardDrilldownArtifactChunks_(props, bundleVersion, artifact, chunkPrefix) {
  if (!artifact) return;
  const prefix = chunkPrefix + bundleVersion + "_CHUNK_";
  for (let i = 0; i < Number(artifact.chunkCount || 0); i++) {
    props.deleteProperty(prefix + i);
  }
}

function estimateDashboardDrilldownRotation_(indexPrepared, passportPrepared, oldManifest) {
  const newChunkCount = indexPrepared.chunkCount + passportPrepared.chunkCount;
  const oldIndex = oldManifest && oldManifest.index ? oldManifest.index : {};
  const oldPassport = oldManifest && oldManifest.passport ? oldManifest.passport : {};
  const oldChunkCount = Number(oldIndex.chunkCount || 0) + Number(oldPassport.chunkCount || 0);
  const newChunkStorageBytes = newChunkCount * DASHBOARD_DRILLDOWN_PROP_CHUNK_SIZE;
  const oldChunkStorageBytes = oldChunkCount * DASHBOARD_DRILLDOWN_PROP_CHUNK_SIZE;
  const estimatedRotationBytes = newChunkStorageBytes + oldChunkStorageBytes + DASHBOARD_DRILLDOWN_ROTATION_OVERHEAD_BYTES;

  return {
    newPayloadBytes: indexPrepared.payloadBytes + passportPrepared.payloadBytes,
    newChunkCount: newChunkCount,
    newChunkStorageBytes: newChunkStorageBytes,
    oldChunkCount: oldChunkCount,
    oldChunkStorageBytes: oldChunkStorageBytes,
    estimatedRotationBytes: estimatedRotationBytes,
    maxBytes: DASHBOARD_DRILLDOWN_ROTATION_MAX_BYTES
  };
}

function writeDashboardDrilldownBundle_(snapshot, validateParity) {
  const indexPrepared = prepareDashboardDrilldownArtifact_(
    "index",
    snapshot.index,
    DASHBOARD_DRILLDOWN_INDEX_MAX_BYTES
  );
  if (!indexPrepared.success) return indexPrepared;

  const passportPrepared = prepareDashboardDrilldownArtifact_(
    "passport",
    snapshot.passport,
    DASHBOARD_DRILLDOWN_PASSPORT_MAX_BYTES
  );
  if (!passportPrepared.success) return passportPrepared;

  const totalPayloadBytes = indexPrepared.payloadBytes + passportPrepared.payloadBytes;
  if (totalPayloadBytes > DASHBOARD_DRILLDOWN_TOTAL_MAX_BYTES) {
    return {
      success: false,
      sizeExceeded: true,
      payloadBytes: totalPayloadBytes,
      maxBytes: DASHBOARD_DRILLDOWN_TOTAL_MAX_BYTES,
      error: "Dashboard drilldown total payload exceeds limit"
    };
  }

  const props = PropertiesService.getScriptProperties();
  const oldManifestResult = readDashboardDrilldownManifest_();
  if (oldManifestResult.code === "manifestInvalid" || oldManifestResult.code === "sizeExceeded") {
    return {
      success: false,
      sizeExceeded: true,
      quotaExceeded: true,
      error: "Existing drilldown manifest is invalid; rotation quota cannot be preflighted safely"
    };
  }
  const oldManifest = oldManifestResult.manifest;
  const bundleVersion = snapshot.snapshotMeta.bundleVersion;
  const rotationEstimate = estimateDashboardDrilldownRotation_(
    indexPrepared,
    passportPrepared,
    oldManifest
  );
  if (rotationEstimate.estimatedRotationBytes > rotationEstimate.maxBytes) {
    return {
      success: false,
      sizeExceeded: true,
      quotaExceeded: true,
      rotationEstimate: rotationEstimate,
      error: "Dashboard drilldown rotation estimate exceeds quota budget"
    };
  }
  const writtenArtifacts = [];
  let manifestPublished = false;

  try {
    writtenArtifacts.push({
      prepared: indexPrepared,
      chunkPrefix: DASHBOARD_DRILLDOWN_INDEX_CHUNK_PREFIX
    });
    const indexWritten = writeDashboardDrilldownArtifact_(
      props,
      bundleVersion,
      indexPrepared,
      DASHBOARD_DRILLDOWN_INDEX_CHUNK_PREFIX
    );

    writtenArtifacts.push({
      prepared: passportPrepared,
      chunkPrefix: DASHBOARD_DRILLDOWN_PASSPORT_CHUNK_PREFIX
    });
    const passportWritten = writeDashboardDrilldownArtifact_(
      props,
      bundleVersion,
      passportPrepared,
      DASHBOARD_DRILLDOWN_PASSPORT_CHUNK_PREFIX
    );

    const actualSnapshot = {
      schemaVersion: DASHBOARD_DRILLDOWN_SCHEMA_VERSION,
      index: deserializeDashboardDrilldownPayload_(indexWritten.payload),
      passport: deserializeDashboardDrilldownPayload_(passportWritten.payload),
      snapshotMeta: snapshot.snapshotMeta
    };
    const validation = validateDashboardDrilldownSnapshot_(actualSnapshot);
    if (!validation.valid) throw new Error(validation.error);

    const expectedJson = JSON.stringify(stableDashboardDrilldownValue_(
      getDashboardDrilldownPayload_(snapshot)
    ));
    const actualJson = JSON.stringify(stableDashboardDrilldownValue_(
      getDashboardDrilldownPayload_(actualSnapshot)
    ));
    const parity = expectedJson === actualJson;
    if (validateParity && !parity) {
      writtenArtifacts.forEach(item => {
        deleteDashboardDrilldownArtifactChunks_(
          props,
          bundleVersion,
          { chunkCount: item.prepared.chunkCount },
          item.chunkPrefix
        );
      });
      return {
        success: false,
        parity: false,
        expectedChecksum: computeDashboardDrilldownChecksum_(expectedJson),
        actualChecksum: computeDashboardDrilldownChecksum_(actualJson),
        error: "Drilldown snapshot parity mismatch"
      };
    }

    const manifest = {
      schemaVersion: DASHBOARD_DRILLDOWN_SCHEMA_VERSION,
      state: "ready",
      bundleVersion: bundleVersion,
      sourceSnapshotVersion: snapshot.snapshotMeta.sourceSnapshotVersion || "",
      builtAt: snapshot.snapshotMeta.builtAt || "",
      durationMs: snapshot.snapshotMeta.durationMs || 0,
      totalPayloadBytes: totalPayloadBytes,
      rotationEstimate: rotationEstimate,
      updatedAt: new Date().toISOString(),
      index: {
        state: indexWritten.state,
        chunkCount: indexWritten.chunkCount,
        payloadBytes: indexWritten.payloadBytes,
        checksum: indexWritten.checksum
      },
      passport: {
        state: passportWritten.state,
        chunkCount: passportWritten.chunkCount,
        payloadBytes: passportWritten.payloadBytes,
        checksum: passportWritten.checksum
      }
    };
    props.setProperty(DASHBOARD_DRILLDOWN_PROP_MANIFEST_KEY, JSON.stringify(manifest));
    manifestPublished = true;

    if (oldManifest && oldManifest.bundleVersion !== bundleVersion) {
      deleteDashboardDrilldownArtifactChunks_(
        props,
        oldManifest.bundleVersion,
        oldManifest.index,
        DASHBOARD_DRILLDOWN_INDEX_CHUNK_PREFIX
      );
      deleteDashboardDrilldownArtifactChunks_(
        props,
        oldManifest.bundleVersion,
        oldManifest.passport,
        DASHBOARD_DRILLDOWN_PASSPORT_CHUNK_PREFIX
      );
    }

    const indexCache = writeDashboardDrilldownCache_(
      DASHBOARD_DRILLDOWN_INDEX_CACHE_KEY,
      "index",
      bundleVersion,
      indexPrepared.payload
    );
    const passportCache = writeDashboardDrilldownCache_(
      DASHBOARD_DRILLDOWN_PASSPORT_CACHE_KEY,
      "passport",
      bundleVersion,
      passportPrepared.payload
    );
    return {
      success: true,
      parity: parity,
      manifest: manifest,
      durable: manifest,
      cache: {
        index: indexCache,
        passport: passportCache
      },
      counts: getDashboardDrilldownCounts_(snapshot)
    };
  } catch (error) {
    if (!manifestPublished) {
      writtenArtifacts.forEach(item => {
        deleteDashboardDrilldownArtifactChunks_(
          props,
          bundleVersion,
          { chunkCount: item.prepared.chunkCount },
          item.chunkPrefix
        );
      });
    }
    return { success: false, error: error.toString() };
  }
}

function getDashboardDrilldownCounts_(snapshot) {
  const index = snapshot.index || {};
  const kpiCounts = {};
  Object.keys(index.kpiPipeLists || {}).forEach(statusKey => {
    kpiCounts[statusKey] = index.kpiPipeLists[statusKey].length;
  });

  const processCounts = {};
  const byProcess = index.queuePipeLists && index.queuePipeLists.byProcess || {};
  Object.keys(byProcess).forEach(processName => {
    processCounts[processName] = byProcess[processName].length;
  });

  return {
    kpi: kpiCounts,
    processes: processCounts,
    pipeIndex: Object.keys(index.pipeIndex || {}).length,
    passports: Object.keys(snapshot.passport && snapshot.passport.passportByPipeNo || {}).length
  };
}

function compareDashboardDrilldownSnapshots_(expectedSnapshot, actualSnapshot) {
  const expectedJson = JSON.stringify(stableDashboardDrilldownValue_(
    getDashboardDrilldownPayload_(expectedSnapshot)
  ));
  const actualJson = JSON.stringify(stableDashboardDrilldownValue_(
    getDashboardDrilldownPayload_(actualSnapshot)
  ));
  return {
    parity: expectedJson === actualJson,
    expectedChecksum: computeDashboardDrilldownChecksum_(expectedJson),
    actualChecksum: computeDashboardDrilldownChecksum_(actualJson),
    expectedCounts: getDashboardDrilldownCounts_(expectedSnapshot),
    actualCounts: getDashboardDrilldownCounts_(actualSnapshot)
  };
}

function isDashboardDrilldownQuotaError_(error) {
  const text = (error || "").toString().toLowerCase();
  return text.indexOf("quota") !== -1 ||
    text.indexOf("too large") !== -1 ||
    text.indexOf("exceeds") !== -1 ||
    text.indexOf("limit") !== -1 ||
    text.indexOf("properties service") !== -1 ||
    text.indexOf("propertiesservice") !== -1 ||
    text.indexOf("service invoked too many times") !== -1;
}

function runDashboardDrilldownSnapshotBuild_(validateParity) {
  const startedAt = Date.now();
  const bundleVersion = String(startedAt);
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    const lockMeta = {
      schemaVersion: DASHBOARD_DRILLDOWN_SCHEMA_VERSION,
      bundleVersion: bundleVersion,
      builtAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      success: false,
      state: "failed",
      error: "Dashboard drilldown refresh lock busy"
    };
    writeDashboardDrilldownMeta_(lockMeta);
    return { success: false, snapshotMeta: lockMeta };
  }

  try {
    const fullResponse = buildDashboardDataFresh_();
    if (!fullResponse || fullResponse.success !== true) {
      throw new Error(fullResponse && fullResponse.error
        ? fullResponse.error
        : "Dashboard fresh build failed");
    }

    const snapshot = extractDashboardDrilldownSnapshot_(fullResponse);
    snapshot.snapshotMeta = {
      schemaVersion: DASHBOARD_DRILLDOWN_SCHEMA_VERSION,
      bundleVersion: bundleVersion,
      sourceSnapshotVersion: bundleVersion,
      builtAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      success: true,
      state: "ready",
      error: ""
    };

    const validation = validateDashboardDrilldownSnapshot_(snapshot);
    if (!validation.valid) throw new Error(validation.error);

    const bundleResult = writeDashboardDrilldownBundle_(snapshot, validateParity);
    if (!bundleResult.success) {
      const quotaExceeded = !!bundleResult.quotaExceeded || isDashboardDrilldownQuotaError_(bundleResult.error);
      const failureMeta = {
        schemaVersion: DASHBOARD_DRILLDOWN_SCHEMA_VERSION,
        bundleVersion: bundleVersion,
        builtAt: snapshot.snapshotMeta.builtAt,
        durationMs: Date.now() - startedAt,
        success: false,
        state: "failed",
        sizeExceeded: !!bundleResult.sizeExceeded || quotaExceeded,
        quotaExceeded: quotaExceeded,
        parity: bundleResult.parity === false ? false : null,
        error: bundleResult.error || "Dashboard drilldown bundle write failed"
      };
      writeDashboardDrilldownMeta_(failureMeta);
      return Object.assign(bundleResult, { snapshotMeta: failureMeta });
    }

    const storedSnapshot = readDashboardDrilldown_();
    if (!storedSnapshot) throw new Error("Published drilldown snapshot could not be read back");
    const parityResult = compareDashboardDrilldownSnapshots_(snapshot, storedSnapshot);
    if (validateParity && !parityResult.parity) {
      const failureMeta = {
        schemaVersion: DASHBOARD_DRILLDOWN_SCHEMA_VERSION,
        bundleVersion: bundleVersion,
        builtAt: snapshot.snapshotMeta.builtAt,
        durationMs: Date.now() - startedAt,
        success: false,
        state: "failed",
        parity: false,
        error: "Drilldown snapshot parity mismatch after manifest publish"
      };
      writeDashboardDrilldownMeta_(failureMeta);
      return Object.assign(parityResult, { success: false, snapshotMeta: failureMeta });
    }

    const result = {
      success: true,
      parity: parityResult.parity,
      snapshotMeta: snapshot.snapshotMeta,
      durable: bundleResult.durable,
      cache: bundleResult.cache,
      counts: parityResult.actualCounts
    };
    writeDashboardDrilldownMeta_(snapshot.snapshotMeta);
    return result;
  } catch (error) {
    const errorMeta = {
      schemaVersion: DASHBOARD_DRILLDOWN_SCHEMA_VERSION,
      bundleVersion: bundleVersion,
      builtAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      success: false,
      state: "failed",
      error: error && error.message ? error.message : error.toString()
    };
    writeDashboardDrilldownMeta_(errorMeta);
    return { success: false, snapshotMeta: errorMeta };
  } finally {
    try {
      lock.releaseLock();
    } catch (lockError) {
      Logger.log("DASH_DRILLDOWN lock release error: " + lockError);
    }
  }
}

function refreshDashboardDrilldownSnapshot_() {
  return runDashboardDrilldownSnapshotBuild_(false);
}

function adminRefreshDashboardDrilldownSnapshot() {
  Logger.log("DASH_DRILLDOWN admin refresh requested");
  return refreshDashboardDrilldownSnapshot_();
}

function adminGetDashboardDrilldownSnapshotStatus() {
  try {
    const manifestResult = readDashboardDrilldownManifest_();
    const durableSnapshot = manifestResult.manifest ? readDashboardDrilldown_() : null;
    let cacheSnapshot = readDashboardDrilldownCache_();
    if (cacheSnapshot && manifestResult.manifest &&
        cacheSnapshot.snapshotMeta.bundleVersion !== manifestResult.manifest.bundleVersion) {
      Logger.log("DASH_DRILLDOWN cache ignored because durable bundle version differs");
      cacheSnapshot = null;
    }
    const selectedSnapshot = cacheSnapshot || durableSnapshot;
    const snapshotSource = cacheSnapshot ? "cache" : durableSnapshot ? "durable" : "none";
    const freshness = manifestResult.manifest
      ? getDashboardDrilldownSnapshotMeta_(manifestResult.manifest, snapshotSource)
      : getDashboardDrilldownSnapshotMeta_(null, snapshotSource);
    const selectedSnapshotMeta = selectedSnapshot && selectedSnapshot.snapshotMeta
      ? selectedSnapshot.snapshotMeta
      : {};
    const enrichedSnapshotMeta = Object.assign({}, selectedSnapshotMeta, {
      builtAt: freshness.builtAt || selectedSnapshotMeta.builtAt || "",
      stale: freshness.stale,
      ageMs: freshness.ageMs,
      freshnessLimitMs: freshness.freshnessLimitMs,
      source: snapshotSource
    });
    const metaText = PropertiesService.getScriptProperties()
      .getProperty(DASHBOARD_DRILLDOWN_PROP_META_KEY);
    const lastAttempt = metaText ? JSON.parse(metaText) : {};
    const lastRefreshStatus = {
      success: lastAttempt.success === true,
      state: lastAttempt.state || "",
      builtAt: lastAttempt.builtAt || "",
      durationMs: Number(lastAttempt.durationMs || 0),
      error: lastAttempt.error || ""
    };
    const sizeExceeded = !!lastAttempt.sizeExceeded || manifestResult.code === "sizeExceeded";
    const quotaExceeded = !!lastAttempt.quotaExceeded;
    const limitBlocked = sizeExceeded || quotaExceeded;
    const readError = limitBlocked ? "" : manifestResult.error ||
      (manifestResult.manifest && !durableSnapshot
        ? "Drilldown snapshot chunks or checksum invalid"
        : "");
    const freshnessError = freshness.valid ? "" : freshness.error;
    const error = limitBlocked
      ? (lastAttempt.error || manifestResult.error || "Dashboard drilldown write blocked by size/quota limit")
      : (readError || freshnessError);
    const payloadBytes = manifestResult.manifest
      ? Number(manifestResult.manifest.totalPayloadBytes || 0)
      : 0;
    const result = {
      success: !error && !limitBlocked,
      state: enrichedSnapshotMeta.state || (manifestResult.manifest ? manifestResult.manifest.state : ""),
      builtAt: enrichedSnapshotMeta.builtAt,
      ageMs: enrichedSnapshotMeta.ageMs,
      freshnessLimitMs: enrichedSnapshotMeta.freshnessLimitMs,
      stale: enrichedSnapshotMeta.stale,
      hasSnapshot: !!durableSnapshot,
      hasDurableSnapshot: !!durableSnapshot,
      hasCacheSnapshot: !!cacheSnapshot,
      schemaVersion: DASHBOARD_DRILLDOWN_SCHEMA_VERSION,
      snapshotMeta: enrichedSnapshotMeta,
      snapshotSource: snapshotSource,
      payloadBytes: payloadBytes,
      lastRefreshStatus: lastRefreshStatus,
      lastAttempt: lastAttempt,
      manifest: manifestResult.manifest || {},
      manifestStatus: manifestResult.code,
      counts: durableSnapshot ? getDashboardDrilldownCounts_(durableSnapshot) : {},
      sizeExceeded: sizeExceeded,
      quotaExceeded: quotaExceeded,
      error: error
    };
    return result;
  } catch (error) {
    const result = {
      success: false,
      state: "",
      builtAt: "",
      ageMs: 0,
      freshnessLimitMs: DASHBOARD_DRILLDOWN_MAX_AGE_MS,
      stale: false,
      hasSnapshot: false,
      hasDurableSnapshot: false,
      hasCacheSnapshot: false,
      schemaVersion: DASHBOARD_DRILLDOWN_SCHEMA_VERSION,
      snapshotMeta: {},
      snapshotSource: "none",
      payloadBytes: 0,
      lastRefreshStatus: {},
      lastAttempt: {},
      manifest: {},
      manifestStatus: "readError",
      counts: {},
      sizeExceeded: false,
      quotaExceeded: false,
      error: error.toString()
    };
    return result;
  }
}

function runDashboardReadModelRefreshStep_(name, refreshFn) {
  const startedAt = Date.now();
  try {
    if (typeof refreshFn !== "function") {
      throw new Error(name + " refresh function missing");
    }
    const result = refreshFn();
    const snapshotMeta = result && result.snapshotMeta ? result.snapshotMeta : {};
    const success = !!(result && result.success === true);
    return {
      success: success,
      state: snapshotMeta.state || (success ? "ready" : "failed"),
      builtAt: snapshotMeta.builtAt || new Date(startedAt).toISOString(),
      durationMs: Number(snapshotMeta.durationMs || (Date.now() - startedAt)),
      error: success ? "" : (snapshotMeta.error || (result && result.error) || (name + " refresh failed")),
      result: result || {}
    };
  } catch (error) {
    return {
      success: false,
      state: "failed",
      builtAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      error: error && error.message ? error.message : error.toString(),
      result: {}
    };
  }
}

function refreshDashboardReadModels_() {
  const startedAt = Date.now();
  const main = runDashboardReadModelRefreshStep_("main", function() {
    return refreshDashboardSnapshot_();
  });
  const drilldown = runDashboardReadModelRefreshStep_("drilldown", function() {
    return refreshDashboardDrilldownSnapshot_();
  });
  return {
    success: main.success === true && drilldown.success === true,
    builtAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt,
    main: main,
    drilldown: drilldown
  };
}

function adminValidateDashboardDrilldownParity() {
  Logger.log("DASH_DRILLDOWN admin parity validation requested");
  return runDashboardDrilldownSnapshotBuild_(true);
}

function serializeDashboardSnapshot_(snapshot) {
  const json = JSON.stringify(snapshot || {});
  const blob = Utilities.newBlob(json, "application/json", "dashboard-snapshot.json");
  const zipped = Utilities.gzip(blob);
  return Utilities.base64Encode(zipped.getBytes());
}

function deserializeDashboardSnapshot_(payload) {
  const bytes = Utilities.base64Decode(payload);
  const zipped = Utilities.newBlob(bytes, "application/octet-stream", "dashboard-snapshot.gz");
  const json = Utilities.ungzip(zipped).getDataAsString();
  return JSON.parse(json);
}

function getDashboardHistoricalSnapshotPayloadBytes_(payload) {
  return Utilities.newBlob(payload || "", "text/plain").getBytes().length;
}

function getDashboardHistoricalSnapshotPropertyBytes_(key, value) {
  return getDashboardHistoricalSnapshotPayloadBytes_(key) +
    getDashboardHistoricalSnapshotPayloadBytes_(value);
}

function getDashboardHistoricalSnapshotCacheKey_(dateKey) {
  return DASHBOARD_HISTORY_SNAPSHOT_CACHE_KEY_PREFIX + dateKey;
}

function getDashboardHistoricalSnapshotChunkPrefix_(dateKey, generation) {
  return DASHBOARD_HISTORY_SNAPSHOT_CHUNK_PREFIX + dateKey + "_" + generation + "_CHUNK_";
}

function createDashboardHistoricalSnapshotCatalog_() {
  return {
    schemaVersion: DASHBOARD_HISTORY_SNAPSHOT_SCHEMA_VERSION,
    state: "ready",
    updatedAt: "",
    entries: {}
  };
}

function validateDashboardHistoricalSnapshotCatalog_(catalog) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog) ||
      catalog.schemaVersion !== DASHBOARD_HISTORY_SNAPSHOT_SCHEMA_VERSION ||
      catalog.state !== "ready" || !catalog.entries ||
      typeof catalog.entries !== "object" || Array.isArray(catalog.entries)) {
    return { valid: false, error: "Historical snapshot catalog invalid", totalPayloadBytes: 0 };
  }

  const dateKeys = Object.keys(catalog.entries);
  if (dateKeys.length > DASHBOARD_HISTORY_SNAPSHOT_MAX_ENTRIES) {
    return { valid: false, error: "Historical snapshot catalog exceeds retention", totalPayloadBytes: 0 };
  }

  let totalPayloadBytes = 0;
  for (let i = 0; i < dateKeys.length; i++) {
    const dateKey = dateKeys[i];
    const entry = catalog.entries[dateKey];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !entry ||
        entry.state !== "ready" || entry.reportDate !== dateKey ||
        typeof entry.generation !== "string" || !entry.generation ||
        typeof entry.builtAt !== "string" || !entry.builtAt ||
        typeof entry.publishedAt !== "string" || !entry.publishedAt ||
        Number(entry.chunkCount || 0) <= 0 ||
        Number(entry.payloadBytes || 0) <= 0 ||
        Number(entry.payloadBytes) > DASHBOARD_HISTORY_SNAPSHOT_MAX_PAYLOAD_BYTES ||
        typeof entry.checksum !== "string" || !entry.checksum) {
      return { valid: false, error: "Historical snapshot catalog entry invalid: " + dateKey, totalPayloadBytes: 0 };
    }
    totalPayloadBytes += Number(entry.payloadBytes);
  }

  if (totalPayloadBytes > DASHBOARD_HISTORY_SNAPSHOT_MAX_TOTAL_PAYLOAD_BYTES) {
    return { valid: false, error: "Historical snapshot catalog exceeds payload budget", totalPayloadBytes: totalPayloadBytes };
  }
  return { valid: true, error: "", totalPayloadBytes: totalPayloadBytes };
}

function readDashboardHistoricalSnapshotCatalog_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const catalogText = props.getProperty(DASHBOARD_HISTORY_SNAPSHOT_CATALOG_KEY);
    if (!catalogText) {
      return {
        success: true,
        missing: true,
        catalog: createDashboardHistoricalSnapshotCatalog_(),
        totalPayloadBytes: 0,
        catalogBytes: 0
      };
    }

    const catalogBytes = getDashboardHistoricalSnapshotPayloadBytes_(catalogText);
    if (catalogBytes > DASHBOARD_HISTORY_SNAPSHOT_CATALOG_MAX_BYTES) {
      return { success: false, error: "Historical snapshot catalog exceeds size limit", catalog: null };
    }
    const catalog = JSON.parse(catalogText);
    const validation = validateDashboardHistoricalSnapshotCatalog_(catalog);
    if (!validation.valid) return { success: false, error: validation.error, catalog: null };
    return {
      success: true,
      missing: false,
      catalog: catalog,
      totalPayloadBytes: validation.totalPayloadBytes,
      catalogBytes: catalogBytes
    };
  } catch (error) {
    Logger.log("DASH_HISTORY catalog read error: " + error);
    return { success: false, error: error.toString(), catalog: null };
  }
}

function validateDashboardHistoricalSnapshotEnvelope_(envelope, dateKey) {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope) ||
      envelope.schemaVersion !== DASHBOARD_HISTORY_SNAPSHOT_SCHEMA_VERSION ||
      envelope.state !== "ready" || envelope.reportDate !== dateKey ||
      typeof envelope.builtAt !== "string" || !envelope.builtAt ||
      !isValidDashboardMinimalSnapshot_(envelope.snapshot) ||
      envelope.snapshot.reportDate.date !== dateKey ||
      envelope.snapshot.snapshotMeta.reportDate !== dateKey ||
      envelope.snapshot.snapshotMeta.schemaVersion !== DASHBOARD_HISTORY_SNAPSHOT_SCHEMA_VERSION ||
      envelope.snapshot.snapshotMeta.state !== "ready" ||
      envelope.snapshot.snapshotMeta.builtAt !== envelope.builtAt) {
    return { valid: false, error: "Historical snapshot envelope invalid for " + dateKey };
  }
  return { valid: true, error: "" };
}

function readDashboardHistoricalSnapshotCache_(dateKey) {
  try {
    const envelopeText = CacheService.getScriptCache()
      .get(getDashboardHistoricalSnapshotCacheKey_(dateKey));
    if (envelopeText === null) return null;

    const cacheEnvelope = JSON.parse(envelopeText);
    if (cacheEnvelope.schemaVersion !== DASHBOARD_HISTORY_SNAPSHOT_SCHEMA_VERSION ||
        cacheEnvelope.state !== "ready" || cacheEnvelope.reportDate !== dateKey ||
        typeof cacheEnvelope.generation !== "string" || !cacheEnvelope.generation ||
        !cacheEnvelope.payload || Number(cacheEnvelope.payloadBytes || 0) <= 0 ||
        typeof cacheEnvelope.checksum !== "string" || !cacheEnvelope.checksum) {
      throw new Error("Historical snapshot cache envelope invalid");
    }
    if (getDashboardHistoricalSnapshotPayloadBytes_(cacheEnvelope.payload) !== Number(cacheEnvelope.payloadBytes)) {
      throw new Error("Historical snapshot cache payload size mismatch");
    }
    if (computeDashboardDrilldownChecksum_(cacheEnvelope.payload) !== cacheEnvelope.checksum) {
      throw new Error("Historical snapshot cache checksum mismatch");
    }

    const historicalEnvelope = deserializeDashboardSnapshot_(cacheEnvelope.payload);
    const validation = validateDashboardHistoricalSnapshotEnvelope_(historicalEnvelope, dateKey);
    if (!validation.valid) throw new Error(validation.error);
    return historicalEnvelope.snapshot;
  } catch (error) {
    Logger.log("DASH_HISTORY cache read error | reportDate=" + dateKey + " | " + error);
    return null;
  }
}

function writeDashboardHistoricalSnapshotCachePrepared_(prepared) {
  try {
    const cacheEnvelope = {
      schemaVersion: DASHBOARD_HISTORY_SNAPSHOT_SCHEMA_VERSION,
      state: "ready",
      reportDate: prepared.reportDate,
      generation: prepared.generation,
      payloadBytes: prepared.payloadBytes,
      checksum: prepared.checksum,
      payload: prepared.payload
    };
    const envelopeText = JSON.stringify(cacheEnvelope);
    const cacheBytes = getDashboardHistoricalSnapshotPayloadBytes_(envelopeText);
    if (cacheBytes > DASHBOARD_HISTORY_SNAPSHOT_CACHE_MAX_BYTES) {
      return { success: false, skipped: true, cacheBytes: cacheBytes, error: "Historical snapshot cache payload exceeds limit" };
    }
    CacheService.getScriptCache().put(
      getDashboardHistoricalSnapshotCacheKey_(prepared.reportDate),
      envelopeText,
      DASHBOARD_HISTORY_SNAPSHOT_CACHE_TTL_SECONDS
    );
    return { success: true, cacheBytes: cacheBytes, payloadBytes: prepared.payloadBytes };
  } catch (error) {
    Logger.log("DASH_HISTORY cache write error | reportDate=" + prepared.reportDate + " | " + error);
    return { success: false, error: error.toString() };
  }
}

function readDashboardHistoricalSnapshotDurableResult_(dateKey) {
  try {
    const catalogResult = readDashboardHistoricalSnapshotCatalog_();
    if (!catalogResult.success || !catalogResult.catalog) {
      return { success: false, snapshot: null, error: catalogResult.error || "Historical snapshot catalog unavailable" };
    }
    const entry = catalogResult.catalog.entries[dateKey];
    if (!entry) return { success: false, missing: true, snapshot: null, error: "Historical snapshot missing" };

    const props = PropertiesService.getScriptProperties();
    const prefix = getDashboardHistoricalSnapshotChunkPrefix_(dateKey, entry.generation);
    let payload = "";
    for (let i = 0; i < Number(entry.chunkCount); i++) {
      const chunk = props.getProperty(prefix + i);
      if (chunk === null) throw new Error("Missing historical snapshot chunk " + i);
      payload += chunk;
    }
    if (getDashboardHistoricalSnapshotPayloadBytes_(payload) !== Number(entry.payloadBytes)) {
      throw new Error("Historical snapshot durable payload size mismatch");
    }
    if (computeDashboardDrilldownChecksum_(payload) !== entry.checksum) {
      throw new Error("Historical snapshot durable checksum mismatch");
    }

    const historicalEnvelope = deserializeDashboardSnapshot_(payload);
    const validation = validateDashboardHistoricalSnapshotEnvelope_(historicalEnvelope, dateKey);
    if (!validation.valid) throw new Error(validation.error);
    return {
      success: true,
      snapshot: historicalEnvelope.snapshot,
      entry: entry,
      payload: payload,
      catalog: catalogResult.catalog
    };
  } catch (error) {
    Logger.log("DASH_HISTORY durable read error | reportDate=" + dateKey + " | " + error);
    return { success: false, snapshot: null, error: error.toString() };
  }
}

function readDashboardHistoricalSnapshotForDate_(dateKey) {
  const cachedSnapshot = readDashboardHistoricalSnapshotCache_(dateKey);
  if (cachedSnapshot && cachedSnapshot.reportDate.date === dateKey) return cachedSnapshot;

  const durableResult = readDashboardHistoricalSnapshotDurableResult_(dateKey);
  if (!durableResult.success || !durableResult.snapshot ||
      durableResult.snapshot.reportDate.date !== dateKey) return null;
  writeDashboardHistoricalSnapshotCachePrepared_({
    reportDate: dateKey,
    generation: durableResult.entry.generation,
    payloadBytes: durableResult.entry.payloadBytes,
    checksum: durableResult.entry.checksum,
    payload: durableResult.payload
  });
  return durableResult.snapshot;
}

function prepareDashboardHistoricalSnapshot_(snapshot) {
  try {
    const minimalSnapshot = JSON.parse(JSON.stringify(extractDashboardSnapshot_(snapshot)));
    const dateKey = minimalSnapshot && minimalSnapshot.reportDate
      ? minimalSnapshot.reportDate.date
      : "";
    const parsedDate = dateKey ? parseDashboardOverviewDate_(dateKey) : null;
    if (!parsedDate || parsedDate.dateKey !== dateKey) {
      return { success: false, error: "Historical snapshot reportDate invalid" };
    }

    minimalSnapshot.snapshotMeta = Object.assign({}, minimalSnapshot.snapshotMeta || {}, {
      schemaVersion: DASHBOARD_HISTORY_SNAPSHOT_SCHEMA_VERSION,
      state: "ready",
      success: true,
      reportDate: dateKey
    });
    if (!isValidDashboardMinimalSnapshot_(minimalSnapshot)) {
      return { success: false, error: "Historical snapshot contract validation failed" };
    }

    const historicalEnvelope = {
      schemaVersion: DASHBOARD_HISTORY_SNAPSHOT_SCHEMA_VERSION,
      state: "ready",
      reportDate: dateKey,
      builtAt: minimalSnapshot.snapshotMeta.builtAt,
      snapshot: minimalSnapshot
    };
    const envelopeValidation = validateDashboardHistoricalSnapshotEnvelope_(historicalEnvelope, dateKey);
    if (!envelopeValidation.valid) return { success: false, error: envelopeValidation.error };

    const payload = serializeDashboardSnapshot_(historicalEnvelope);
    const payloadBytes = getDashboardHistoricalSnapshotPayloadBytes_(payload);
    if (payloadBytes > DASHBOARD_HISTORY_SNAPSHOT_MAX_PAYLOAD_BYTES) {
      return {
        success: false,
        sizeExceeded: true,
        reportDate: dateKey,
        payloadBytes: payloadBytes,
        maxBytes: DASHBOARD_HISTORY_SNAPSHOT_MAX_PAYLOAD_BYTES,
        error: "Historical snapshot payload exceeds per-date limit"
      };
    }
    return {
      success: true,
      reportDate: dateKey,
      generation: String(Date.now()) + "-" + Utilities.getUuid().slice(0, 8),
      builtAt: minimalSnapshot.snapshotMeta.builtAt,
      publishedAt: new Date().toISOString(),
      snapshot: minimalSnapshot,
      payload: payload,
      payloadBytes: payloadBytes,
      chunkCount: Math.ceil(payload.length / DASHBOARD_HISTORY_SNAPSHOT_CHUNK_SIZE),
      checksum: computeDashboardDrilldownChecksum_(payload)
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function compareDashboardMinimalSnapshots_(expected, actual) {
  const expectedJson = JSON.stringify(stableDashboardDrilldownValue_(expected || {}));
  const actualJson = JSON.stringify(stableDashboardDrilldownValue_(actual || {}));
  return {
    parity: expectedJson === actualJson,
    expectedChecksum: computeDashboardDrilldownChecksum_(expectedJson),
    actualChecksum: computeDashboardDrilldownChecksum_(actualJson)
  };
}
function buildDashboardHistoricalSnapshotCatalogPlan_(catalogResult, prepared) {
  const existingEntries = JSON.parse(JSON.stringify(catalogResult.catalog.entries || {}));
  existingEntries[prepared.reportDate] = {
    state: "ready",
    reportDate: prepared.reportDate,
    generation: prepared.generation,
    builtAt: prepared.builtAt,
    publishedAt: prepared.publishedAt,
    chunkCount: prepared.chunkCount,
    payloadBytes: prepared.payloadBytes,
    checksum: prepared.checksum
  };

  const orderedDates = Object.keys(existingEntries).sort(function(left, right) {
    if (left === prepared.reportDate) return -1;
    if (right === prepared.reportDate) return 1;
    const leftPublishedAt = existingEntries[left].publishedAt || "";
    const rightPublishedAt = existingEntries[right].publishedAt || "";
    if (leftPublishedAt !== rightPublishedAt) return rightPublishedAt.localeCompare(leftPublishedAt);
    return right.localeCompare(left);
  });

  const retainedEntries = {};
  let totalPayloadBytes = 0;
  for (let i = 0; i < orderedDates.length; i++) {
    const dateKey = orderedDates[i];
    const entry = existingEntries[dateKey];
    if (Object.keys(retainedEntries).length >= DASHBOARD_HISTORY_SNAPSHOT_MAX_ENTRIES) continue;
    if (totalPayloadBytes + Number(entry.payloadBytes) > DASHBOARD_HISTORY_SNAPSHOT_MAX_TOTAL_PAYLOAD_BYTES) continue;
    retainedEntries[dateKey] = entry;
    totalPayloadBytes += Number(entry.payloadBytes);
  }
  if (!retainedEntries[prepared.reportDate] ||
      retainedEntries[prepared.reportDate].generation !== prepared.generation) {
    return { success: false, sizeExceeded: true, error: "Historical snapshot cannot fit retention budget" };
  }

  const catalog = {
    schemaVersion: DASHBOARD_HISTORY_SNAPSHOT_SCHEMA_VERSION,
    state: "ready",
    updatedAt: new Date().toISOString(),
    entries: retainedEntries
  };
  const validation = validateDashboardHistoricalSnapshotCatalog_(catalog);
  if (!validation.valid) return { success: false, error: validation.error };

  const catalogText = JSON.stringify(catalog);
  const catalogBytes = getDashboardHistoricalSnapshotPayloadBytes_(catalogText);
  if (catalogBytes > DASHBOARD_HISTORY_SNAPSHOT_CATALOG_MAX_BYTES) {
    return { success: false, sizeExceeded: true, error: "Historical snapshot catalog exceeds property limit" };
  }
  if (validation.totalPayloadBytes + catalogBytes > DASHBOARD_HISTORY_SNAPSHOT_STORAGE_BUDGET_BYTES) {
    return { success: false, sizeExceeded: true, error: "Historical snapshot catalog exceeds storage budget" };
  }

  const rotationBytes = Number(catalogResult.totalPayloadBytes || 0) + prepared.payloadBytes + catalogBytes;
  if (rotationBytes > DASHBOARD_HISTORY_SNAPSHOT_ROTATION_BUDGET_BYTES) {
    return { success: false, sizeExceeded: true, error: "Historical snapshot rotation exceeds temporary budget" };
  }

  const evictedEntries = [];
  Object.keys(catalogResult.catalog.entries || {}).forEach(function(dateKey) {
    const oldEntry = catalogResult.catalog.entries[dateKey];
    const retainedEntry = retainedEntries[dateKey];
    if (!retainedEntry || retainedEntry.generation !== oldEntry.generation) {
      evictedEntries.push(oldEntry);
    }
  });
  return {
    success: true,
    catalog: catalog,
    catalogText: catalogText,
    catalogBytes: catalogBytes,
    totalPayloadBytes: validation.totalPayloadBytes,
    rotationBytes: rotationBytes,
    evictedEntries: evictedEntries
  };
}

function writeDashboardHistoricalSnapshotArtifact_(props, prepared) {
  const prefix = getDashboardHistoricalSnapshotChunkPrefix_(prepared.reportDate, prepared.generation);
  const values = {};
  for (let i = 0; i < prepared.chunkCount; i++) {
    values[prefix + i] = prepared.payload.substring(
      i * DASHBOARD_HISTORY_SNAPSHOT_CHUNK_SIZE,
      (i + 1) * DASHBOARD_HISTORY_SNAPSHOT_CHUNK_SIZE
    );
  }
  props.setProperties(values);

  let persistedPayload = "";
  for (let i = 0; i < prepared.chunkCount; i++) {
    const chunk = props.getProperty(prefix + i);
    if (chunk === null) throw new Error("Missing written historical snapshot chunk " + i);
    persistedPayload += chunk;
  }
  if (getDashboardHistoricalSnapshotPayloadBytes_(persistedPayload) !== prepared.payloadBytes) {
    throw new Error("Written historical snapshot payload size mismatch");
  }
  if (computeDashboardDrilldownChecksum_(persistedPayload) !== prepared.checksum) {
    throw new Error("Written historical snapshot checksum mismatch");
  }
  return persistedPayload;
}

function validateDashboardHistoricalSnapshotPropertyStoreBudget_(props, prepared, catalogPlan) {
  const currentProperties = props.getProperties();
  let projectedBytes = 0;
  Object.keys(currentProperties).forEach(function(key) {
    if (key === DASHBOARD_HISTORY_SNAPSHOT_CATALOG_KEY) return;
    projectedBytes += getDashboardHistoricalSnapshotPropertyBytes_(key, currentProperties[key]);
  });
  projectedBytes += getDashboardHistoricalSnapshotPropertyBytes_(
    DASHBOARD_HISTORY_SNAPSHOT_CATALOG_KEY,
    catalogPlan.catalogText
  );

  const prefix = getDashboardHistoricalSnapshotChunkPrefix_(prepared.reportDate, prepared.generation);
  for (let i = 0; i < prepared.chunkCount; i++) {
    const chunk = prepared.payload.substring(
      i * DASHBOARD_HISTORY_SNAPSHOT_CHUNK_SIZE,
      (i + 1) * DASHBOARD_HISTORY_SNAPSHOT_CHUNK_SIZE
    );
    projectedBytes += getDashboardHistoricalSnapshotPropertyBytes_(prefix + i, chunk);
  }
  return {
    success: projectedBytes <= DASHBOARD_HISTORY_SNAPSHOT_PROPERTY_STORE_BUDGET_BYTES,
    projectedBytes: projectedBytes,
    budgetBytes: DASHBOARD_HISTORY_SNAPSHOT_PROPERTY_STORE_BUDGET_BYTES,
    error: projectedBytes <= DASHBOARD_HISTORY_SNAPSHOT_PROPERTY_STORE_BUDGET_BYTES
      ? ""
      : "Historical snapshot would exceed property store safety budget"
  };
}

function deleteDashboardHistoricalSnapshotChunks_(props, entry) {
  if (!entry || !entry.reportDate || !entry.generation) return;
  const prefix = getDashboardHistoricalSnapshotChunkPrefix_(entry.reportDate, entry.generation);
  for (let i = 0; i < Number(entry.chunkCount || 0); i++) {
    try {
      props.deleteProperty(prefix + i);
    } catch (error) {
      Logger.log("DASH_HISTORY chunk cleanup error | reportDate=" + entry.reportDate + " | " + error);
    }
  }
}

function archiveDashboardHistoricalSnapshot_(snapshot) {
  const prepared = prepareDashboardHistoricalSnapshot_(snapshot);
  if (!prepared.success) return prepared;

  const catalogResult = readDashboardHistoricalSnapshotCatalog_();
  if (!catalogResult.success || !catalogResult.catalog) {
    return { success: false, reportDate: prepared.reportDate, error: catalogResult.error || "Historical snapshot catalog unavailable" };
  }
  const catalogPlan = buildDashboardHistoricalSnapshotCatalogPlan_(catalogResult, prepared);
  if (!catalogPlan.success) return Object.assign({ reportDate: prepared.reportDate }, catalogPlan);

  const props = PropertiesService.getScriptProperties();
  const storeBudget = validateDashboardHistoricalSnapshotPropertyStoreBudget_(
    props,
    prepared,
    catalogPlan
  );
  if (!storeBudget.success) {
    return {
      success: false,
      reportDate: prepared.reportDate,
      sizeExceeded: true,
      projectedPropertyStoreBytes: storeBudget.projectedBytes,
      propertyStoreBudgetBytes: storeBudget.budgetBytes,
      error: storeBudget.error
    };
  }
  let artifactWritten = false;
  let catalogPublished = false;
  try {
    artifactWritten = true;
    const persistedPayload = writeDashboardHistoricalSnapshotArtifact_(props, prepared);
    const persistedEnvelope = deserializeDashboardSnapshot_(persistedPayload);
    const envelopeValidation = validateDashboardHistoricalSnapshotEnvelope_(persistedEnvelope, prepared.reportDate);
    if (!envelopeValidation.valid) throw new Error(envelopeValidation.error);
    const parity = compareDashboardMinimalSnapshots_(prepared.snapshot, persistedEnvelope.snapshot);
    if (!parity.parity) throw new Error("Historical snapshot parity mismatch before publish");

    props.setProperty(DASHBOARD_HISTORY_SNAPSHOT_CATALOG_KEY, catalogPlan.catalogText);
    catalogPublished = true;

    catalogPlan.evictedEntries.forEach(function(entry) {
      deleteDashboardHistoricalSnapshotChunks_(props, entry);
      if (entry.reportDate !== prepared.reportDate) {
        try {
          CacheService.getScriptCache().remove(getDashboardHistoricalSnapshotCacheKey_(entry.reportDate));
        } catch (cacheError) {
          Logger.log("DASH_HISTORY cache cleanup error | reportDate=" + entry.reportDate + " | " + cacheError);
        }
      }
    });
    const cacheResult = writeDashboardHistoricalSnapshotCachePrepared_(prepared);
    Logger.log(
      "DASH_HISTORY publish ok | reportDate=" + prepared.reportDate +
      " | generation=" + prepared.generation +
      " | payloadBytes=" + prepared.payloadBytes +
      " | retained=" + Object.keys(catalogPlan.catalog.entries).length
    );
    return {
      success: true,
      reportDate: prepared.reportDate,
      schemaVersion: DASHBOARD_HISTORY_SNAPSHOT_SCHEMA_VERSION,
      generation: prepared.generation,
      builtAt: prepared.builtAt,
      parity: true,
      expectedChecksum: parity.expectedChecksum,
      actualChecksum: parity.actualChecksum,
      payloadBytes: prepared.payloadBytes,
      catalogBytes: catalogPlan.catalogBytes,
      totalPayloadBytes: catalogPlan.totalPayloadBytes,
      retainedEntries: Object.keys(catalogPlan.catalog.entries).length,
      maxEntries: DASHBOARD_HISTORY_SNAPSHOT_MAX_ENTRIES,
      storageBudgetBytes: DASHBOARD_HISTORY_SNAPSHOT_STORAGE_BUDGET_BYTES,
      projectedPropertyStoreBytes: storeBudget.projectedBytes,
      propertyStoreBudgetBytes: storeBudget.budgetBytes,
      cache: cacheResult
    };
  } catch (error) {
    if (artifactWritten && !catalogPublished) {
      deleteDashboardHistoricalSnapshotChunks_(props, {
        reportDate: prepared.reportDate,
        generation: prepared.generation,
        chunkCount: prepared.chunkCount
      });
    }
    Logger.log("DASH_HISTORY publish error | reportDate=" + prepared.reportDate + " | " + error);
    return { success: false, reportDate: prepared.reportDate, error: error.toString() };
  }
}

function buildDashboardHistoricalSnapshotForDate_(dateKey) {
  const startedAt = Date.now();
  const source = getDashboardOverviewSource_();
  const coreResponse = buildDashboardOverviewDateCore_(dateKey, source);
  const fullResponse = applyDashboardOverviewDateContext_(coreResponse, {
    userSelected: true,
    usedNearestDate: false
  });
  if (!fullResponse || fullResponse.success !== true) {
    return {
      success: false,
      reportDate: dateKey,
      durationMs: Date.now() - startedAt,
      error: fullResponse && fullResponse.error ? fullResponse.error : "Historical snapshot build failed"
    };
  }

  const snapshot = extractDashboardSnapshot_(fullResponse);
  snapshot.snapshotMeta = {
    schemaVersion: DASHBOARD_HISTORY_SNAPSHOT_SCHEMA_VERSION,
    builtAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt,
    version: "history-" + dateKey + "-" + startedAt,
    success: true,
    state: "ready",
    reportDate: dateKey,
    error: ""
  };
  if (!isValidDashboardMinimalSnapshot_(snapshot) || snapshot.reportDate.date !== dateKey) {
    return {
      success: false,
      reportDate: dateKey,
      durationMs: Date.now() - startedAt,
      error: "Historical snapshot build contract validation failed"
    };
  }
  return { success: true, reportDate: dateKey, durationMs: Date.now() - startedAt, snapshot: snapshot };
}

function adminBackfillDashboardHistoricalSnapshot(reportDateText) {
  const totalStartedAt = Date.now();
  const requestedText = (reportDateText || "").toString().trim();
  const parsed = parseDashboardOverviewDate_(requestedText);
  if (!parsed || parsed.dateKey !== requestedText) {
    return { success: false, error: "Ngày backfill không hợp lệ. Dùng định dạng yyyy-MM-dd." };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return { success: false, reportDate: parsed.dateKey, error: "Historical snapshot backfill lock busy" };
  }
  try {
    const buildStartedAt = Date.now();
    const buildResult = buildDashboardHistoricalSnapshotForDate_(parsed.dateKey);
    const buildMs = Date.now() - buildStartedAt;
    if (!buildResult.success) {
      Logger.log("DASH_HISTORY backfill build failed | reportDate=" + parsed.dateKey + " | " + buildResult.error);
      return Object.assign(buildResult, {
        timingsMs: { build: buildMs, total: Date.now() - totalStartedAt }
      });
    }

    const archiveStartedAt = Date.now();
    const archiveResult = archiveDashboardHistoricalSnapshot_(buildResult.snapshot);
    const archiveMs = Date.now() - archiveStartedAt;
    if (!archiveResult.success) {
      Logger.log("DASH_HISTORY backfill archive failed | reportDate=" + parsed.dateKey + " | " + archiveResult.error);
      return Object.assign(archiveResult, {
        timingsMs: { build: buildMs, archive: archiveMs, total: Date.now() - totalStartedAt }
      });
    }

    const storedResult = readDashboardHistoricalSnapshotDurableResult_(parsed.dateKey);
    const parity = storedResult.success
      ? compareDashboardMinimalSnapshots_(buildResult.snapshot, storedResult.snapshot)
      : { parity: false, expectedChecksum: "", actualChecksum: "" };
    const result = Object.assign({}, archiveResult, {
      success: storedResult.success && parity.parity,
      parity: storedResult.success && parity.parity,
      expectedChecksum: parity.expectedChecksum,
      actualChecksum: parity.actualChecksum,
      timingsMs: {
        build: buildMs,
        archive: archiveMs,
        total: Date.now() - totalStartedAt
      }
    });
    if (!result.success) result.error = storedResult.error || "Historical snapshot parity failed after publish";
    Logger.log(
      "DASH_HISTORY backfill complete | reportDate=" + parsed.dateKey +
      " | success=" + result.success +
      " | parity=" + result.parity +
      " | durationMs=" + result.timingsMs.total
    );
    return result;
  } catch (error) {
    return {
      success: false,
      reportDate: parsed.dateKey,
      durationMs: Date.now() - totalStartedAt,
      error: error && error.message ? error.message : error.toString()
    };
  } finally {
    try {
      lock.releaseLock();
    } catch (lockError) {
      Logger.log("DASH_HISTORY backfill lock release error: " + lockError);
    }
  }
}

function adminGetDashboardHistoricalSnapshotStatus(reportDateText) {
  const requestedText = (reportDateText || "").toString().trim();
  const parsed = parseDashboardOverviewDate_(requestedText);
  if (!parsed || parsed.dateKey !== requestedText) {
    return { success: false, error: "Ngày snapshot không hợp lệ. Dùng định dạng yyyy-MM-dd." };
  }

  const cacheStartedAt = Date.now();
  const cacheSnapshot = readDashboardHistoricalSnapshotCache_(parsed.dateKey);
  const cacheMs = Date.now() - cacheStartedAt;
  const durableStartedAt = Date.now();
  const durableResult = readDashboardHistoricalSnapshotDurableResult_(parsed.dateKey);
  const durableMs = Date.now() - durableStartedAt;
  const selectedSnapshot = cacheSnapshot || durableResult.snapshot;
  const catalogResult = readDashboardHistoricalSnapshotCatalog_();
  return {
    success: !!selectedSnapshot,
    hasSnapshot: !!selectedSnapshot,
    reportDate: parsed.dateKey,
    cacheHit: !!cacheSnapshot,
    durableHit: !!durableResult.snapshot,
    exactDate: !!selectedSnapshot && selectedSnapshot.reportDate.date === parsed.dateKey,
    snapshotMeta: selectedSnapshot ? selectedSnapshot.snapshotMeta : {},
    timingsMs: { cacheRead: cacheMs, durableRead: durableMs },
    retention: {
      entries: catalogResult.success ? Object.keys(catalogResult.catalog.entries).length : 0,
      maxEntries: DASHBOARD_HISTORY_SNAPSHOT_MAX_ENTRIES,
      totalPayloadBytes: catalogResult.totalPayloadBytes || 0,
      maxTotalPayloadBytes: DASHBOARD_HISTORY_SNAPSHOT_MAX_TOTAL_PAYLOAD_BYTES,
      storageBudgetBytes: DASHBOARD_HISTORY_SNAPSHOT_STORAGE_BUDGET_BYTES
    },
    error: selectedSnapshot ? "" : (durableResult.error || "Historical snapshot missing")
  };
}

function adminBenchmarkDashboardSnapshotReads(reportDateText) {
  const requestedText = (reportDateText || "").toString().trim();
  const parsed = parseDashboardOverviewDate_(requestedText);
  if (!parsed || parsed.dateKey !== requestedText) {
    return { success: false, error: "Ngày benchmark không hợp lệ. Dùng định dạng yyyy-MM-dd." };
  }

  const durableStatus = readDashboardHistoricalSnapshotDurableResult_(parsed.dateKey);
  if (!durableStatus.success || !durableStatus.snapshot) {
    return { success: false, reportDate: parsed.dateKey, error: durableStatus.error || "Historical snapshot missing" };
  }

  const currentStartedAt = Date.now();
  const currentResponse = getDashboardData("");
  const currentMs = Date.now() - currentStartedAt;

  readDashboardHistoricalSnapshotForDate_(parsed.dateKey);
  const l1StartedAt = Date.now();
  const l1Response = getDashboardData(parsed.dateKey);
  const l1Ms = Date.now() - l1StartedAt;

  CacheService.getScriptCache().remove(getDashboardHistoricalSnapshotCacheKey_(parsed.dateKey));
  const durableStartedAt = Date.now();
  const durableResponse = getDashboardData(parsed.dateKey);
  const durableMs = Date.now() - durableStartedAt;

  return {
    success: !!(currentResponse && currentResponse.success &&
      l1Response && l1Response.success && durableResponse && durableResponse.success),
    reportDate: parsed.dateKey,
    currentReportDate: currentResponse && currentResponse.reportDate ? currentResponse.reportDate.date : "",
    historicalL1ReportDate: l1Response && l1Response.reportDate ? l1Response.reportDate.date : "",
    historicalDurableReportDate: durableResponse && durableResponse.reportDate ? durableResponse.reportDate.date : "",
    exactDate: !!(l1Response && durableResponse &&
      l1Response.reportDate && durableResponse.reportDate &&
      l1Response.reportDate.date === parsed.dateKey &&
      durableResponse.reportDate.date === parsed.dateKey),
    timingsMs: {
      currentSnapshot: currentMs,
      historicalL1: l1Ms,
      historicalL1MissDurableHit: durableMs
    }
  };
}
function readDashboardSnapshotCache_() {
  try {
    const payload = CacheService.getScriptCache().get(DASHBOARD_SNAPSHOT_CACHE_KEY);
    if (payload === null) return null;
    return deserializeDashboardSnapshot_(payload);
  } catch (error) {
    Logger.log("DASH_SNAPSHOT cache read error: " + error);
    return null;
  }
}

function writeDashboardSnapshotCache_(snapshot) {
  try {
    const payload = serializeDashboardSnapshot_(snapshot);
    const payloadBytes = Utilities.newBlob(payload, "text/plain").getBytes().length;
    if (payloadBytes > DASHBOARD_SNAPSHOT_CACHE_MAX_BYTES) {
      Logger.log("DASH_SNAPSHOT cache write skipped payload too large | payloadBytes=" + payloadBytes);
      return { success: false, skipped: true, payloadBytes: payloadBytes };
    }

    CacheService.getScriptCache().put(
      DASHBOARD_SNAPSHOT_CACHE_KEY,
      payload,
      DASHBOARD_SNAPSHOT_CACHE_TTL_SECONDS
    );
    Logger.log("DASH_SNAPSHOT cache write ok | payloadBytes=" + payloadBytes + " | ttl=" + DASHBOARD_SNAPSHOT_CACHE_TTL_SECONDS);
    return { success: true, payloadBytes: payloadBytes };
  } catch (error) {
    Logger.log("DASH_SNAPSHOT cache write error: " + error);
    return { success: false, error: error.toString() };
  }
}

function readDashboardSnapshot_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const manifestText = props.getProperty(DASHBOARD_SNAPSHOT_PROP_MANIFEST_KEY);
    if (!manifestText) return null;

    const manifest = JSON.parse(manifestText);
    const chunkCount = Number(manifest.chunkCount || 0);
    if (chunkCount <= 0) return null;

    let payload = "";
    for (let i = 0; i < chunkCount; i++) {
      const chunk = props.getProperty(DASHBOARD_SNAPSHOT_PROP_CHUNK_PREFIX + i);
      if (chunk === null) throw new Error("Missing dashboard snapshot chunk " + i);
      payload += chunk;
    }

    return deserializeDashboardSnapshot_(payload);
  } catch (error) {
    Logger.log("DASH_SNAPSHOT durable read error: " + error);
    return null;
  }
}

function writeDashboardSnapshot_(snapshot) {
  try {
    const props = PropertiesService.getScriptProperties();
    const oldManifestText = props.getProperty(DASHBOARD_SNAPSHOT_PROP_MANIFEST_KEY);
    const oldManifest = oldManifestText ? JSON.parse(oldManifestText) : null;
    const oldChunkCount = oldManifest ? Number(oldManifest.chunkCount || 0) : 0;
    const payload = serializeDashboardSnapshot_(snapshot);
    const payloadBytes = Utilities.newBlob(payload, "text/plain").getBytes().length;
    if (payloadBytes > DASHBOARD_SNAPSHOT_DURABLE_MAX_BYTES) {
      throw new Error("Dashboard snapshot too large for ScriptProperties: " + payloadBytes + " bytes");
    }

    const chunkCount = Math.ceil(payload.length / DASHBOARD_SNAPSHOT_PROP_CHUNK_SIZE);
    const values = {};
    for (let i = 0; i < chunkCount; i++) {
      values[DASHBOARD_SNAPSHOT_PROP_CHUNK_PREFIX + i] = payload.substring(
        i * DASHBOARD_SNAPSHOT_PROP_CHUNK_SIZE,
        (i + 1) * DASHBOARD_SNAPSHOT_PROP_CHUNK_SIZE
      );
    }

    const manifest = {
      version: snapshot && snapshot.snapshotMeta ? snapshot.snapshotMeta.version : "",
      chunkCount: chunkCount,
      payloadBytes: payloadBytes,
      updatedAt: new Date().toISOString()
    };
    values[DASHBOARD_SNAPSHOT_PROP_MANIFEST_KEY] = JSON.stringify(manifest);
    values[DASHBOARD_SNAPSHOT_PROP_META_KEY] = JSON.stringify(snapshot && snapshot.snapshotMeta ? snapshot.snapshotMeta : {});
    props.setProperties(values);

    for (let c = chunkCount; c < oldChunkCount; c++) {
      props.deleteProperty(DASHBOARD_SNAPSHOT_PROP_CHUNK_PREFIX + c);
    }

    Logger.log("DASH_SNAPSHOT durable write ok | payloadBytes=" + payloadBytes + " | chunks=" + chunkCount);
    return { success: true, payloadBytes: payloadBytes, chunkCount: chunkCount };
  } catch (error) {
    Logger.log("DASH_SNAPSHOT durable write error: " + error);
    return { success: false, error: error.toString() };
  }
}

function writeDashboardSnapshotMetadata_(metadata) {
  try {
    PropertiesService.getScriptProperties().setProperty(
      DASHBOARD_SNAPSHOT_PROP_META_KEY,
      JSON.stringify(metadata || {})
    );
    return true;
  } catch (error) {
    Logger.log("DASH_SNAPSHOT metadata write error: " + error);
    return false;
  }
}

function refreshDashboardSnapshot_() {
  const startedAt = Date.now();
  const version = String(startedAt);
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    const lockMeta = {
      builtAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      version: version,
      success: false,
      error: "Dashboard snapshot refresh lock busy"
    };
    writeDashboardSnapshotMetadata_(lockMeta);
    Logger.log("DASH_SNAPSHOT refresh skipped lock busy | version=" + version);
    return { success: false, snapshotMeta: lockMeta };
  }

  try {
    const source = getDashboardOverviewSource_();
    const defaultDate = resolveDefaultDashboardOverviewDate_(source);
    const coreResponse = buildDashboardOverviewDateCore_(defaultDate.dateKey, source);
    const fullResponse = applyDashboardOverviewDateContext_(coreResponse, {
      userSelected: false,
      usedNearestDate: defaultDate.usedNearestDate
    });
    if (!fullResponse || fullResponse.success !== true) {
      throw new Error(fullResponse && fullResponse.error ? fullResponse.error : "Dashboard fresh build failed");
    }

    const snapshot = extractDashboardSnapshot_(fullResponse);
    snapshot.snapshotMeta = {
      builtAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      version: version,
      success: true,
      state: "ready",
      reportDate: snapshot.reportDate && snapshot.reportDate.date,
      error: ""
    };

    if (!isValidDashboardMinimalSnapshot_(snapshot)) {
      throw new Error("Dashboard snapshot contract validation failed");
    }

    const durableResult = writeDashboardSnapshot_(snapshot);
    if (!durableResult.success) {
      throw new Error(durableResult.error || "Dashboard snapshot durable write failed");
    }
    const cacheResult = writeDashboardSnapshotCache_(snapshot);
    const historicalResult = archiveDashboardHistoricalSnapshot_(snapshot);
    if (!historicalResult.success) {
      Logger.log(
        "DASH_HISTORY archive skipped after current refresh | reportDate=" +
        snapshot.reportDate.date + " | " + (historicalResult.error || "unknown error")
      );
    }

    Logger.log(
      "DASH_SNAPSHOT refresh ok | version=" + version +
      " | durationMs=" + snapshot.snapshotMeta.durationMs +
      " | cachePayloadBytes=" + (cacheResult.payloadBytes || 0) +
      " | durablePayloadBytes=" + durableResult.payloadBytes
    );

    return {
      success: true,
      snapshotMeta: snapshot.snapshotMeta,
      cache: cacheResult,
      durable: durableResult,
      historical: historicalResult
    };
  } catch (error) {
    const errorMeta = {
      builtAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      version: version,
      success: false,
      error: error && error.message ? error.message : error.toString()
    };
    writeDashboardSnapshotMetadata_(errorMeta);
    Logger.log("DASH_SNAPSHOT refresh error | version=" + version + " | " + errorMeta.error);
    return { success: false, snapshotMeta: errorMeta };
  } finally {
    try {
      lock.releaseLock();
    } catch (lockError) {
      Logger.log("DASH_SNAPSHOT lock release error: " + lockError);
    }
  }
}

// Maintenance/admin wrapper for Apps Script editor and clasp run.
function adminRefreshDashboardSnapshot() {
  Logger.log("DASH_SNAPSHOT admin refresh requested");
  return refreshDashboardSnapshot_();
}

// Maintenance/admin wrapper for Apps Script editor and clasp run. Does not build.
function adminReadDashboardSnapshot() {
  return readDashboardSnapshot_();
}

// Maintenance/admin wrapper for checking snapshot availability without building.
function adminGetDashboardSnapshotStatus() {
  try {
    const snapshot = readDashboardSnapshot_();
    const result = {
      success: true,
      hasSnapshot: !!snapshot,
      snapshotMeta: snapshot && snapshot.snapshotMeta ? snapshot.snapshotMeta : {},
      topLevelKeys: snapshot ? Object.keys(snapshot) : [],
      error: ""
    };
    return result;
  } catch (error) {
    const result = {
      success: false,
      hasSnapshot: false,
      snapshotMeta: {},
      topLevelKeys: [],
      error: error.toString()
    };
    return result;
  }
}

function formatDashboardDate_(value) {
  const parsed = parseDashboardDate(value);
  if (!parsed) return (value || "").toString().trim();

  let d = parsed.getDate().toString().padStart(2, "0");
  let m = (parsed.getMonth() + 1).toString().padStart(2, "0");
  let y = parsed.getFullYear();
  return d + "/" + m + "/" + y;
}

function formatDashboardDateTime_(value) {
  if (!value) return "";
  const parsed = value instanceof Date ? value : new Date(value);
  if (isNaN(parsed.getTime())) return value.toString().trim();

  let d = parsed.getDate().toString().padStart(2, "0");
  let m = (parsed.getMonth() + 1).toString().padStart(2, "0");
  let y = parsed.getFullYear();
  let h = parsed.getHours().toString().padStart(2, "0");
  let min = parsed.getMinutes().toString().padStart(2, "0");
  return d + "/" + m + "/" + y + " " + h + ":" + min;
}

function parseDailyReportDate_(dateText) {
  const text = (dateText || "").toString().trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const d = parseInt(match[3], 10);
    const parsed = new Date(y, m - 1, d);
    if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) return null;
    return parsed;
  }
  return parseDashboardDate(text);
}

function isSameDashboardDay_(left, right) {
  const leftDate = parseDashboardDate(left);
  const rightDate = parseDashboardDate(right);
  if (!leftDate || !rightDate) return false;

  return leftDate.getFullYear() === rightDate.getFullYear()
    && leftDate.getMonth() === rightDate.getMonth()
    && leftDate.getDate() === rightDate.getDate();
}

function parseMonthlyReportMonth_(monthText) {
  const text = (monthText || "").toString().trim();
  const match = text.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (m < 1 || m > 12) return null;
  return { year: y, monthIndex: m - 1 };
}

function isSameDashboardMonth_(value, monthInfo) {
  if (!value || !monthInfo) return false;

  const text = value.toString ? value.toString().trim() : "";
  let match = text.match(/^(\d{1,2})\/(\d{4})$/);
  if (match) {
    return parseInt(match[2], 10) === monthInfo.year
      && parseInt(match[1], 10) - 1 === monthInfo.monthIndex;
  }

  match = text.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (match) {
    return parseInt(match[1], 10) === monthInfo.year
      && parseInt(match[2], 10) - 1 === monthInfo.monthIndex;
  }

  const parsed = parseDashboardDate(value);
  if (!parsed) return false;
  return parsed.getFullYear() === monthInfo.year && parsed.getMonth() === monthInfo.monthIndex;
}

function formatDashboardMonth_(monthInfo) {
  return (monthInfo.monthIndex + 1).toString().padStart(2, "0") + "/" + monthInfo.year;
}

const DASHBOARD_MONTHLY_FINAL_CACHE_PREFIX = "dashboard:monthly-final:v1:";
const DASHBOARD_MONTHLY_FINAL_STALE_CACHE_PREFIX = "dashboard:monthly-final-stale:v1:";
const DASHBOARD_MONTHLY_FINAL_CACHE_TTL_SECONDS = 300;
const DASHBOARD_MONTHLY_FINAL_STALE_CACHE_TTL_SECONDS = 21600;
const DASHBOARD_MONTHLY_FINAL_CACHE_MAX_BYTES = 90 * 1024;

function getMonthlyReportCacheKey_(monthInfo) {
  return monthInfo.year + "-" + (monthInfo.monthIndex + 1).toString().padStart(2, "0");
}

function getCurrentMonthlyReportCacheKey_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM");
}

function getMonthlyReportFinalCacheSuffix_(monthKey) {
  return monthKey +
    ":data=" + getDashboardDataCacheVersion_() +
    ":plan=" + getDashboardPlanCacheVersion_();
}

function getMonthlyReportFinalCacheKey_(monthKey) {
  return DASHBOARD_MONTHLY_FINAL_CACHE_PREFIX + getMonthlyReportFinalCacheSuffix_(monthKey);
}

function getMonthlyReportFinalStaleCacheKey_(monthKey) {
  return DASHBOARD_MONTHLY_FINAL_STALE_CACHE_PREFIX + getMonthlyReportFinalCacheSuffix_(monthKey);
}

function parseMonthlyReportFinalCache_(payload) {
  if (!payload) return null;
  try {
    const response = JSON.parse(payload);
    return response && response.success === true ? response : null;
  } catch (error) {
    return null;
  }
}

function readMonthlyReportFinalCache_(monthKey) {
  try {
    const cache = CacheService.getScriptCache();
    const fresh = parseMonthlyReportFinalCache_(cache.get(getMonthlyReportFinalCacheKey_(monthKey)));
    if (fresh) {
      Logger.log("MONTHLY_CACHE | key=" + monthKey + " | status=fresh_hit");
      return fresh;
    }

  } catch (error) {
    // CacheService is best effort; a read failure falls through to the existing build path.
  }

  Logger.log("MONTHLY_CACHE | key=" + monthKey + " | status=miss");
  return null;
}

function writeMonthlyReportFinalCaches_(monthKey, response) {
  const result = { freshWritten: false, staleWritten: false };
  let payload;
  try {
    payload = JSON.stringify(response);
    const payloadBytes = Utilities.newBlob(payload, "text/plain").getBytes().length;
    if (payloadBytes > DASHBOARD_MONTHLY_FINAL_CACHE_MAX_BYTES) return result;
  } catch (error) {
    return result;
  }

  let cache;
  try {
    cache = CacheService.getScriptCache();
  } catch (error) {
    return result;
  }
  try {
    cache.put(
      getMonthlyReportFinalCacheKey_(monthKey),
      payload,
      DASHBOARD_MONTHLY_FINAL_CACHE_TTL_SECONDS
    );
    result.freshWritten = true;
  } catch (error) {
    result.freshWritten = false;
  }

  try {
    cache.put(
      getMonthlyReportFinalStaleCacheKey_(monthKey),
      payload,
      DASHBOARD_MONTHLY_FINAL_STALE_CACHE_TTL_SECONDS
    );
    result.staleWritten = true;
  } catch (error) {
    result.staleWritten = false;
  }

  return result;
}

function getDailyStatusGroup_(transaction) {
  return getTransactionDashboardStatusKey_(Object.assign({}, transaction), "", null);
}

function summarizeDailyList_(items, field) {
  const summary = {};
  for (let item of items) {
    let key = item[field] || "Khác";
    if (!summary[key]) summary[key] = 0;
    summary[key]++;
  }
  return Object.keys(summary).map(k => ({ name: k, count: summary[k] })).sort((a, b) => b.count - a.count);
}

function summarizeMonthlyQtyList_(items, field) {
  const summary = {};
  for (let item of items) {
    let key = item[field] || "Khác";
    if (!summary[key]) summary[key] = 0;
    summary[key] += Number(item.qty || 0);
  }
  return Object.keys(summary).map(k => ({ name: k, count: summary[k] })).sort((a, b) => b.count - a.count);
}

function getDailyReportData(dateText) {
  try {
    const isFilterRequest = dateText && typeof dateText === "object" && !(dateText instanceof Date);
    const filters = isFilterRequest ? dateText : {};
    const reportDate = parseDailyReportDate_(isFilterRequest ? filters.date : dateText);
    if (!reportDate) {
      return { success: false, error: "Ngày báo cáo không hợp lệ." };
    }

    const transactions = getRawTransactions();
    const dailyTransactions = transactions.filter(txn => isSameDashboardDay_(txn.date, reportDate));
    const shiftFilter = isFilterRequest ? (filters.shift || "").toString().trim() : "";
    const processFilter = isFilterRequest ? (filters.process || "").toString().trim() : "";
    const statusFilter = isFilterRequest ? (filters.status || "").toString().trim() : "";

    dailyTransactions.sort((a, b) => {
      let timeA = getDashboardTime_(a.receiveTime);
      let timeB = getDashboardTime_(b.receiveTime);
      if (timeA !== timeB) return timeB - timeA;

      let idA = (a.id || "").toString();
      let idB = (b.id || "").toString();
      return idB.localeCompare(idA);
    });

    const pipeMap = {};
    let totalQty = 0;
    let okCount = 0;
    let repairOrRejectCount = 0;
    const latestByPipe = {};
    const optionShifts = {};
    const optionProcesses = {};
    const optionStatuses = {};

    const rows = dailyTransactions.filter(txn => {
      if (txn.shift) optionShifts[txn.shift] = true;
      if (txn.process) optionProcesses[txn.process] = true;
      if (txn.status) optionStatuses[txn.status] = true;
      if (shiftFilter && (txn.shift || "").toString().trim() !== shiftFilter) return false;
      if (processFilter && (txn.process || "").toString().trim() !== processFilter) return false;
      if (statusFilter && (txn.status || "").toString().trim() !== statusFilter) return false;
      return true;
    }).map(txn => {
      if (txn.pipeNo) pipeMap[txn.pipeNo] = true;
      totalQty += Number(txn.qty || 0);

      const statusText = normalizeString(txn.status);
      const statusGroup = getDailyStatusGroup_(txn);
      if (statusGroup === "tp" || statusText === "ok" || statusText.includes("dat")) okCount++;
      if (statusGroup === "cs" || statusGroup === "hong") repairOrRejectCount++;

      const row = {
        date: formatDashboardDate_(txn.date),
        time: txn.receiveTime instanceof Date && !isNaN(txn.receiveTime.getTime())
          ? Utilities.formatDate(txn.receiveTime, Session.getScriptTimeZone(), "HH:mm:ss")
          : (txn.receiveTime || "").toString().trim(),
        receiveTime: formatDashboardDateTime_(txn.receiveTime),
        shift: txn.shift,
        process: txn.process,
        pipeNo: txn.pipeNo,
        qty: txn.qty,
        size: txn.size,
        status: txn.status,
        statusGroup: statusGroup,
        statusKey: statusGroup,
        statusLabel: _dailyReportStatusLabel_(statusGroup),
        defectReason: txn.defectReason,
        bundleCode: txn.bundleCode,
        compartment: txn.compartment,
        well: txn.well,
        rig: txn.rig,
        worker1: txn.worker1,
        worker2: txn.worker2,
        notes: txn.notes,
        rowIdx: txn.rowIdx
      };
      if (row.pipeNo) {
        const previous = latestByPipe[row.pipeNo];
        if (!previous || Number(row.rowIdx || 0) > Number(previous.rowIdx || 0)) {
          latestByPipe[row.pipeNo] = row;
        }
      }
      return row;
    });

    if (isFilterRequest) {
      const dateKey = Utilities.formatDate(reportDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
      return {
        success: true,
        date: dateKey,
        generatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"),
        filters: {
          date: dateKey,
          shift: shiftFilter,
          process: processFilter,
          status: statusFilter
        },
        options: {
          shifts: Object.keys(optionShifts).sort((left, right) => left.localeCompare(right)),
          processes: Object.keys(optionProcesses).sort((left, right) => left.localeCompare(right)),
          statuses: Object.keys(optionStatuses).sort((left, right) => left.localeCompare(right))
        },
        summary: buildDailyReportModuleSummary_(rows, latestByPipe),
        rows: rows
      };
    }

    return {
      success: true,
      date: formatDashboardDate_(reportDate),
      dateText: dateText,
      kpi: {
        transactions: dailyTransactions.length,
        pipes: Object.keys(pipeMap).length,
        qty: totalQty,
        ok: okCount,
        repairOrReject: repairOrRejectCount
      },
      processStats: summarizeDailyList_(dailyTransactions, "process"),
      shiftStats: summarizeDailyList_(dailyTransactions, "shift"),
      rows: rows
    };
  } catch (e) {
    return { success: false, error: e.toString(), stack: e.stack };
  }
}
function buildDailyReportModuleSummary_(rows, latestByPipe) {
  const summary = {
    totalPipes: Object.keys(latestByPipe || {}).length,
    totalRows: rows.length,
    thanhPham: 0,
    choSua: 0,
    hong: 0
  };

  Object.keys(latestByPipe || {}).forEach(function(pipeNo) {
    const row = latestByPipe[pipeNo];
    if (row.statusKey === "tp") summary.thanhPham++;
    if (row.statusKey === "cs") summary.choSua++;
    if (row.statusKey === "hong") summary.hong++;
  });
  return summary;
}
function getMonthlyReportDateLiteral_(date) {
  return date.getFullYear() + "-" +
    (date.getMonth() + 1).toString().padStart(2, "0") + "-" +
    date.getDate().toString().padStart(2, "0");
}

function getMonthlyReportBounds_(monthInfo) {
  const start = new Date(monthInfo.year, monthInfo.monthIndex, 1);
  const end = new Date(monthInfo.year, monthInfo.monthIndex + 1, 1);
  return {
    start: start,
    end: end,
    startLiteral: getMonthlyReportDateLiteral_(start),
    endLiteral: getMonthlyReportDateLiteral_(end)
  };
}

function buildMonthlyReportQueryRequest_(sheetName, query, reqId) {
  return {
    url: "https://docs.google.com/spreadsheets/d/" + SPREADSHEET_ID + "/gviz/tq?sheet=" +
      encodeURIComponent(sheetName) +
      "&tqx=" + encodeURIComponent("out:json;reqId:" + reqId) +
      "&tq=" + encodeURIComponent(query),
    muteHttpExceptions: true,
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken(),
      "Cache-Control": "no-cache"
    }
  };
}

function parseMonthlyReportQueryResponse_(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Invalid Sheets query response");
  const payload = JSON.parse(text.substring(start, end + 1));
  if (payload.status && payload.status !== "ok") {
    throw new Error("Sheets query failed: " + JSON.stringify(payload.errors || payload.status));
  }
  return payload.table && Array.isArray(payload.table.rows) ? payload.table.rows : [];
}

function getMonthlyReportQueryCellValue_(cell) {
  if (!cell) return null;
  let value = cell.v !== undefined && cell.v !== null ? cell.v : cell.f;
  if (typeof value === "string") {
    const match = value.match(/^Date\((\d+),(\d+),(\d+)\)$/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]), Number(match[3]));
    }
  }
  return value;
}

function readMonthlyReportSourcesViaQuery_(monthInfo) {
  const bounds = getMonthlyReportBounds_(monthInfo);
  const reqId = Date.now();
  const dataQuery = "select A,C,D,E,L where A >= date '" + bounds.startLiteral +
    "' and A < date '" + bounds.endLiteral + "'";
  const planQuery = "select A,B,C where A >= date '" + bounds.startLiteral +
    "' and A < date '" + bounds.endLiteral + "'";
  const responses = UrlFetchApp.fetchAll([
    buildMonthlyReportQueryRequest_(SHEET_DATA, dataQuery, reqId + ":data"),
    buildMonthlyReportQueryRequest_(SHEET_PLAN, planQuery, reqId + ":plan")
  ]);

  const dataResponse = responses[0];
  const planResponse = responses[1];
  if (dataResponse.getResponseCode() >= 400) {
    throw new Error("Data query HTTP " + dataResponse.getResponseCode());
  }
  if (planResponse.getResponseCode() >= 400) {
    throw new Error("Plan query HTTP " + planResponse.getResponseCode());
  }

  const dataRows = parseMonthlyReportQueryResponse_(dataResponse.getContentText());
  const planRows = parseMonthlyReportQueryResponse_(planResponse.getContentText());
  const transactions = dataRows.map(function(row) {
    const cells = row.c || [];
    const dateVal = getMonthlyReportQueryCellValue_(cells[0]);
    const process = (getMonthlyReportQueryCellValue_(cells[1]) || "").toString().trim();
    const qty = parseFloat(getMonthlyReportQueryCellValue_(cells[2])) || 1;
    const pipeNo = (getMonthlyReportQueryCellValue_(cells[3]) || "").toString().trim();
    const size = (getMonthlyReportQueryCellValue_(cells[4]) || "").toString().trim();
    return {
      date: dateVal,
      process: process,
      qty: qty,
      pipeNo: pipeNo,
      size: size
    };
  }).filter(function(txn) {
    return txn.date || txn.process || txn.pipeNo || txn.size;
  });

  const plans = planRows.map(function(row) {
    const cells = row.c || [];
    const dateVal = getMonthlyReportQueryCellValue_(cells[0]);
    const size = (getMonthlyReportQueryCellValue_(cells[1]) || "").toString().trim();
    const qty = parseFloat(getMonthlyReportQueryCellValue_(cells[2])) || 0;
    return {
      date: dateVal instanceof Date ? formatDashboardDate_(dateVal) : (dateVal || "").toString().trim(),
      month: dateVal instanceof Date ? ((dateVal.getMonth() + 1) + "/" + dateVal.getFullYear()) : (dateVal || "").toString().trim(),
      size: size,
      qty: qty
    };
  }).filter(function(plan) {
    return plan.date && Number(plan.qty || 0) !== 0;
  });

  return { transactions: transactions, plans: plans };
}
function getMonthlyReportData(monthText, bypassFinalCache, cacheWriteSummary) {
  const totalStartedAt = performanceTimerStart_();
  try {
    const parseStartedAt = performanceTimerStart_();
    const reportMonth = parseMonthlyReportMonth_(monthText);
    performanceLog_("getMonthlyReportData", "parse_month", parseStartedAt, { success: !!reportMonth });
    if (!reportMonth) {
      performanceLog_("getMonthlyReportData", "total", totalStartedAt, { success: false, errorCount: 1 });
      return { success: false, error: "Tháng báo cáo không hợp lệ." };
    }

    const monthKey = getMonthlyReportCacheKey_(reportMonth);
    if (!bypassFinalCache) {
      const cachedResponse = readMonthlyReportFinalCache_(monthKey);
      if (cachedResponse) {
        performanceLog_("getMonthlyReportData", "total", totalStartedAt, {
          success: true,
          cache: "hit",
          rowCount: cachedResponse.kpi ? cachedResponse.kpi.transactions : 0,
          sizeCount: Array.isArray(cachedResponse.sizeStats) ? cachedResponse.sizeStats.length : 0
        });
        return cachedResponse;
      }
    }

    const sourceReadStartedAt = performanceTimerStart_();
    const monthlySources = readMonthlyReportSourcesViaQuery_(reportMonth);
    const monthlyTransactions = monthlySources.transactions.filter(txn => isSameDashboardMonth_(txn.date, reportMonth));
    const plans = monthlySources.plans.filter(plan => {
      return isSameDashboardMonth_(plan.month, reportMonth) || isSameDashboardMonth_(plan.date, reportMonth);
    });
    performanceLog_("getMonthlyReportData", "read_month_sources", sourceReadStartedAt, {
      rowCount: monthlyTransactions.length,
      sizeCount: plans.length
    });
    const aggregationStartedAt = performanceTimerStart_();
    const pipeMap = {};
    let totalQty = 0;
    for (let txn of monthlyTransactions) {
      if (txn.pipeNo) pipeMap[txn.pipeNo] = true;
      totalQty += Number(txn.qty || 0);
    }

    let planQty = 0;
    const planRows = plans.map(plan => {
      planQty += Number(plan.qty || 0);
      return {
        date: plan.date,
        size: plan.size || "Khác",
        qty: Number(plan.qty || 0)
      };
    });

    const response = {
      success: true,
      month: formatDashboardMonth_(reportMonth),
      monthText: monthText,
      kpi: {
        transactions: monthlyTransactions.length,
        pipes: Object.keys(pipeMap).length,
        qty: totalQty,
        plan: planQty,
        generatedPipes: Object.keys(pipeMap).length
      },
      processStats: summarizeDailyList_(monthlyTransactions, "process"),
      sizeStats: summarizeMonthlyQtyList_(monthlyTransactions, "size"),
      planRows: planRows
    };
    const cacheWrite = writeMonthlyReportFinalCaches_(monthKey, response);
    if (cacheWriteSummary && typeof cacheWriteSummary === "object") {
      cacheWriteSummary.freshWritten = cacheWrite.freshWritten;
      cacheWriteSummary.staleWritten = cacheWrite.staleWritten;
    }
    performanceLog_("getMonthlyReportData", "aggregate", aggregationStartedAt, {
      success: true,
      rowCount: monthlyTransactions.length,
      sizeCount: response.sizeStats.length
    });
    performanceLog_("getMonthlyReportData", "total", totalStartedAt, {
      success: true,
      rowCount: monthlyTransactions.length,
      sizeCount: response.sizeStats.length
    });
    return response;
  } catch (e) {
    performanceLog_("getMonthlyReportData", "total", totalStartedAt, { success: false, errorCount: 1 });
    return { success: false, error: e.toString(), stack: e.stack };
  }
}

function getErrorAnalysisData() {
  try {
    function sanitizeErrorAnalysisDates_(value) {
      if (value === null || value === undefined) return value;
      if (value instanceof Date) {
        return formatDashboardDateTime_(value);
      }
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          value[i] = sanitizeErrorAnalysisDates_(value[i]);
        }
      } else if (typeof value === "object") {
        for (let key in value) {
          if (value.hasOwnProperty(key)) {
            value[key] = sanitizeErrorAnalysisDates_(value[key]);
          }
        }
      }
      return value;
    }

    const pipes = buildPipeEngine();
    const analysis = buildErrorAnalysis(pipes);
    const errorPipes = [];

    for (let i = 0; i < pipes.length; i++) {
      const error = classifyError(pipes[i]);
      if (error.code !== "NONE") {
        errorPipes.push({ pipe: pipes[i], error: error });
      }
    }

    let loaiCount = 0;
    let choSuaCount = 0;

    const rows = errorPipes.map(item => {
      const pipe = item.pipe;
      const error = item.error;

      if (isBusinessScrapState_(pipe.currentBusinessStatus)) loaiCount++;
      if (isBusinessRepairState_(pipe.currentBusinessStatus)) choSuaCount++;

      return {
        pipeNo: pipe.pipeNo,
        size: pipe.size || "Khác",
        rig: pipe.rig || "Khác",
        businessStatus: pipe.currentBusinessStatus,
        statusGroup: getPipeDashboardStatusKey_(pipe),
        process: pipe.currentProcess || "Khác",
        reason: error.label,
        error: error,
        errorCode: error.code,
        errorSource: error.source,
        errorRaw: error.raw
      };
    });

    const response = {
      success: true,
      summary: analysis.summary,
      byError: analysis.byError,
      samples: analysis.samples,
      kpi: {
        total: rows.length,
        loai: loaiCount,
        choSua: choSuaCount,
        reasons: analysis.byError.length
      },
      reasonStats: analysis.byError.map(item => ({
        name: item.label,
        count: item.count,
        code: item.code,
        rate: item.rate
      })),
      processStats: summarizeDailyList_(rows, "process"),
      sizeStats: summarizeDailyList_(rows, "size"),
      rigStats: summarizeDailyList_(rows, "rig"),
      rows: rows
    };

    return sanitizeErrorAnalysisDates_(response);
  } catch (e) {
    return { success: false, error: e.toString(), stack: e.stack };
  }
}
/**
 * Sprint 1.0 - Data Source Validator
 * Hàm kiểm tra và chuẩn hóa dữ liệu từ Google Sheet (Data Validator)
 */
function writePipeEngineDebugToSheet() {
  const data = debugPipeEngine();
  const ss = getSpreadsheet();
  if (!ss) return;

  let sheet = ss.getSheetByName("DEBUG");
  if (!sheet) {
    sheet = ss.insertSheet("DEBUG");
  } else {
    sheet.clear();
  }

  sheet.getRange("A1").setValue("totalTransactions");
  sheet.getRange("B1").setValue(data.totalTransactions);
  sheet.getRange("A2").setValue("totalPipes");
  sheet.getRange("B2").setValue(data.totalPipes);

  sheet.getRange("A4").setValue("statusSummary");
  let statusArr = [];
  for (let status in data.statusSummary) {
    statusArr.push([status, data.statusSummary[status]]);
  }
  if (statusArr.length > 0) {
    sheet.getRange(5, 1, statusArr.length, 2).setValues(statusArr);
  }

  sheet.getRange("D4").setValue("processQueueSummary");
  let processArr = [];
  for (let process in data.processQueueSummary) {
    processArr.push([process, data.processQueueSummary[process]]);
  }
  if (processArr.length > 0) {
    sheet.getRange(5, 4, processArr.length, 2).setValues(processArr);
  }

  sheet.getRange("G4").setValue("samplePipes");
  let pipeArr = [["pipeNo", "currentProcess", "currentBusinessStatus", "currentReason"]];
  if (data.samplePipes && data.samplePipes.length > 0) {
    for (let pipe of data.samplePipes) {
      pipeArr.push([
        pipe.pipeNo || "",
        pipe.currentProcess || "",
        pipe.currentBusinessStatus || "",
        pipe.currentReason || ""
      ]);
    }
  }
  sheet.getRange(5, 7, pipeArr.length, 4).setValues(pipeArr);
}

/**
 * Sprint 6.1 - Data Validation
 * So sánh trạng thái Dashboard (Rule Engine) và Google Sheet (Naive cuối cùng)
 */
function validateDashboardData() {
  Logger.log("--- BẮT ĐẦU VALIDATE DỮ LIỆU SPRINT 6.1 ---");

  // 1. Lấy dữ liệu Dashboard
  const dashboardPipes = buildPipeEngine();
  let dbTotal = dashboardPipes.length;
  let dbTp = 0, dbLoai = 0, dbCs = 0, dbDxl = 0;

  const dashboardMap = {};
  for (let p of dashboardPipes) {
    dashboardMap[p.pipeNo] = p;
    let statusKey = getPipeDashboardStatusKey_(p);
    if (statusKey === "tp") dbTp++;
    else if (statusKey === "hong") dbLoai++;
    else if (statusKey === "cs") dbCs++;
    else if (statusKey === "dxl") dbDxl++;
  }

  // 2. Lấy dữ liệu Google Sheet (Naive)
  const txns = getRawTransactions();
  const sheetMap = {};

  for (let txn of txns) {
    let pNo = txn.pipeNo;
    if (!pNo) continue;
    if (!sheetMap[pNo]) {
      sheetMap[pNo] = [];
    }
    sheetMap[pNo].push(txn);
  }

  let shTotal = Object.keys(sheetMap).length;
  let shTp = 0, shLoai = 0, shCs = 0, shDxl = 0;
  const sheetFinalStatusMap = {};

  for (let pNo in sheetMap) {
    let history = sheetMap[pNo];

    // Sort transactions identically to find the exact last row in sheet
    history.sort((a, b) => {
      let dateA = getDashboardTime_(a.date);
      let dateB = getDashboardTime_(b.date);
      if (dateA !== dateB) return dateA - dateB;

      let timeA = getDashboardTime_(a.receiveTime);
      let timeB = getDashboardTime_(b.receiveTime);
      if (timeA !== timeB) return timeA - timeB;

      let idA = (a.id || "").toString();
      let idB = (b.id || "").toString();
      return idA.localeCompare(idB);
    });

    let lastTxn = history[history.length - 1];

    // Phân loại Naive (Dựa trên dòng cuối cùng của Google Sheet, không có Rule Engine & History)
    let sheetStatus = classifyBusinessStatus(lastTxn, "", null);

    sheetFinalStatusMap[pNo] = {
      sheetStatus: sheetStatus
    };

    let sheetStatusKey = getBusinessStatusGroupKey_(sheetStatus, getBusinessProcessState_(sheetStatus));
    if (sheetStatusKey === "tp") shTp++;
    else if (sheetStatusKey === "hong") shLoai++;
    else if (sheetStatusKey === "cs") shCs++;
    else if (sheetStatusKey === "dxl") shDxl++;
  }

  Logger.log("So sánh:");
  Logger.log("1. Tổng số Pipe: Dashboard (" + dbTotal + ") vs Sheet (" + shTotal + ")");
  Logger.log("2. Thành phẩm: Dashboard (" + dbTp + ") vs Sheet (" + shTp + ")");
  Logger.log("3. Loại: Dashboard (" + dbLoai + ") vs Sheet (" + shLoai + ")");
  Logger.log("4. Chờ sửa: Dashboard (" + dbCs + ") vs Sheet (" + shCs + ")");
  Logger.log("5. Đang xử lý: Dashboard (" + dbDxl + ") vs Sheet (" + shDxl + ")");

  let mismatchCount = 0;
  for (let pNo in dashboardMap) {
    let dbPipe = dashboardMap[pNo];
    let shData = sheetFinalStatusMap[pNo];
    if (!shData) continue;

    if (dbPipe.currentBusinessStatus !== shData.sheetStatus) {
      mismatchCount++;
    }
  }
  Logger.log("VALIDATE_DASHBOARD | success=true | rowCount=" + dbTotal + " | errorCount=" + mismatchCount);
}
