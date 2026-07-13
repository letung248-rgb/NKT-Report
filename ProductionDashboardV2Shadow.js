const PRODUCTION_DASHBOARD_V2_DAILY_PLAN_SHEET = "PLAN_DAILY_V2";
const PRODUCTION_DASHBOARD_V2_MONTHLY_PLAN_SHEET = "PLAN_MONTHLY_V2";
const PRODUCTION_DASHBOARD_V2_TIME_ZONE = "Asia/Ho_Chi_Minh";
const PRODUCTION_DASHBOARD_V2_PLAN_CACHE_PREFIX = "dashboard:v2:plan-validation:v1:";
const PRODUCTION_DASHBOARD_V2_PLAN_CACHE_TTL_SECONDS = 300;
const PRODUCTION_DASHBOARD_V2_PLAN_HEADERS = {
  daily: ["PlanDate", "CheckedPlan", "FinishedPlan", "PlanVersion", "Status", "UpdatedAt", "UpdatedBy", "Note"],
  monthly: ["PlanMonth", "CheckedPlan", "FinishedPlan", "PlanVersion", "Status", "UpdatedAt", "UpdatedBy", "Note", "WorkingDays"]
};

// Explicit admin-only initializer. The read-only shadow API never calls this function.
function adminSetupProductionDashboardV2PlanSheets() {
  const ss = getSpreadsheet();
  if (!ss) throw new Error("Spreadsheet is unavailable.");

  const now = new Date();
  const dayKey = Utilities.formatDate(now, PRODUCTION_DASHBOARD_V2_TIME_ZONE, "yyyy-MM-dd");
  const monthKey = Utilities.formatDate(now, PRODUCTION_DASHBOARD_V2_TIME_ZONE, "yyyy-MM");
  const planVersion = "AUTO-" + dayKey;
  const updatedBy = Session.getEffectiveUser().getEmail() || "SYSTEM";

  const definitions = [
    {
      name: PRODUCTION_DASHBOARD_V2_DAILY_PLAN_SHEET,
      headers: PRODUCTION_DASHBOARD_V2_PLAN_HEADERS.daily,
      periodType: "daily",
      periodKey: dayKey,
      seedRow: [dayKey, 0, 0, planVersion, "ACTIVE", now, updatedBy, "Auto-seeded with zero targets"]
    },
    {
      name: PRODUCTION_DASHBOARD_V2_MONTHLY_PLAN_SHEET,
      headers: PRODUCTION_DASHBOARD_V2_PLAN_HEADERS.monthly,
      periodType: "monthly",
      periodKey: monthKey,
      seedRow: [monthKey, 0, 0, planVersion, "ACTIVE", now, updatedBy, "Auto-seeded with zero targets", ""]
    }
  ];

  const result = [];
  for (let i = 0; i < definitions.length; i++) {
    const definition = definitions[i];
    let sheet = ss.getSheetByName(definition.name);
    let created = false;

    if (!sheet) {
      sheet = ss.insertSheet(definition.name);
      created = true;
    }

    let headerWritten = false;
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, definition.headers.length).setValues([definition.headers]);
      headerWritten = true;
    }

    const values = sheet.getDataRange().getValues();
    let hasCurrentActivePlan = false;
    for (let r = 1; r < values.length; r++) {
      const periodKey = definition.periodType === "daily"
        ? productionDashboardV2DateKey_(values[r][0])
        : productionDashboardV2MonthKey_(values[r][0]);
      const status = (values[r][4] || "").toString().trim().toUpperCase();
      if (periodKey === definition.periodKey && status === "ACTIVE") {
        hasCurrentActivePlan = true;
        break;
      }
    }

    let seeded = false;
    if (!hasCurrentActivePlan) {
      sheet.appendRow(definition.seedRow);
      seeded = true;
    }

    result.push({
      sheetName: definition.name,
      created: created,
      headerWritten: headerWritten,
      seeded: seeded
    });
  }

  invalidateProductionDashboardV2PlanCache_(now);
  return { success: true, sheets: result };
}

function productionDashboardV2PlanCacheKey_(dayKey, monthKey) {
  return PRODUCTION_DASHBOARD_V2_PLAN_CACHE_PREFIX + dayKey + ":" + monthKey;
}

function isProductionDashboardV2PlanSheetResult_(value) {
  return !!value &&
    typeof value === "object" &&
    typeof value.sheetName === "string" &&
    typeof value.exists === "boolean" &&
    typeof value.valid === "boolean" &&
    Array.isArray(value.errors) &&
    Array.isArray(value.warnings);
}

function isProductionDashboardV2PlanValidationResult_(value) {
  return !!value &&
    typeof value === "object" &&
    typeof value.valid === "boolean" &&
    typeof value.planVersion === "string" &&
    isProductionDashboardV2PlanSheetResult_(value.daily) &&
    isProductionDashboardV2PlanSheetResult_(value.monthly) &&
    Array.isArray(value.errors) &&
    Array.isArray(value.warnings);
}

