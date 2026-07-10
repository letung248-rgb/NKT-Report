/**
 * Ghi kết quả debug ra Sheet "DEBUG"
 */
function classifyBusinessStatus(transaction, previousStatus, currentPipeState) {
  let p = normalizeString(transaction.process);
  let s = normalizeString(transaction.status);
  let r = normalizeString(transaction.defectReason);
  
  transaction.nextProcess = "";

  const loaiList = [
    "khong du chieu day", "thieu chieu day", "khuyet tat ngang", "khuyet tat doc", 
    "ro than", "ro than, an mon", "tac paraffin", "tac ong", "loai ndt", "tien lai khong dat"
  ];
  
  const choSuaList = [
    "hong ren", "hong coupling", "hong ren va coupling", "khong lap duoc coupling", "khac"
  ];

  // Logic 1: Kiểm tra nhóm Lỗi Loại hẳn (Scrap)
  for (let kw of loaiList) {
    if (r.includes(kw)) return "LOAI";
  }
  if (s.includes("loai")) return "LOAI";
  
  let threadRepairs = currentPipeState ? currentPipeState.threadRepairCount : 0;
  let couplingRepairs = currentPipeState ? currentPipeState.couplingChangeCount : 0;
  
  // RULE 5: Đã từng sửa cả 2 đầu và ép lại vẫn xì -> LOẠI
  if (threadRepairs >= 1 && couplingRepairs >= 1) {
    if (p.includes("ep thuy luc") && r.includes("xi")) {
      return "LOAI";
    }
  }
  
  // RULE 1 & 2: Process = Ép thủy lực, Reason = Xì pin
  if (p.includes("ep thuy luc") && r.includes("xi pin")) {
    if (threadRepairs >= 1) {
      return "LOAI"; // Rule 2
    } else {
      transaction.nextProcess = "Tiện ren";
      return "CHO_SUA"; // Rule 1
    }
  }
  
  // RULE 3: Reason = Xì box
  if (r.includes("xi box")) {
    transaction.nextProcess = "Thay coupling";
    return "CHO_SUA";
  }
  
  // RULE 4: Reason = Xì cả 2 đầu
  if (r.includes("xi ca 2 dau")) {
    transaction.nextProcess = "Tiện ren + Thay coupling";
    return "CHO_SUA";
  }
  
  // Logic 2: Kiểm tra nhóm Lỗi Chờ sửa (Repair)
  for (let kw of choSuaList) {
    if (r.includes(kw)) return "CHO_SUA";
  }
  if (s.includes("cho sua") || s.includes("hong") || s.includes("loi")) return "CHO_SUA";
  
  // Logic 3: Đóng gói phát hiện lỗi -> CHỜ SỬA
  if (p.includes("dong goi") && !s.includes("dat") && !s.includes("thanh pham") && s !== "") {
    return "CHO_SUA";
  }

  // Logic 4: Các nguyên công + Đạt
  if (s.includes("dat") || s.includes("thanh pham")) {
    if (p.includes("ep thuy luc")) {
      return "THANH_PHAM";
    }
    if (p.includes("dong goi")) {
      // Giữ nguyên THÀNH PHẨM, không tạo mới
      return previousStatus === "THANH_PHAM" ? "THANH_PHAM" : "DANG_XU_LY";
    }
    // Các nguyên công còn lại
    return "DANG_XU_LY";
  }
  
  // Mặc định các nguyên công còn lại
  return "DANG_XU_LY";
}

/**
 * Sprint Error Analysis - dictionary/classifier only, no KPI rule changes.
 */
