const BUSINESS_RULE_STATES = {
  THANH_PHAM: "THANH_PHAM",
  CHO_SUA: "CHO_SUA",
  LOAI: "LOAI"
};

const BUSINESS_RULE_PROCESS_STATES = {
  DANG_XU_LY: "DANG_XU_LY"
};

const BUSINESS_RULE_STATUS_KEYS = {
  THANH_PHAM: "tp",
  CHO_SUA: "cs",
  LOAI: "hong",
  DANG_XU_LY: "dxl"
};

const BUSINESS_RULE_DEFECTS = [
  { code: "XI_CA_2_DAU", label: "Xì cả 2 đầu", businessState: "CHO_SUA", process: "Ép thủy lực", severity: "High", color: "#f97316", keywords: ["xi ca 2 dau"], nextProcess: "Tiện ren + Thay coupling" },
  { code: "XI_PIN", label: "Xì pin", businessState: "CHO_SUA", process: "Ép thủy lực", severity: "High", color: "#f97316", keywords: ["xi pin"], nextProcess: "Tiện ren" },
  { code: "XI_BOX", label: "Xì box", businessState: "CHO_SUA", process: "Ép thủy lực", severity: "High", color: "#f97316", keywords: ["xi box"], nextProcess: "Thay coupling" },
  { code: "KHONG_DU_CHIEU_DAY", label: "Không đủ chiều dày", businessState: "LOAI", process: "NDT", severity: "High", color: "#ef4444", keywords: ["khong du chieu day"] },
  { code: "THIEU_CHIEU_DAY", label: "Thiếu chiều dày", businessState: "LOAI", process: "NDT", severity: "High", color: "#ef4444", keywords: ["thieu chieu day"] },
  { code: "KHUYET_TAT_NGANG", label: "Khuyết tật ngang", businessState: "LOAI", process: "NDT", severity: "High", color: "#ef4444", keywords: ["khuyet tat ngang"] },
  { code: "KHUYET_TAT_DOC", label: "Khuyết tật dọc", businessState: "LOAI", process: "NDT", severity: "High", color: "#ef4444", keywords: ["khuyet tat doc"] },
  { code: "RO_THAN_AN_MON", label: "Rỗ thân, ăn mòn", businessState: "LOAI", process: "NDT", severity: "High", color: "#ef4444", keywords: ["ro than an mon", "ro than, an mon"] },
  { code: "RO_THAN", label: "Rỗ thân", businessState: "LOAI", process: "NDT", severity: "High", color: "#ef4444", keywords: ["ro than"] },
  { code: "TAC_PARAFFIN", label: "Tắc paraffin", businessState: "LOAI", process: "Thông nòng", severity: "Medium", color: "#ef4444", keywords: ["tac paraffin"] },
  { code: "TAC_ONG", label: "Tắc ống", businessState: "LOAI", process: "Thông nòng", severity: "Medium", color: "#ef4444", keywords: ["tac ong"] },
  { code: "LOAI_NDT", label: "Loại NDT", businessState: "LOAI", process: "NDT", severity: "High", color: "#ef4444", keywords: ["loai ndt"] },
  { code: "TIEN_LAI_KHONG_DAT", label: "Tiện lại không đạt", businessState: "LOAI", process: "Tiện ren", severity: "High", color: "#ef4444", keywords: ["tien lai khong dat"] },
  { code: "HONG_REN_VA_COUPLING", label: "Hỏng ren và coupling", businessState: "CHO_SUA", process: "Tiện ren + Thay coupling", severity: "High", color: "#f97316", keywords: ["hong ren va coupling", "hong ren va cl"] },
  { code: "HONG_REN", label: "Hỏng ren", businessState: "CHO_SUA", process: "Tiện ren", severity: "Medium", color: "#f59e0b", keywords: ["hong ren"] },
  { code: "HONG_COUPLING", label: "Hỏng coupling", businessState: "CHO_SUA", process: "Thay coupling", severity: "Medium", color: "#f59e0b", keywords: ["hong coupling"] },
  { code: "KHONG_LAP_DUOC_COUPLING", label: "Không lắp được coupling", businessState: "CHO_SUA", process: "Thay coupling", severity: "Medium", color: "#f59e0b", keywords: ["khong lap duoc coupling", "khong lap duoc cl"] },
  { code: "KHAC", label: "Khác", businessState: "CHO_SUA", process: "", severity: "Medium", color: "#6b7280", keywords: ["khac"] },
  { code: "LOAI", label: "Loại", businessState: "LOAI", process: "", severity: "High", color: "#ef4444", keywords: ["loai"] },
  { code: "CHO_SUA", label: "Chờ sửa", businessState: "CHO_SUA", process: "", severity: "Medium", color: "#f59e0b", keywords: ["cho sua"] },
  { code: "HONG", label: "Hỏng", businessState: "CHO_SUA", process: "", severity: "Medium", color: "#f59e0b", keywords: ["hong", "loi"] }
];