function readProductionDashboardV2PlanCache_(dayKey, monthKey) {
  const cacheKey = productionDashboardV2PlanCacheKey_(dayKey, monthKey);
  try {
    const payload = CacheService.getScriptCache().get(cacheKey);
    if (payload === null) {
      Logger.log("DASH_V2_TIMING stage=plan_validation_cache status=miss");
      return null;
    }
    const cached = JSON.parse(payload);
    if (!isProductionDashboardV2PlanValidationResult_(cached)) {
      CacheService.getScriptCache().remove(cacheKey);
      Logger.log("DASH_V2_TIMING stage=plan_validation_cache status=invalid");
      return null;
    }
    Logger.log("DASH_V2_TIMING stage=plan_validation_cache status=hit");
    return cached;
  } catch (error) {
    Logger.log("DASH_V2_TIMING stage=plan_validation_cache status=error error=" + error);
    return null;
  }
}

function writeProductionDashboardV2PlanCache_(dayKey, monthKey, value) {
  try {
    CacheService.getScriptCache().put(
      productionDashboardV2PlanCacheKey_(dayKey, monthKey),
      JSON.stringify(value),
      PRODUCTION_DASHBOARD_V2_PLAN_CACHE_TTL_SECONDS
    );
    Logger.log("DASH_V2_TIMING stage=plan_validation_cache status=write");
  } catch (error) {
    Logger.log("DASH_V2_TIMING stage=plan_validation_cache status=write_error error=" + error);
  }
}

function invalidateProductionDashboardV2PlanCache_(asOf) {
  try {
    const dayKey = Utilities.formatDate(asOf, PRODUCTION_DASHBOARD_V2_TIME_ZONE, "yyyy-MM-dd");
    const monthKey = Utilities.formatDate(asOf, PRODUCTION_DASHBOARD_V2_TIME_ZONE, "yyyy-MM");
    CacheService.getScriptCache().remove(productionDashboardV2PlanCacheKey_(dayKey, monthKey));
  } catch (error) {
    Logger.log("DASH_V2 plan cache invalidate error: " + error);
  }
}

function productionDashboardV2HeaderKey_(value) {
  return normalizeString(value).replace(/[^a-z0-9]/g, "");
}

function productionDashboardV2DateKey_(value) {
  const parsed = parseDashboardDate(value);
  if (!parsed) return "";
  return Utilities.formatDate(parsed, PRODUCTION_DASHBOARD_V2_TIME_ZONE, "yyyy-MM-dd");
}

function productionDashboardV2MonthKey_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, PRODUCTION_DASHBOARD_V2_TIME_ZONE, "yyyy-MM");
  }

  const text = (value || "").toString().trim();
  let match = text.match(/^(\d{4})-(\d{1,2})$/);
  if (match) {
    const month = Number(match[2]);
    return month >= 1 && month <= 12 ? match[1] + "-" + String(month).padStart(2, "0") : "";
  }

  match = text.match(/^(\d{1,2})\/(\d{4})$/);
  if (match) {
    const month = Number(match[1]);
    return month >= 1 && month <= 12 ? match[2] + "-" + String(month).padStart(2, "0") : "";
  }

  return "";
}

function productionDashboardV2PlanNumber_(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && Math.floor(number) === number ? number : null;
}