const ERROR_DICTIONARY = [
  { code: "XI_CA_2_DAU", label: "Xì cả 2 đầu", category: "Chờ sửa", process: "Ép thủy lực", severity: "High", color: "#f97316", keywords: ["xi ca 2 dau"] },
  { code: "XI_PIN", label: "Xì pin", category: "Chờ sửa", process: "Ép thủy lực", severity: "High", color: "#f97316", keywords: ["xi pin"] },
  { code: "XI_BOX", label: "Xì box", category: "Chờ sửa", process: "Ép thủy lực", severity: "High", color: "#f97316", keywords: ["xi box"] },
  { code: "KHONG_DU_CHIEU_DAY", label: "Không đủ chiều dày", category: "Loại", process: "NDT", severity: "High", color: "#ef4444", keywords: ["khong du chieu day"] },
  { code: "THIEU_CHIEU_DAY", label: "Thiếu chiều dày", category: "Loại", process: "NDT", severity: "High", color: "#ef4444", keywords: ["thieu chieu day"] },
  { code: "KHUYET_TAT_NGANG", label: "Khuyết tật ngang", category: "Loại", process: "NDT", severity: "High", color: "#ef4444", keywords: ["khuyet tat ngang"] },
  { code: "KHUYET_TAT_DOC", label: "Khuyết tật dọc", category: "Loại", process: "NDT", severity: "High", color: "#ef4444", keywords: ["khuyet tat doc"] },
  { code: "RO_THAN_AN_MON", label: "Rỗ thân, ăn mòn", category: "Loại", process: "NDT", severity: "High", color: "#ef4444", keywords: ["ro than an mon", "ro than, an mon"] },
  { code: "RO_THAN", label: "Rỗ thân", category: "Loại", process: "NDT", severity: "High", color: "#ef4444", keywords: ["ro than"] },
  { code: "TAC_PARAFFIN", label: "Tắc paraffin", category: "Loại", process: "Thông nòng", severity: "Medium", color: "#ef4444", keywords: ["tac paraffin"] },
  { code: "TAC_ONG", label: "Tắc ống", category: "Loại", process: "Thông nòng", severity: "Medium", color: "#ef4444", keywords: ["tac ong"] },
  { code: "LOAI_NDT", label: "Loại NDT", category: "Loại", process: "NDT", severity: "High", color: "#ef4444", keywords: ["loai ndt"] },
  { code: "TIEN_LAI_KHONG_DAT", label: "Tiện lại không đạt", category: "Loại", process: "Tiện ren", severity: "High", color: "#ef4444", keywords: ["tien lai khong dat"] },
  { code: "HONG_REN_VA_COUPLING", label: "Hỏng ren và coupling", category: "Chờ sửa", process: "Tiện ren + Thay coupling", severity: "High", color: "#f97316", keywords: ["hong ren va coupling"] },
  { code: "HONG_REN", label: "Hỏng ren", category: "Chờ sửa", process: "Tiện ren", severity: "Medium", color: "#f59e0b", keywords: ["hong ren"] },
  { code: "HONG_COUPLING", label: "Hỏng coupling", category: "Chờ sửa", process: "Thay coupling", severity: "Medium", color: "#f59e0b", keywords: ["hong coupling"] },
  { code: "KHONG_LAP_DUOC_COUPLING", label: "Không lắp được coupling", category: "Chờ sửa", process: "Thay coupling", severity: "Medium", color: "#f59e0b", keywords: ["khong lap duoc coupling"] },
  { code: "KHAC", label: "Khác", category: "Khác", process: "", severity: "Medium", color: "#6b7280", keywords: ["khac"] },
  { code: "LOAI", label: "Loại", category: "Loại", process: "", severity: "High", color: "#ef4444", keywords: ["loai"] },
  { code: "CHO_SUA", label: "Chờ sửa", category: "Chờ sửa", process: "", severity: "Medium", color: "#f59e0b", keywords: ["cho sua"] },
  { code: "HONG", label: "Hỏng", category: "Chờ sửa", process: "", severity: "Medium", color: "#f59e0b", keywords: ["hong", "loi"] }
];

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
  for (let i = 0; i < ERROR_DICTIONARY.length; i++) {
    if (ERROR_DICTIONARY[i].code === code) {
      return {
        category: ERROR_DICTIONARY[i].category || ERROR_MASTER_DEFAULT.category,
        process: ERROR_DICTIONARY[i].process || ERROR_MASTER_DEFAULT.process,
        severity: ERROR_DICTIONARY[i].severity || ERROR_MASTER_DEFAULT.severity,
        color: ERROR_DICTIONARY[i].color || ERROR_MASTER_DEFAULT.color
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

  if (pipe.currentBusinessStatus === "LOAI" || pipe.currentBusinessStatus === "CHO_SUA") {
    addErrorCandidate_(candidates, "currentBusinessStatus", pipe.currentBusinessStatus);
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
  for (let i = 0; i < ERROR_DICTIONARY.length; i++) {
    const entry = ERROR_DICTIONARY[i];
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
  
  let finalBusinessStatus = "DANG_XU_LY";
  
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
  pipe.currentNextProcess = latestTxn.nextProcess || "";
  pipe.currentWorker1 = latestTxn.worker1;
  pipe.currentWorker2 = latestTxn.worker2;
  pipe.currentShift = latestTxn.shift;
  pipe.currentDate = latestTxn.date;
  
  return pipe;
}

// KPI Thành phẩm dùng business rule riêng, không phụ thuộc currentBusinessStatus.
function isThanhPhamKpiPipe(pipe) {
  return pipe.history.some(t => {
    let pName = normalizeString(t.process);
    let sName = normalizeString(t.status);
    let note = normalizeString(t.notes);
    return (pName.includes("ep thuy luc") && (sName === "ok" || sName === "dat")) || note.includes("ong rua lai khong ep");
  });
}

/**
 * 2. Xây dựng Pipe Engine
 */
function buildPipeEngine() {
  const transactions = getRawTransactions();
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
  
  // Xác định Current State cho từng Pipe
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
  
  return pipeObjects;
}

/**
 * 5. Hàm Debug kiểm tra Pipe Engine
 */
function debugPipeEngine() {
  try {
    const pipeObjects = buildPipeEngine();
    let totalTransactions = 0;
    let statusSummary = { "THANH_PHAM": 0, "CHO_SUA": 0, "LOAI": 0, "DANG_XU_LY": 0 };
    let processQueueSummary = {};
    
    for (let pipe of pipeObjects) {
      totalTransactions += pipe.history.length;
      
      let bStatus = pipe.currentBusinessStatus;
      if (statusSummary[bStatus] !== undefined) {
        statusSummary[bStatus]++;
      }
      
      let cp = pipe.currentProcess || "Chưa có";
      if (!processQueueSummary[cp]) processQueueSummary[cp] = 0;
      processQueueSummary[cp]++;
    }
    
    return {
      totalTransactions: totalTransactions,
      totalPipes: pipeObjects.length,
      statusSummary: statusSummary,
      processQueueSummary: processQueueSummary,
      samplePipes: pipeObjects.slice(0, 5)
    };
  } catch (e) {
    return { success: false, error: e.toString(), stack: e.stack };
  }
}

/**
 * 6. Hàm lấy dữ liệu cho Dashboard (Tạm thời dùng Pipe Engine)
 */
function getDashboardData() {
  const cachedSnapshot = readDashboardSnapshotCache_();
  if (cachedSnapshot) return cachedSnapshot;

  const durableSnapshot = readDashboardSnapshot_();
  if (durableSnapshot) return durableSnapshot;

  return {
    success: false,
    error: "Dashboard snapshot chưa sẵn sàng. Vui lòng chạy refreshDashboardSnapshot_().",
    snapshotMeta: {
      status: "missing"
    }
  };
}

function buildDashboardDataFresh_() {
  try {
    const pipeObjects = buildPipeEngine();
    if (pipeObjects.length === 0) return { success: false, error: "Không có dữ liệu pipe." };
    
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
    
    let xiPinCount = 0;
    let xiBoxCount = 0;
    
    let processPipeLists = {};
    let queueSummary = {};
    
    // Đếm theo Pipe Objects thay vì Transactions
    for (let pipe of pipeObjects) {
      let bStatus = pipe.currentBusinessStatus;
      let isThanhPhamByPressureTest = isThanhPhamKpiPipe(pipe);
      
      if (isThanhPhamByPressureTest) { tpCount++; tpPipes.push(pipe); }
      
      if (bStatus === "LOAI") { hongCount++; hongPipes.push(pipe); }
      else if (bStatus === "CHO_SUA") { csCount++; csPipes.push(pipe); }
      else if (bStatus === "DANG_XU_LY") { dxlCount++; dxlPipes.push(pipe); }
      
      let cp = pipe.currentProcess || "Khác";
      if (!processQueueSummary[cp]) processQueueSummary[cp] = 0;
      processQueueSummary[cp]++;
      
      if (bStatus === "DANG_XU_LY" || bStatus === "CHO_SUA") {
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
      if (bStatus === "THANH_PHAM") { sizeStats[size].tp++; }
      else if (bStatus === "LOAI") { sizeStats[size].hong++; }
      else if (bStatus === "CHO_SUA") { sizeStats[size].cs++; }
      else if (bStatus === "DANG_XU_LY") { sizeStats[size].dxl++; }
      
      let shift = pipe.currentShift || "Khác";
      if (!shiftSummary[shift]) shiftSummary[shift] = 0;
      shiftSummary[shift]++;
      
      let r = (pipe.currentReason || "").toLowerCase();
      if (r.includes("xi pin")) xiPinCount++;
      if (r.includes("xi box")) xiBoxCount++;
      
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
        let bStatus = classifyBusinessStatus(r, "", null);
        let sGroup = bStatus === "THANH_PHAM" ? "tp" : bStatus === "LOAI" ? "hong" : bStatus === "CHO_SUA" ? "cs" : "dxl";
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
    
    // Xử lý dữ liệu Kế hoạch
    const rawPlans = getPlanData();
    let pStats = {
      total: { plan: 0, actual: 0 },
      byDate: {},
      byMonth: {},
      bySize: {}
    };
    
    for (let p of rawPlans) {
       pStats.total.plan += p.qty;
       if (!pStats.byDate[p.date]) pStats.byDate[p.date] = { plan: 0, actual: 0 };
       pStats.byDate[p.date].plan += p.qty;
       if (!pStats.byMonth[p.month]) pStats.byMonth[p.month] = { plan: 0, actual: 0 };
       pStats.byMonth[p.month].plan += p.qty;
       if (p.size) {
         if (!pStats.bySize[p.size]) pStats.bySize[p.size] = { plan: 0, actual: 0 };
         pStats.bySize[p.size].plan += p.qty;
       }
    }
    
    for (let p of tpPipes) {
       // Tim transaction khop KPI Thanh pham trong history.
       let thanhPhamKpiTxn = p.history.find(t => isThanhPhamKpiPipe({ history: [t] }));
       
       if (!thanhPhamKpiTxn) {
           continue; // Không tính vào actual planning nếu không có
       }

       pStats.total.actual++;
       let dateVal = thanhPhamKpiTxn.date;
       let dateStr = "Không rõ";
       let monthStr = "Không rõ";
       if (dateVal instanceof Date) {
          dateStr = dateVal.toLocaleDateString('vi-VN');
          monthStr = (dateVal.getMonth() + 1) + "/" + dateVal.getFullYear();
       } else if (dateVal) {
          dateStr = dateVal.toString().trim();
          monthStr = dateStr;
       }
       
       if (!pStats.byDate[dateStr]) pStats.byDate[dateStr] = { plan: 0, actual: 0 };
       pStats.byDate[dateStr].actual++;
       if (!pStats.byMonth[monthStr]) pStats.byMonth[monthStr] = { plan: 0, actual: 0 };
       pStats.byMonth[monthStr].actual++;
       let sz = p.size || "Khác";
       if (!pStats.bySize[sz]) pStats.bySize[sz] = { plan: 0, actual: 0 };
       pStats.bySize[sz].actual++;
    }
    
    let formatPlan = (obj) => {
        return Object.keys(obj).map(k => {
           let pl = obj[k].plan;
           let ac = obj[k].actual;
           let pct = pl > 0 ? Math.round((ac / pl) * 100) : (ac > 0 ? 100 : 0);
           return { name: k, plan: pl, actual: ac, percent: pct };
        }).sort((a, b) => b.plan - a.plan);
    };
    
    let finalPlanStats = {
       total: { plan: pStats.total.plan, actual: pStats.total.actual, percent: pStats.total.plan > 0 ? Math.round((pStats.total.actual / pStats.total.plan) * 100) : 0 },
       byDate: formatPlan(pStats.byDate),
       byMonth: formatPlan(pStats.byMonth),
       bySize: formatPlan(pStats.bySize)
    };
    
    // Calculate Factory Health & Alerts
    let health = "NORMAL";
    if (hongCount > 0 || csCount > 30) {
      health = "CRITICAL";
    } else if (csCount > 0 || dxlCount > 0) {
      health = "WARNING";
    }
    
    let alerts = [];
    if (csCount > 0) alerts.push(`Có ${csCount} ống đang chờ sửa.`);
    if (hongCount > 0) alerts.push(`Có ${hongCount} ống bị loại.`);
    if (dxlCount > 0) alerts.push(`Có ${dxlCount} ống đang xử lý.`);
    if (xiPinCount > 0) alerts.push(`Phát hiện ${xiPinCount} ống bị lỗi Xì pin.`);
    if (xiBoxCount > 0) alerts.push(`Phát hiện ${xiBoxCount} ống bị lỗi Xì box.`);
    
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

    const data = buildDashboardDataFresh_();
    if (!data || data.success !== true) {
      return { success: false, error: (data && data.error) || "Không tải được dữ liệu dashboard" };
    }

    const processPipeLists = data.processPipeLists || {};
    if (!Object.prototype.hasOwnProperty.call(processPipeLists, normalizedProcessName)) {
      return { success: false, error: "processName không hợp lệ" };
    }

    const pipes = Array.isArray(processPipeLists[normalizedProcessName]) ? processPipeLists[normalizedProcessName] : [];
    const compactPipes = pipes.map(compactDashboardPipeItem_);

    return {
      success: true,
      processName: normalizedProcessName,
      total: compactPipes.length,
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

    const data = buildDashboardDataFresh_();
    if (!data || data.success !== true) {
      return { success: false, error: (data && data.error) || "Không tải được dữ liệu dashboard" };
    }

    const pipes = data.pipeLists && Array.isArray(data.pipeLists.all) ? data.pipeLists.all : [];
    for (let i = 0; i < pipes.length; i++) {
      if (getDashboardPipeNoKey_(pipes[i].pipeNo) === pipeKey) {
        return {
          success: true,
          pipe: compactDashboardPassport_(pipes[i])
        };
      }
    }

    return { success: false, error: "Không tìm thấy ống" };
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

function extractDashboardSnapshot_(fullResponse) {
  fullResponse = fullResponse || {};
  return {
    success: fullResponse.success,
    factoryHealth: fullResponse.factoryHealth,
    alerts: fullResponse.alerts || [],
    planStats: fullResponse.planStats || {},
    kpi: fullResponse.kpi || {},
    processStats: fullResponse.processStats || [],
    queueStats: fullResponse.queueStats || [],
    processQueueSummary: fullResponse.processQueueSummary || {},
    sizeStats: fullResponse.sizeStats || {},
    errorStats: fullResponse.errorStats || [],
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

  const requiredStatusKeys = ["tp", "cs", "hong", "dxl", "all"];
  for (let i = 0; i < requiredStatusKeys.length; i++) {
    if (!Array.isArray(indexPayload.kpiPipeLists[requiredStatusKeys[i]])) {
      return { valid: false, error: "Invalid dashboard drilldown KPI list: " + requiredStatusKeys[i] };
    }
  }
  return { valid: true, error: "" };
}

function validateDashboardDrilldownFreshness_(manifest) {
  if (!manifest || !manifest.builtAt) return { valid: true, error: "" };
  const builtAtMs = Date.parse(manifest.builtAt);
  if (!isFinite(builtAtMs)) {
    return { valid: false, error: "Dashboard drilldown builtAt is invalid" };
  }
  if (Date.now() - builtAtMs > DASHBOARD_DRILLDOWN_MAX_AGE_MS) {
    return { valid: false, error: "Dashboard drilldown snapshot is stale" };
  }
  return { valid: true, error: "" };
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
      index: indexPayload
    };
  } catch (error) {
    return {
      success: false,
      error: "Dashboard drilldown index unavailable: " + error.toString()
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
    Logger.log("DASH_DRILLDOWN refresh ok | " + JSON.stringify(result));
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
    Logger.log("DASH_DRILLDOWN refresh error | " + JSON.stringify(errorMeta));
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
    const metaText = PropertiesService.getScriptProperties()
      .getProperty(DASHBOARD_DRILLDOWN_PROP_META_KEY);
    const lastAttempt = metaText ? JSON.parse(metaText) : {};
    const sizeExceeded = !!lastAttempt.sizeExceeded || manifestResult.code === "sizeExceeded";
    const quotaExceeded = !!lastAttempt.quotaExceeded;
    const limitBlocked = sizeExceeded || quotaExceeded;
    const readError = limitBlocked ? "" : manifestResult.error ||
      (manifestResult.manifest && !durableSnapshot
        ? "Drilldown snapshot chunks or checksum invalid"
        : "");
    const error = limitBlocked
      ? (lastAttempt.error || manifestResult.error || "Dashboard drilldown write blocked by size/quota limit")
      : readError;
    const result = {
      success: !error && !limitBlocked,
      hasSnapshot: !!durableSnapshot,
      hasDurableSnapshot: !!durableSnapshot,
      hasCacheSnapshot: !!cacheSnapshot,
      schemaVersion: DASHBOARD_DRILLDOWN_SCHEMA_VERSION,
      snapshotMeta: selectedSnapshot && selectedSnapshot.snapshotMeta
        ? selectedSnapshot.snapshotMeta
        : {},
      snapshotSource: cacheSnapshot ? "cache" : durableSnapshot ? "durable" : "none",
      lastAttempt: lastAttempt,
      manifest: manifestResult.manifest || {},
      manifestStatus: manifestResult.code,
      counts: durableSnapshot ? getDashboardDrilldownCounts_(durableSnapshot) : {},
      sizeExceeded: sizeExceeded,
      quotaExceeded: quotaExceeded,
      error: error
    };
    Logger.log(JSON.stringify(result));
    return result;
  } catch (error) {
    const result = {
      success: false,
      hasSnapshot: false,
      hasDurableSnapshot: false,
      hasCacheSnapshot: false,
      schemaVersion: DASHBOARD_DRILLDOWN_SCHEMA_VERSION,
      snapshotMeta: {},
      lastAttempt: {},
      manifest: {},
      manifestStatus: "readError",
      counts: {},
      sizeExceeded: false,
      quotaExceeded: false,
      error: error.toString()
    };
    Logger.log(JSON.stringify(result));
    return result;
  }
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
    const fullResponse = buildDashboardDataFresh_();
    if (!fullResponse || fullResponse.success !== true) {
      throw new Error(fullResponse && fullResponse.error ? fullResponse.error : "Dashboard fresh build failed");
    }

    const snapshot = extractDashboardSnapshot_(fullResponse);
    snapshot.snapshotMeta = {
      builtAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      version: version,
      success: true,
      error: ""
    };

    const cacheResult = writeDashboardSnapshotCache_(snapshot);
    const durableResult = writeDashboardSnapshot_(snapshot);
    if (!durableResult.success) {
      throw new Error(durableResult.error || "Dashboard snapshot durable write failed");
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
      durable: durableResult
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
    Logger.log(JSON.stringify(result));
    return result;
  } catch (error) {
    const result = {
      success: false,
      hasSnapshot: false,
      snapshotMeta: {},
      topLevelKeys: [],
      error: error.toString()
    };
    Logger.log(JSON.stringify(result));
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

function getDailyStatusGroup_(transaction) {
  const businessStatus = classifyBusinessStatus(transaction, "", null);
  if (businessStatus === "THANH_PHAM") return "tp";
  if (businessStatus === "LOAI") return "hong";
  if (businessStatus === "CHO_SUA") return "cs";
  return "dxl";
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
    const reportDate = parseDailyReportDate_(dateText);
    if (!reportDate) {
      return { success: false, error: "Ngày báo cáo không hợp lệ." };
    }

    const transactions = getRawTransactions();
    const dailyTransactions = transactions.filter(txn => isSameDashboardDay_(txn.date, reportDate));

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

    const rows = dailyTransactions.map(txn => {
      if (txn.pipeNo) pipeMap[txn.pipeNo] = true;
      totalQty += Number(txn.qty || 0);

      const statusText = normalizeString(txn.status);
      const statusGroup = getDailyStatusGroup_(txn);
      if (statusGroup === "tp" || statusText === "ok" || statusText.includes("dat")) okCount++;
      if (statusGroup === "cs" || statusGroup === "hong") repairOrRejectCount++;

      return {
        date: formatDashboardDate_(txn.date),
        receiveTime: formatDashboardDateTime_(txn.receiveTime),
        shift: txn.shift,
        process: txn.process,
        pipeNo: txn.pipeNo,
        qty: txn.qty,
        size: txn.size,
        status: txn.status,
        statusGroup: statusGroup,
        defectReason: txn.defectReason,
        rig: txn.rig,
        worker1: txn.worker1,
        worker2: txn.worker2,
        rowIdx: txn.rowIdx
      };
    });

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

function getMonthlyReportData(monthText) {
  try {
    const reportMonth = parseMonthlyReportMonth_(monthText);
    if (!reportMonth) {
      return { success: false, error: "Tháng báo cáo không hợp lệ." };
    }

    const transactions = getRawTransactions();
    const monthlyTransactions = transactions.filter(txn => isSameDashboardMonth_(txn.date, reportMonth));
    const plans = getPlanData().filter(plan => {
      return isSameDashboardMonth_(plan.month, reportMonth) || isSameDashboardMonth_(plan.date, reportMonth);
    });

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

    return {
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
  } catch (e) {
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

      if (pipe.currentBusinessStatus === "LOAI") loaiCount++;
      if (pipe.currentBusinessStatus === "CHO_SUA") choSuaCount++;

      return {
        pipeNo: pipe.pipeNo,
        size: pipe.size || "Khác",
        rig: pipe.rig || "Khác",
        businessStatus: pipe.currentBusinessStatus,
        statusGroup: pipe.currentBusinessStatus === "LOAI" ? "hong" : "cs",
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
    let bStatus = p.currentBusinessStatus;
    if (bStatus === "THANH_PHAM") dbTp++;
    else if (bStatus === "LOAI") dbLoai++;
    else if (bStatus === "CHO_SUA") dbCs++;
    else if (bStatus === "DANG_XU_LY") dbDxl++;
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
    
    if (sheetStatus === "THANH_PHAM") shTp++;
    else if (sheetStatus === "LOAI") shLoai++;
    else if (sheetStatus === "CHO_SUA") shCs++;
    else if (sheetStatus === "DANG_XU_LY") shDxl++;
  }
  
  Logger.log("So sánh:");
  Logger.log("1. Tổng số Pipe: Dashboard (" + dbTotal + ") vs Sheet (" + shTotal + ")");
  Logger.log("2. Thành phẩm: Dashboard (" + dbTp + ") vs Sheet (" + shTp + ")");
  Logger.log("3. Loại: Dashboard (" + dbLoai + ") vs Sheet (" + shLoai + ")");
  Logger.log("4. Chờ sửa: Dashboard (" + dbCs + ") vs Sheet (" + shCs + ")");
  Logger.log("5. Đang xử lý: Dashboard (" + dbDxl + ") vs Sheet (" + shDxl + ")");
  
  Logger.log("--- CHI TIẾT CÁC PIPE BỊ LỆCH ---");
  for (let pNo in dashboardMap) {
    let dbPipe = dashboardMap[pNo];
    let shData = sheetFinalStatusMap[pNo];
    if (!shData) continue;
    
    if (dbPipe.currentBusinessStatus !== shData.sheetStatus) {
      Logger.log(
        "PipeNo: " + dbPipe.pipeNo + 
        " | Nguyên nhân: " + (dbPipe.currentReason || "N/A") + 
        " | Business Status: " + dbPipe.currentBusinessStatus + 
        " | Current Process: " + (dbPipe.currentProcess || "N/A")
      );
    }
  }
}

