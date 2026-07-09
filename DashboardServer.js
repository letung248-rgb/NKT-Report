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
    return (pName.includes("ep thuy luc") && sName === "ok") || note.includes("ong rua lai khong ep");
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