function readProductionDashboardV2PlanSheet_(sheetName, periodType, currentPeriodKey) {
  const result = {
    sheetName: sheetName,
    exists: false,
    valid: false,
    rowCount: 0,
    activeRowCount: 0,
    currentPlan: null,
    errors: [],
    warnings: []
  };

  const ss = getSpreadsheet();
  const sheet = ss && ss.getSheetByName(sheetName);
  if (!sheet) {
    result.errors.push("Missing sheet: " + sheetName);
    return result;
  }
  result.exists = true;

  const values = sheet.getDataRange().getValues();
  if (!values || values.length === 0 || sheet.getLastRow() === 0) {
    result.errors.push("Sheet has no header: " + sheetName);
    return result;
  }

  const requiredHeaders = periodType === "daily"
    ? PRODUCTION_DASHBOARD_V2_PLAN_HEADERS.daily
    : PRODUCTION_DASHBOARD_V2_PLAN_HEADERS.monthly;
  const headerMap = {};
  for (let c = 0; c < values[0].length; c++) {
    const key = productionDashboardV2HeaderKey_(values[0][c]);
    if (key) headerMap[key] = c;
  }

  const missingHeaders = [];
  for (let h = 0; h < requiredHeaders.length; h++) {
    const requiredKey = productionDashboardV2HeaderKey_(requiredHeaders[h]);
    const isOptionalWorkingDays = periodType === "monthly" && requiredHeaders[h] === "WorkingDays";
    if (headerMap[requiredKey] === undefined && !isOptionalWorkingDays) missingHeaders.push(requiredHeaders[h]);
  }
  if (missingHeaders.length > 0) {
    result.errors.push("Missing headers in " + sheetName + ": " + missingHeaders.join(", "));
    return result;
  }

  const periodHeader = periodType === "daily" ? "PlanDate" : "PlanMonth";
  const periodIndex = headerMap[productionDashboardV2HeaderKey_(periodHeader)];
  const checkedIndex = headerMap[productionDashboardV2HeaderKey_("CheckedPlan")];
  const finishedIndex = headerMap[productionDashboardV2HeaderKey_("FinishedPlan")];
  const versionIndex = headerMap[productionDashboardV2HeaderKey_("PlanVersion")];
  const statusIndex = headerMap[productionDashboardV2HeaderKey_("Status")];
  const updatedAtIndex = headerMap[productionDashboardV2HeaderKey_("UpdatedAt")];
  const updatedByIndex = headerMap[productionDashboardV2HeaderKey_("UpdatedBy")];
  const workingDaysIndex = periodType === "monthly"
    ? headerMap[productionDashboardV2HeaderKey_("WorkingDays")]
    : undefined;
  const activeByPeriod = {};

  for (let r = 1; r < values.length; r++) {
    const row = values[r] || [];
    const hasData = row.some(function(value) {
      return value !== "" && value !== null && value !== undefined;
    });
    if (!hasData) continue;

    result.rowCount++;
    const rowNumber = r + 1;
    const periodKey = periodType === "daily"
      ? productionDashboardV2DateKey_(row[periodIndex])
      : productionDashboardV2MonthKey_(row[periodIndex]);
    const checkedPlan = productionDashboardV2PlanNumber_(row[checkedIndex]);
    const finishedPlan = productionDashboardV2PlanNumber_(row[finishedIndex]);
    const planVersion = (row[versionIndex] || "").toString().trim();
    const status = (row[statusIndex] || "").toString().trim().toUpperCase();
    const updatedAt = parseDashboardDate(row[updatedAtIndex]);
    const updatedBy = (row[updatedByIndex] || "").toString().trim();
    const rawWorkingDays = workingDaysIndex === undefined ? "" : row[workingDaysIndex];
    const workingDaysProvided = rawWorkingDays !== "" && rawWorkingDays !== null && rawWorkingDays !== undefined;
    const workingDaysNumber = workingDaysProvided ? Number(rawWorkingDays) : null;
    const workingDays = workingDaysProvided && Number.isFinite(workingDaysNumber) && workingDaysNumber > 0
      ? workingDaysNumber
      : null;

    if (!periodKey) result.errors.push(sheetName + " row " + rowNumber + ": invalid " + periodHeader);
    if (checkedPlan === null) result.errors.push(sheetName + " row " + rowNumber + ": CheckedPlan must be a non-negative integer");
    if (finishedPlan === null) result.errors.push(sheetName + " row " + rowNumber + ": FinishedPlan must be a non-negative integer");
    if (!planVersion) result.errors.push(sheetName + " row " + rowNumber + ": PlanVersion is required");
    if (["DRAFT", "ACTIVE", "SUPERSEDED"].indexOf(status) === -1) {
      result.errors.push(sheetName + " row " + rowNumber + ": invalid Status");
    }
    if (!updatedAt) result.errors.push(sheetName + " row " + rowNumber + ": UpdatedAt is required");
    if (!updatedBy) result.errors.push(sheetName + " row " + rowNumber + ": UpdatedBy is required");
    if (periodType === "monthly" && workingDaysProvided && workingDays === null) {
      result.errors.push(sheetName + " row " + rowNumber + ": WorkingDays must be a positive number");
    }

    if (status === "ACTIVE" && periodKey) {
      result.activeRowCount++;
      if (!activeByPeriod[periodKey]) activeByPeriod[periodKey] = [];
      const activePlan = {
        rowNumber: rowNumber,
        period: periodKey,
        checkedPlan: checkedPlan,
        finishedPlan: finishedPlan,
        planVersion: planVersion,
        updatedAt: updatedAt ? updatedAt.toISOString() : "",
        updatedBy: updatedBy
      };
      if (periodType === "monthly") {
        activePlan.workingDays = workingDays;
        if (!workingDaysProvided) {
          result.warnings.push(sheetName + " row " + rowNumber + ": WorkingDays is missing; averages will be N/A");
        }
      }
      activeByPeriod[periodKey].push(activePlan);
    }
  }

  const activePeriods = Object.keys(activeByPeriod);
  for (let p = 0; p < activePeriods.length; p++) {
    const periodKey = activePeriods[p];
    if (activeByPeriod[periodKey].length > 1) {
      result.errors.push(sheetName + ": multiple ACTIVE rows for " + periodKey);
    }
  }

  const currentRows = activeByPeriod[currentPeriodKey] || [];
  if (currentRows.length === 0) {
    result.errors.push(sheetName + ": no ACTIVE plan for " + currentPeriodKey);
  } else if (currentRows.length === 1) {
    result.currentPlan = currentRows[0];
  }

  result.valid = result.errors.length === 0 && !!result.currentPlan;
  return result;
}