function businessRuleNormalizeText_(value) {
  if (typeof normalizeString === "function") return normalizeString(value);
  if (value === null || value === undefined) return "";
  let text = value.toString().trim().toLowerCase().replace(/đ/g, "d");
  return text.normalize ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : text;
}

function businessRuleNormalizeBusinessState_(value) {
  const state = (value === null || value === undefined ? "" : value.toString()).trim().toUpperCase();
  return BUSINESS_RULE_STATES[state] || "";
}

function isBusinessState_(value) {
  return !!businessRuleNormalizeBusinessState_(value);
}

function isBusinessFinishedState_(value) {
  return businessRuleNormalizeBusinessState_(value) === BUSINESS_RULE_STATES.THANH_PHAM;
}

function isBusinessRepairState_(value) {
  return businessRuleNormalizeBusinessState_(value) === BUSINESS_RULE_STATES.CHO_SUA;
}

function isBusinessScrapState_(value) {
  return businessRuleNormalizeBusinessState_(value) === BUSINESS_RULE_STATES.LOAI;
}

function getBusinessStates_() {
  return {
    THANH_PHAM: BUSINESS_RULE_STATES.THANH_PHAM,
    CHO_SUA: BUSINESS_RULE_STATES.CHO_SUA,
    LOAI: BUSINESS_RULE_STATES.LOAI
  };
}

function getBusinessProcessStates_() {
  return {
    DANG_XU_LY: BUSINESS_RULE_PROCESS_STATES.DANG_XU_LY
  };
}

function getBusinessProcessState_(businessStatus) {
  return isBusinessState_(businessStatus) ? "" : BUSINESS_RULE_PROCESS_STATES.DANG_XU_LY;
}

function businessRuleDefectClone_(entry) {
  const copy = {};
  Object.keys(entry || {}).forEach(function(key) {
    copy[key] = key === "keywords" ? (entry[key] || []).slice() : entry[key];
  });
  copy.category = getBusinessStateLabel_(copy.businessState);
  return copy;
}

function getBusinessRuleErrorDictionary_() {
  return BUSINESS_RULE_DEFECTS.map(businessRuleDefectClone_);
}

function getBusinessRuleDefectReasonKeywords_() {
  return BUSINESS_RULE_DEFECTS.filter(function(entry) {
    return entry.code !== "LOAI" && entry.code !== "CHO_SUA" && entry.code !== "HONG";
  }).reduce(function(keywords, entry) {
    return keywords.concat(entry.keywords || []);
  }, []);
}

function getBusinessStateLabel_(businessState) {
  const state = businessRuleNormalizeBusinessState_(businessState);
  if (state === BUSINESS_RULE_STATES.THANH_PHAM) return "Thành phẩm";
  if (state === BUSINESS_RULE_STATES.CHO_SUA) return "Chờ sửa";
  if (state === BUSINESS_RULE_STATES.LOAI) return "Loại";
  return "";
}

function businessRuleTextHasKeyword_(text, keyword) {
  const normalizedText = businessRuleNormalizeText_(text);
  const normalizedKeyword = businessRuleNormalizeText_(keyword);
  return !!normalizedKeyword && normalizedText.indexOf(normalizedKeyword) !== -1;
}

function businessRuleFindDefect_(reason, businessState) {
  const normalizedReason = businessRuleNormalizeText_(reason);
  const state = businessRuleNormalizeBusinessState_(businessState);
  if (!normalizedReason || !state) return null;

  const candidates = BUSINESS_RULE_DEFECTS
    .filter(function(entry) { return entry.businessState === state; })
    .map(businessRuleDefectClone_);
  candidates.sort(function(left, right) {
    return businessRuleLongestKeywordLength_(right) - businessRuleLongestKeywordLength_(left);
  });

  for (let i = 0; i < candidates.length; i++) {
    const keywords = candidates[i].keywords || [];
    for (let j = 0; j < keywords.length; j++) {
      if (businessRuleTextHasKeyword_(normalizedReason, keywords[j])) return candidates[i];
    }
  }
  return null;
}

function businessRuleLongestKeywordLength_(entry) {
  return (entry.keywords || []).reduce(function(max, keyword) {
    return Math.max(max, businessRuleNormalizeText_(keyword).length);
  }, 0);
}

function isBusinessScrapDefect_(reason) {
  return !!businessRuleFindDefect_(reason, BUSINESS_RULE_STATES.LOAI);
}

function isBusinessRepairableDefect_(reason) {
  return !!businessRuleFindDefect_(reason, BUSINESS_RULE_STATES.CHO_SUA);
}

function isBusinessHydraulicProcess_(process) {
  return businessRuleTextHasKeyword_(process, "ep thuy luc");
}

function businessRuleIsPassStatus_(status) {
  const normalizedStatus = businessRuleNormalizeText_(status);
  return normalizedStatus === "ok" || normalizedStatus === "dat" || normalizedStatus === "thanh pham";
}

