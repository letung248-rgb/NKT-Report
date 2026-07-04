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
    let dateA = new Date(a.date).getTime() || 0;
    let dateB = new Date(b.date).getTime() || 0;
    if (dateA !== dateB) return dateA - dateB;
    
    let timeA = new Date(a.receiveTime).getTime() || 0;
    let timeB = new Date(b.receiveTime).getTime() || 0;
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
      let dateA = new Date(a.date).getTime() || 0;
      let dateB = new Date(b.date).getTime() || 0;
      if (dateA !== dateB) return dateA - dateB;
      
      let timeA = new Date(a.receiveTime).getTime() || 0;
      let timeB = new Date(b.receiveTime).getTime() || 0;
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
      
      if (bStatus === "THANH_PHAM") { tpCount++; tpPipes.push(pipe); }
      else if (bStatus === "LOAI") { hongCount++; hongPipes.push(pipe); }
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
      let dateA = new Date(a.date).getTime() || 0;
      let dateB = new Date(b.date).getTime() || 0;
      if (dateA !== dateB) return dateB - dateA; // Giảm dần
      
      let timeA = new Date(a.receiveTime).getTime() || 0;
      let timeB = new Date(b.receiveTime).getTime() || 0;
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
       // Tìm transaction ép thủy lực đạt trong history
       let epThuyLucDatTxn = p.history.find(t => {
           let pName = normalizeString(t.process);
           let sName = normalizeString(t.status);
           return pName.includes("ep thuy luc") && (sName.includes("dat") || sName.includes("thanh pham"));
       });
       
       if (!epThuyLucDatTxn) {
           continue; // Không tính vào actual planning nếu không có
       }

       pStats.total.actual++;
       let dateVal = epThuyLucDatTxn.date;
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
      let dateA = new Date(a.date).getTime() || 0;
      let dateB = new Date(b.date).getTime() || 0;
      if (dateA !== dateB) return dateA - dateB;
      
      let timeA = new Date(a.receiveTime).getTime() || 0;
      let timeB = new Date(b.receiveTime).getTime() || 0;
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