function validateProductionDashboardV2Plans_(asOf) {
  const totalStartedAt = performanceTimerStart_();
  const dayKey = Utilities.formatDate(asOf, PRODUCTION_DASHBOARD_V2_TIME_ZONE, "yyyy-MM-dd");
  const monthKey = Utilities.formatDate(asOf, PRODUCTION_DASHBOARD_V2_TIME_ZONE, "yyyy-MM");
  const cacheStartedAt = performanceTimerStart_();
  const cached = readProductionDashboardV2PlanCache_(dayKey, monthKey);
  if (cached !== null) {
    performanceLog_("validateProductionDashboardV2Plans", "cache_read", cacheStartedAt, { cache: "hit" });
    performanceLog_("validateProductionDashboardV2Plans", "total", totalStartedAt, { cache: "hit" });
    return cached;
  }
  performanceLog_("validateProductionDashboardV2Plans", "cache_read", cacheStartedAt, { cache: "miss" });
  const sheetValidationStartedAt = performanceTimerStart_();
  const daily = readProductionDashboardV2PlanSheet_(
    PRODUCTION_DASHBOARD_V2_DAILY_PLAN_SHEET,
    "daily",
    dayKey
  );
  const monthly = readProductionDashboardV2PlanSheet_(
    PRODUCTION_DASHBOARD_V2_MONTHLY_PLAN_SHEET,
    "monthly",
    monthKey
  );
  performanceLog_("validateProductionDashboardV2Plans", "sheet_validation", sheetValidationStartedAt, {
    dailyValid: daily.valid,
    monthlyValid: monthly.valid
  });
  const errors = daily.errors.concat(monthly.errors);
  const warnings = daily.warnings.concat(monthly.warnings);
  let planVersion = "";

  if (daily.currentPlan && monthly.currentPlan) {
    if (daily.currentPlan.planVersion === monthly.currentPlan.planVersion) {
      planVersion = daily.currentPlan.planVersion;
    } else {
      errors.push(
        "PlanVersion mismatch: daily=" + daily.currentPlan.planVersion +
        ", monthly=" + monthly.currentPlan.planVersion
      );
    }
  }

  const result = {
    valid: errors.length === 0 && daily.valid && monthly.valid && !!planVersion,
    planVersion: planVersion,
    daily: daily,
    monthly: monthly,
    errors: errors,
    warnings: warnings
  };
  const cacheWriteStartedAt = performanceTimerStart_();
  writeProductionDashboardV2PlanCache_(dayKey, monthKey, result);
  performanceLog_("validateProductionDashboardV2Plans", "cache_write", cacheWriteStartedAt);
  performanceLog_("validateProductionDashboardV2Plans", "total", totalStartedAt, { cache: "miss" });
  return result;
}

function productionDashboardV2TxnTimestamp_(transaction) {
  const date = parseDashboardDate(transaction && transaction.date);
  if (!date) return null;

  const receiveTime = transaction ? transaction.receiveTime : null;
  if (receiveTime instanceof Date && !isNaN(receiveTime.getTime())) {
    date.setHours(
      receiveTime.getHours(),
      receiveTime.getMinutes(),
      receiveTime.getSeconds(),
      receiveTime.getMilliseconds()
    );
  } else {
    const text = (receiveTime || "").toString().trim();
    const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match) {
      date.setHours(Number(match[1]), Number(match[2]), Number(match[3] || 0), 0);
    }
  }

  return date;
}

function productionDashboardV2CompareTransactions_(left, right) {
  const leftDate = parseDashboardDate(left && left.date);
  const rightDate = parseDashboardDate(right && right.date);
  const dateDiff = (leftDate ? leftDate.getTime() : 0) - (rightDate ? rightDate.getTime() : 0);
  if (dateDiff !== 0) return dateDiff;

  const leftTime = productionDashboardV2TxnTimestamp_(left);
  const rightTime = productionDashboardV2TxnTimestamp_(right);
  const timeDiff = (leftTime ? leftTime.getTime() : 0) - (rightTime ? rightTime.getTime() : 0);
  if (timeDiff !== 0) return timeDiff;

  const idDiff = ((left && left.id) || "").toString().localeCompare(((right && right.id) || "").toString());
  if (idDiff !== 0) return idDiff;
  return Number((left && left.rowIdx) || 0) - Number((right && right.rowIdx) || 0);
}

function productionDashboardV2IsHydraulicTest_(process) {
  return normalizeString(process).indexOf("ep thuy luc") !== -1;
}

function productionDashboardV2IsRejectedProcess_(process) {
  const normalized = normalizeString(process);
  return normalized.indexOf("dau vao") !== -1
    || normalized.indexOf("rua ong") !== -1
    || normalized === "rua"
    || normalized.indexOf("thong nong") !== -1
    || normalized.indexOf("ndt") !== -1
    || normalized.indexOf("sua ren") !== -1
    || normalized.indexOf("tien ren") !== -1
    || normalized.indexOf("ep thuy luc") !== -1;
}

function productionDashboardV2IsValidCurrentProcess_(process) {
  const normalized = normalizeString(process);
  return productionDashboardV2IsRejectedProcess_(process)
    || normalized.indexOf("lam sach ren") !== -1
    || normalized.indexOf("calip ren") !== -1
    || normalized.indexOf("thay coupling") !== -1
    || normalized.indexOf("dong goi") !== -1;
}

function productionDashboardV2Event_(transaction, trigger) {
  const timestamp = productionDashboardV2TxnTimestamp_(transaction);
  return {
    at: timestamp,
    atIso: timestamp ? timestamp.toISOString() : "",
    dayKey: timestamp ? Utilities.formatDate(timestamp, PRODUCTION_DASHBOARD_V2_TIME_ZONE, "yyyy-MM-dd") : "",
    monthKey: timestamp ? Utilities.formatDate(timestamp, PRODUCTION_DASHBOARD_V2_TIME_ZONE, "yyyy-MM") : "",
    trigger: trigger,
    id: (transaction.id || "").toString(),
    entryNo: (transaction.entryNo || "").toString(),
    process: transaction.process || "",
    status: transaction.status || "",
    defectReason: transaction.defectReason || ""
  };
}