function isBusinessFinishedTransaction_(transaction) {
  const txn = transaction || {};
  return isBusinessHydraulicProcess_(txn.process) && businessRuleIsPassStatus_(txn.status);
}

function isBusinessFinishedKpiNote_(transaction) {
  return businessRuleTextHasKeyword_(transaction && transaction.notes, "ong rua lai khong ep");
}

function isBusinessFinishedKpiTransaction_(transaction) {
  return isBusinessFinishedTransaction_(transaction) || isBusinessFinishedKpiNote_(transaction);
}

function isBusinessFinishedKpiPipe_(pipe) {
  if (!pipe) return false;
  const currentState = businessRuleNormalizeBusinessState_(pipe.currentBusinessStatus);
  if (currentState) return isBusinessFinishedState_(currentState);
  const history = Array.isArray(pipe.history) ? pipe.history : [];
  return history.some(function(transaction) {
    return isBusinessFinishedKpiTransaction_(transaction);
  });
}

function getBusinessCurrentState_(transaction, previousStatus, currentPipeState) {
  const txn = transaction || {};
  if (typeof txn === "object") txn.nextProcess = "";

  const previousState = businessRuleNormalizeBusinessState_(previousStatus);
  const process = businessRuleNormalizeText_(txn.process);
  const status = businessRuleNormalizeText_(txn.status);
  const reason = businessRuleNormalizeText_(txn.defectReason);
  const threadRepairs = Number(currentPipeState && currentPipeState.threadRepairCount || 0);
  const couplingRepairs = Number(currentPipeState && currentPipeState.couplingChangeCount || 0);

  if (previousState === BUSINESS_RULE_STATES.LOAI) return BUSINESS_RULE_STATES.LOAI;
  if (isBusinessScrapDefect_(reason)) return BUSINESS_RULE_STATES.LOAI;

  if (isBusinessHydraulicProcess_(process) && reason.indexOf("xi") !== -1) {
    if (threadRepairs >= 1 && couplingRepairs >= 1) return BUSINESS_RULE_STATES.LOAI;
    if (reason.indexOf("xi pin") !== -1 && threadRepairs >= 1) return BUSINESS_RULE_STATES.LOAI;
  }

  const repairableDefect = businessRuleFindDefect_(reason, BUSINESS_RULE_STATES.CHO_SUA);
  if (repairableDefect) {
    if (typeof txn === "object") txn.nextProcess = repairableDefect.nextProcess || "";
    return BUSINESS_RULE_STATES.CHO_SUA;
  }

  if (status.indexOf("cho sua") !== -1 || status.indexOf("hong") !== -1 || status.indexOf("loi") !== -1) {
    return BUSINESS_RULE_STATES.CHO_SUA;
  }

  if (status.indexOf("loai") !== -1) return BUSINESS_RULE_STATES.LOAI;
  if (process.indexOf("dong goi") !== -1 && status && !businessRuleIsPassStatus_(status)) {
    return BUSINESS_RULE_STATES.CHO_SUA;
  }
  if (isBusinessFinishedTransaction_(txn)) return BUSINESS_RULE_STATES.THANH_PHAM;

  return previousState;
}

function getBusinessStatusGroupKey_(businessStatus, processState) {
  const state = businessRuleNormalizeBusinessState_(businessStatus);
  if (state === BUSINESS_RULE_STATES.THANH_PHAM) return BUSINESS_RULE_STATUS_KEYS.THANH_PHAM;
  if (state === BUSINESS_RULE_STATES.CHO_SUA) return BUSINESS_RULE_STATUS_KEYS.CHO_SUA;
  if (state === BUSINESS_RULE_STATES.LOAI) return BUSINESS_RULE_STATUS_KEYS.LOAI;
  if (processState === BUSINESS_RULE_PROCESS_STATES.DANG_XU_LY || !state) return BUSINESS_RULE_STATUS_KEYS.DANG_XU_LY;
  return "";
}

function getPipeDashboardStatusKey_(pipe) {
  if (isBusinessFinishedKpiPipe_(pipe)) return BUSINESS_RULE_STATUS_KEYS.THANH_PHAM;
  const businessStatus = pipe && pipe.currentBusinessStatus;
  const processState = pipe && (pipe.currentProcessState || getBusinessProcessState_(businessStatus));
  return getBusinessStatusGroupKey_(businessStatus, processState);
}

function getTransactionDashboardStatusKey_(transaction, previousStatus, currentPipeState) {
  const status = getBusinessCurrentState_(transaction, previousStatus, currentPipeState);
  return getBusinessStatusGroupKey_(status, getBusinessProcessState_(status));
}

function getPipeExportBusinessState_(pipe) {
  const state = businessRuleNormalizeBusinessState_(pipe && pipe.currentBusinessStatus);
  return state === BUSINESS_RULE_STATES.THANH_PHAM || state === BUSINESS_RULE_STATES.LOAI ? state : "";
}