function productionDashboardV2EarlierEvent_(left, right) {
  if (!left) return right || null;
  if (!right) return left;
  if (!left.at) return right.at ? right : left;
  if (!right.at) return left;
  return left.at.getTime() <= right.at.getTime() ? left : right;
}

function productionDashboardV2RejectedEvent_(pipe) {
  const entries = pipe.entries || {};
  const entryKeys = Object.keys(entries);
  let hasRejectedEvent = false;
  let rejectedEvent = null;
  let invalidDateCount = 0;

  for (let e = 0; e < entryKeys.length; e++) {
    const transactions = (entries[entryKeys[e]] || []).slice().sort(productionDashboardV2CompareTransactions_);
    const state = { threadRepairCount: 0, couplingChangeCount: 0 };
    let previousStatus = "DANG_XU_LY";

    for (let t = 0; t < transactions.length; t++) {
      const transaction = transactions[t];
      const process = normalizeString(transaction.process);
      if (process.indexOf("ep thuy luc") !== -1) {
        // Pressure count is not currently used by classifyBusinessStatus, but preserve replay shape.
      } else if (process.indexOf("tien ren") !== -1 || process.indexOf("sua ren") !== -1) {
        state.threadRepairCount++;
      } else if (process.indexOf("thay coupling") !== -1) {
        state.couplingChangeCount++;
      }

      const classifiedStatus = classifyBusinessStatus(
        Object.assign({}, transaction),
        previousStatus,
        state
      );
      previousStatus = classifiedStatus;

      if (classifiedStatus === "LOAI" && productionDashboardV2IsRejectedProcess_(transaction.process)) {
        hasRejectedEvent = true;
        const candidate = productionDashboardV2Event_(transaction, "REJECTED");
        if (!candidate.at) invalidDateCount++;
        rejectedEvent = productionDashboardV2EarlierEvent_(rejectedEvent, candidate);
      }
    }
  }

  return {
    hasRejectedEvent: hasRejectedEvent,
    isRejected: hasRejectedEvent,
    event: rejectedEvent,
    invalidDateCount: invalidDateCount
  };
}

function projectProductionDashboardV2Pipe_(pipe) {
  const history = (pipe.history || []).slice().sort(productionDashboardV2CompareTransactions_);
  const isFinished = isThanhPhamKpiPipe(pipe);
  let finishedEvent = null;
  let hydraulicEvent = null;
  let invalidFinishedDateCount = 0;
  let invalidHydraulicDateCount = 0;

  for (let i = 0; i < history.length; i++) {
    const transaction = history[i];
    if (productionDashboardV2IsHydraulicTest_(transaction.process)) {
      const candidate = productionDashboardV2Event_(transaction, "HYDRAULIC_PRESSURE_TEST");
      if (!candidate.at) invalidHydraulicDateCount++;
      hydraulicEvent = productionDashboardV2EarlierEvent_(hydraulicEvent, candidate);
    }

    if (isThanhPhamKpiPipe({ history: [transaction] })) {
      const candidate = productionDashboardV2Event_(transaction, "FINISHED_RULE");
      if (!candidate.at) invalidFinishedDateCount++;
      finishedEvent = productionDashboardV2EarlierEvent_(finishedEvent, candidate);
    }
  }

  const rejected = productionDashboardV2RejectedEvent_(pipe);
  const hasRejectedEvent = rejected.hasRejectedEvent;
  const isCurrentlyRejected = pipe.currentBusinessStatus === "LOAI";
  const checkedEvent = productionDashboardV2EarlierEvent_(hydraulicEvent, rejected.event);
  const isChecked = !!hydraulicEvent || hasRejectedEvent;
  const validCurrentProcess = productionDashboardV2IsValidCurrentProcess_(pipe.currentProcess);
  const isWip = !isFinished && !hasRejectedEvent && validCurrentProcess;

  return {
    pipeNo: pipe.pipeNo || "",
    size: (pipe.size || "").toString().trim() || "UNKNOWN",
    currentProcess: pipe.currentProcess || "",
    isChecked: isChecked,
    checkedEvent: checkedEvent,
    isFinished: isFinished,
    finishedEvent: finishedEvent,
    hasRejectedEvent: hasRejectedEvent,
    isCurrentlyRejected: isCurrentlyRejected,
    isRejected: hasRejectedEvent,
    rejectedEvent: rejected.event,
    validCurrentProcess: validCurrentProcess,
    isWip: isWip,
    invalidEventDateCount: invalidFinishedDateCount + invalidHydraulicDateCount + rejected.invalidDateCount
  };
}

function productionDashboardV2CountEvents_(projections, eventField, periodField, periodKey) {
  let count = 0;
  for (let i = 0; i < projections.length; i++) {
    const event = projections[i][eventField];
    if (event && event[periodField] === periodKey) count++;
  }
  return count;
}

function productionDashboardV2Completion_(actual, plan) {
  if (plan === null || plan === undefined || plan <= 0) return null;
  return Number(((actual / plan) * 100).toFixed(1));
}

function productionDashboardV2Average_(actual, workingDays) {
  if (!Number.isFinite(workingDays) || workingDays <= 0) return null;
  return Number((actual / workingDays).toFixed(1));
}

function productionDashboardV2PeriodKpi_(projections, periodField, periodKey, plan) {
  const checkedActual = productionDashboardV2CountEvents_(projections, "checkedEvent", periodField, periodKey);
  const finishedActual = productionDashboardV2CountEvents_(projections, "finishedEvent", periodField, periodKey);
  const rejectedActual = productionDashboardV2CountEvents_(projections, "rejectedEvent", periodField, periodKey);
  const checkedPlan = plan ? plan.checkedPlan : null;
  const finishedPlan = plan ? plan.finishedPlan : null;

  return {
    period: periodKey,
    checked: {
      actual: checkedActual,
      plan: checkedPlan,
      completionPercent: productionDashboardV2Completion_(checkedActual, checkedPlan)
    },
    finished: {
      actual: finishedActual,
      plan: finishedPlan,
      completionPercent: productionDashboardV2Completion_(finishedActual, finishedPlan)
    },
    rejected: { actual: rejectedActual }
  };
}

function productionDashboardV2SizeBreakdown_(projections, dayKey, monthKey, workingDays) {
  const rowsBySize = {};

  for (let i = 0; i < projections.length; i++) {
    const pipe = projections[i];
    const size = pipe.size || "UNKNOWN";
    const sizeKey = "size:" + size;
    if (!rowsBySize[sizeKey]) {
      rowsBySize[sizeKey] = {
        size: size,
        today: { checked: 0, finished: 0, rejected: 0 },
        monthly: { checked: 0, finished: 0, rejected: 0 }
      };
    }

    const row = rowsBySize[sizeKey];
    if (pipe.checkedEvent && pipe.checkedEvent.dayKey === dayKey) row.today.checked++;
    if (pipe.finishedEvent && pipe.finishedEvent.dayKey === dayKey) row.today.finished++;
    if (pipe.rejectedEvent && pipe.rejectedEvent.dayKey === dayKey) row.today.rejected++;
    if (pipe.checkedEvent && pipe.checkedEvent.monthKey === monthKey) row.monthly.checked++;
    if (pipe.finishedEvent && pipe.finishedEvent.monthKey === monthKey) row.monthly.finished++;
    if (pipe.rejectedEvent && pipe.rejectedEvent.monthKey === monthKey) row.monthly.rejected++;
  }

  return Object.keys(rowsBySize).map(function(sizeKey) {
    const row = rowsBySize[sizeKey];
    row.averages = {
      checkedPerWorkingDay: productionDashboardV2Average_(row.monthly.checked, workingDays),
      finishedPerWorkingDay: productionDashboardV2Average_(row.monthly.finished, workingDays),
      workingDays: Number.isFinite(workingDays) && workingDays > 0 ? workingDays : null
    };
    return row;
  }).sort(function(left, right) {
    return right.monthly.checked - left.monthly.checked || left.size.localeCompare(right.size);
  });
}

function productionDashboardV2SetDifference_(left, right) {
  const rightSet = {};
  for (let i = 0; i < right.length; i++) rightSet[right[i]] = true;
  return left.filter(function(pipeNo) { return !rightSet[pipeNo]; }).sort();
}

function productionDashboardV2Reconciliation_(pipeObjects, projections, wip, planValidation, sizeBreakdown) {
  const finishedV1 = pipeObjects.filter(function(pipe) {
    return isThanhPhamKpiPipe(pipe);
  }).map(function(pipe) { return pipe.pipeNo; }).sort();
  const finishedV2 = projections.filter(function(pipe) {
    return pipe.isFinished;
  }).map(function(pipe) { return pipe.pipeNo; }).sort();
  const rejectedV1 = pipeObjects.filter(function(pipe) {
    return pipe.currentBusinessStatus === "LOAI";
  }).map(function(pipe) { return pipe.pipeNo; }).sort();
  const rejectedV2 = projections.filter(function(pipe) {
    return pipe.isCurrentlyRejected;
  }).map(function(pipe) { return pipe.pipeNo; }).sort();
  const checkedSamples = projections.filter(function(pipe) {
    return pipe.isChecked;
  }).sort(function(left, right) {
    const leftTime = left.checkedEvent && left.checkedEvent.at ? left.checkedEvent.at.getTime() : 0;
    const rightTime = right.checkedEvent && right.checkedEvent.at ? right.checkedEvent.at.getTime() : 0;
    if (leftTime !== rightTime) return rightTime - leftTime;
    return right.pipeNo.localeCompare(left.pipeNo);
  }).slice(0, 10).map(function(pipe) {
    const event = pipe.checkedEvent || {};
    return {
      id: event.id || "",
      pipeNo: pipe.pipeNo,
      checkedAt: event.atIso || "",
      checkedTrigger: event.trigger || "",
      entryNo: event.entryNo || "",
      process: event.process || "",
      status: event.status || "",
      defectReason: event.defectReason || "",
      finishedAt: pipe.finishedEvent ? pipe.finishedEvent.atIso : "",
      rejectedAt: pipe.rejectedEvent ? pipe.rejectedEvent.atIso : "",
      currentProcess: pipe.currentProcess,
      isFinished: pipe.isFinished,
      isRejected: pipe.isRejected,
      isWip: pipe.isWip
    };
  });
  const sizesDetected = sizeBreakdown.map(function(row) { return row.size; }).sort();
  const unknownSizeCount = projections.filter(function(pipe) {
    return pipe.size === "UNKNOWN";
  }).length;
  const unknownSizePercent = projections.length > 0
    ? Number(((unknownSizeCount / projections.length) * 100).toFixed(1))
    : 0;

  return {
    finished: {
      v1: finishedV1.length,
      v2: finishedV2.length,
      difference: finishedV2.length - finishedV1.length,
      matches: finishedV1.join("|") === finishedV2.join("|"),
      onlyInV1: productionDashboardV2SetDifference_(finishedV1, finishedV2),
      onlyInV2: productionDashboardV2SetDifference_(finishedV2, finishedV1)
    },
    rejected: {
      v1: rejectedV1.length,
      v2: rejectedV2.length,
      difference: rejectedV2.length - rejectedV1.length,
      matches: rejectedV1.join("|") === rejectedV2.join("|"),
      onlyInV1: productionDashboardV2SetDifference_(rejectedV1, rejectedV2),
      onlyInV2: productionDashboardV2SetDifference_(rejectedV2, rejectedV1)
    },
    checkedSamples: checkedSamples,
    wip: {
      total: wip.total,
      bucketTotal: wip.bucketTotal,
      matches: wip.total === wip.bucketTotal,
      invalidCurrentProcess: wip.invalidCurrentProcess,
      finishedRejectedOverlap: projections.filter(function(pipe) {
        return pipe.isFinished && pipe.isRejected;
      }).length
    },
    sizesDetected: sizesDetected,
    unknownSizeCount: unknownSizeCount,
    unknownSizePercent: unknownSizePercent,
    top10SizeRowsByMonthlyChecked: sizeBreakdown.slice(0, 10),
    planValidation: planValidation
  };
}

function getProductionDashboardV2Shadow() {
  const totalStartedAt = performanceTimerStart_();
  const builtAt = new Date();

  try {
    const rawTransactionsStartedAt = performanceTimerStart_();
    const sourceTransactions = getRawTransactions();
    performanceLog_("getProductionDashboardV2Shadow", "getRawTransactions", rawTransactionsStartedAt, {
      transactionCount: sourceTransactions.length
    });
    const pipeEngineStartedAt = performanceTimerStart_();
    const pipeObjects = buildPipeEngine(sourceTransactions);
    performanceLog_("getProductionDashboardV2Shadow", "buildPipeEngine", pipeEngineStartedAt, {
      pipeCount: pipeObjects.length
    });
    const projectionStartedAt = performanceTimerStart_();
    const projections = pipeObjects.map(projectProductionDashboardV2Pipe_);
    performanceLog_("getProductionDashboardV2Shadow", "projection", projectionStartedAt, {
      projectionCount: projections.length
    });
    const dayKey = Utilities.formatDate(builtAt, PRODUCTION_DASHBOARD_V2_TIME_ZONE, "yyyy-MM-dd");
    const monthKey = Utilities.formatDate(builtAt, PRODUCTION_DASHBOARD_V2_TIME_ZONE, "yyyy-MM");
    const planValidationStartedAt = performanceTimerStart_();
    const planValidation = validateProductionDashboardV2Plans_(builtAt);
    performanceLog_("getProductionDashboardV2Shadow", "plan_validation", planValidationStartedAt, {
      valid: planValidation.valid
    });
    const dailyPlan = planValidation.daily.currentPlan;
    const monthlyPlan = planValidation.monthly.currentPlan;
    const workingDays = monthlyPlan && Number.isFinite(monthlyPlan.workingDays) && monthlyPlan.workingDays > 0
      ? monthlyPlan.workingDays
      : null;
    const aggregationStartedAt = performanceTimerStart_();
    const daily = productionDashboardV2PeriodKpi_(projections, "dayKey", dayKey, dailyPlan);
    const monthly = productionDashboardV2PeriodKpi_(projections, "monthKey", monthKey, monthlyPlan);
    const monthlyAverages = {
      checkedPerWorkingDay: productionDashboardV2Average_(monthly.checked.actual, workingDays),
      finishedPerWorkingDay: productionDashboardV2Average_(monthly.finished.actual, workingDays),
      workingDays: workingDays
    };
    const sizeBreakdown = productionDashboardV2SizeBreakdown_(projections, dayKey, monthKey, workingDays);
    performanceLog_("getProductionDashboardV2Shadow", "kpi_aggregation", aggregationStartedAt, {
      sizeCount: sizeBreakdown.length
    });
    const wipHealthStartedAt = performanceTimerStart_();
    const wipByCurrentProcess = {};
    let invalidCurrentProcess = 0;
    let invalidEventDateCount = 0;

    for (let i = 0; i < projections.length; i++) {
      const pipe = projections[i];
      invalidEventDateCount += pipe.invalidEventDateCount;

      if (pipe.isWip) {
        if (!wipByCurrentProcess[pipe.currentProcess]) wipByCurrentProcess[pipe.currentProcess] = 0;
        wipByCurrentProcess[pipe.currentProcess]++;
      } else if (!pipe.isFinished && !pipe.isRejected && !pipe.validCurrentProcess) {
        invalidCurrentProcess++;
      }
    }

    const wipRows = Object.keys(wipByCurrentProcess).map(function(process) {
      return { currentProcess: process, count: wipByCurrentProcess[process] };
    }).sort(function(left, right) {
      return right.count - left.count || left.currentProcess.localeCompare(right.currentProcess);
    });
    const wipTotal = projections.filter(function(pipe) { return pipe.isWip; }).length;
    const bucketTotal = wipRows.reduce(function(total, row) { return total + row.count; }, 0);
    const wip = {
      total: wipTotal,
      bucketTotal: bucketTotal,
      byCurrentProcess: wipRows,
      invalidCurrentProcess: invalidCurrentProcess
    };
    const healthErrors = planValidation.errors.slice();
    const healthWarnings = planValidation.warnings.slice();
    const unknownSizeCount = projections.filter(function(pipe) { return pipe.size === "UNKNOWN"; }).length;

    if (sourceTransactions.length === 0) healthErrors.push("No source transactions found.");
    if (invalidEventDateCount > 0) {
      healthErrors.push(invalidEventDateCount + " qualifying event(s) have invalid production dates.");
    }
    if (invalidCurrentProcess > 0) {
      healthErrors.push(invalidCurrentProcess + " active pipe(s) have invalid currentProcess.");
    }
    if (wipTotal !== bucketTotal) healthErrors.push("WIP total does not match process buckets.");
    if (unknownSizeCount > 0) {
      const unknownSizePercent = projections.length > 0
        ? Number(((unknownSizeCount / projections.length) * 100).toFixed(1))
        : 0;
      healthWarnings.push(
        unknownSizeCount + " pipe(s) have UNKNOWN size (" + unknownSizePercent + "%)."
      );
    }

    const healthStatus = healthErrors.length === 0 ? "OK" : "ERROR";
    const result = {
      success: true,
      mode: "SHADOW",
      builtAt: builtAt.toISOString(),
      sourceRowCount: sourceTransactions.length,
      planVersion: planValidation.planVersion,
      health: {
        status: healthStatus,
        errors: healthErrors,
        warnings: healthWarnings
      },
      daily: daily,
      monthly: monthly,
      monthlyAverages: monthlyAverages,
      sizeBreakdown: sizeBreakdown,
      wip: wip
    };

    performanceLog_("getProductionDashboardV2Shadow", "wip_health", wipHealthStartedAt, {
      wipTotal: wipTotal,
      healthStatus: healthStatus
    });
    const reconciliationStartedAt = performanceTimerStart_();
    result.reconciliation = productionDashboardV2Reconciliation_(
      pipeObjects,
      projections,
      wip,
      planValidation,
      sizeBreakdown
    );
    performanceLog_("getProductionDashboardV2Shadow", "reconciliation", reconciliationStartedAt);
    performanceLog_("getProductionDashboardV2Shadow", "total", totalStartedAt, {
      status: "success",
      transactionCount: sourceTransactions.length,
      pipeCount: pipeObjects.length
    });
    Logger.log(JSON.stringify(result));
    return result;
  } catch (error) {
    performanceLog_("getProductionDashboardV2Shadow", "total", totalStartedAt, { status: "error" });
    const result = {
      success: false,
      mode: "SHADOW",
      builtAt: builtAt.toISOString(),
      sourceRowCount: 0,
      planVersion: "",
      health: {
        status: "ERROR",
        errors: [error && error.message ? error.message : error.toString()],
        warnings: []
      }
    };
    Logger.log(JSON.stringify(result));
    return result;
  }
}

function debugProductionDashboardV2DailyEvents(dateKey) {
  const targetDate = (dateKey || "").toString().trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw new Error("dateKey must use yyyy-MM-dd format.");
  }

  const projections = buildPipeEngine(getRawTransactions()).map(projectProductionDashboardV2Pipe_);
  const events = [];
  const eventDefinitions = [
    { field: "checkedEvent", type: "CHECKED" },
    { field: "finishedEvent", type: "FINISHED" },
    { field: "rejectedEvent", type: "REJECTED" }
  ];

  projections.forEach(function(pipe) {
    eventDefinitions.forEach(function(definition) {
      const event = pipe[definition.field];
      if (!event || event.dayKey !== targetDate) return;
      events.push({
        type: definition.type,
        pipeNo: pipe.pipeNo,
        size: pipe.size,
        at: event.atIso,
        id: event.id,
        entryNo: event.entryNo,
        process: event.process,
        status: event.status,
        defectReason: event.defectReason,
        trigger: event.trigger
      });
    });
  });

  events.sort(function(left, right) {
    return left.at.localeCompare(right.at) || left.type.localeCompare(right.type) || left.pipeNo.localeCompare(right.pipeNo);
  });

  return {
    date: targetDate,
    timeZone: PRODUCTION_DASHBOARD_V2_TIME_ZONE,
    counts: {
      checked: events.filter(function(event) { return event.type === "CHECKED"; }).length,
      finished: events.filter(function(event) { return event.type === "FINISHED"; }).length,
      rejected: events.filter(function(event) { return event.type === "REJECTED"; }).length
    },
    events: events
  };
}

function debugProductionDashboardV2DailyEvents20260712() {
  const result = debugProductionDashboardV2DailyEvents("2026-07-12");
  Logger.log(JSON.stringify(result));
  return result;
}
