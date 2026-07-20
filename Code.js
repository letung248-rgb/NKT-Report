const SPREADSHEET_ID = '18UgAbhjXvi0Vi2Jo-ePs7dXMZA7rCtcmeleWGWbtQUY';
const SHEET_NAME = 'Data';
const SHEET_DATA = 'Data';
const SHEET_PLAN = 'Kế hoạch';
const DATA_COLUMN_COUNT = 23;

function doGet(e) {
  const view = e && e.parameter ? String(e.parameter.view || e.parameter.page || '').toLowerCase() : '';
  if (view === 'ke-hoach' || view === 'plan') {
    return renderWebAppHtml_('PlanModule', 'Kế hoạch sản xuất', 'width=device-width, initial-scale=1.0');
  }

  if (view === 'xuat-bao-cao' || view === 'export') {
    return renderWebAppHtml_('Export', 'Xuất biên bản theo Mã bó', 'width=device-width, initial-scale=1.0');
  }

  if (view === 'bao-cao-ngay' || view === 'daily-report') {
    return renderWebAppHtml_('DailyReport', 'Báo cáo ngày', 'width=device-width, initial-scale=1.0');
  }

  if (view === 'bao-cao-thang' || view === 'month-report') {
    return renderWebAppHtml_('MonthReport', 'Báo cáo tháng', 'width=device-width, initial-scale=1.0');
  }

  if (view === 'dashboard-v2') {
    return renderWebAppHtml_('DashboardV2', 'NMS Dashboard v2', 'width=device-width, initial-scale=1.0');
  }

  if (view === '' || view === 'dashboard' || view === 'admin') {
    return renderWebAppHtml_('Dashboard', 'NMS Dashboard', 'width=device-width, initial-scale=1, maximum-scale=1.0, user-scalable=no');
  }

  return renderWebAppHtml_('Index', 'XCO Report 2026', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}

function renderWebAppHtml_(fileName, title, viewport) {
  const template = HtmlService.createTemplateFromFile(fileName);
  template.appUrl = ScriptApp.getService().getUrl();
  return template
    .evaluate()
    .setTitle(title)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', viewport);
}
function getPayloadValue(payload, keys, fallback) {
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return fallback || '';
}

function parseReportDate(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return new Date();
  }

  return date;
}

function parsePipeList(input) {
  const text = String(input || '').trim();
  if (!text) return [];

  const result = [];
  const parts = text.split(/[\n,;]+/);

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part) continue;

    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      const min = Math.min(start, end);
      const max = Math.max(start, end);

      for (let pipe = min; pipe <= max; pipe++) {
        result.push(String(pipe));
      }
    } else {
      result.push(part);
    }
  }

  return result;
}

function submitReportLegacy_(payload) {
  const startTime = Date.now();

  try {
    if (!payload) {
      throw new Error('Không nhận được dữ liệu gửi lên.');
    }

    const pipeNoText = getPayloadValue(payload, ['pipeNo', 'pipeNumber', 'soOng', 'w-so-ong']);
    const process = getPayloadValue(payload, ['process', 'operation', 'nguyenCong', 'w-nguyen-cong']);
    const status = getPayloadValue(payload, ['status', 'tinhTrang', 'w-tinh-trang']);
    const shift = getPayloadValue(payload, ['shift', 'ca', 'w-ca']);
    const entryRound = getPayloadValue(payload, ['entryRound', 'lanNhapXuong', 'w-lan-nhap'], 'Lần 1');
    const defectReason = getPayloadValue(payload, ['defectReason', 'reason', 'nguyenNhanLoai', 'w-nguyen-nhan-loai']);
    const pipeType = getPayloadValue(payload, ['pipeType', 'loaiOng', 'w-loai-ong']);
    const bundleCode = getPayloadValue(payload, ['bundleCode', 'maBo', 'w-ma-bo']);
    const compartment = getPayloadValue(payload, ['compartment', 'khoang', 'w-khoang']);
    const fromWell = getPayloadValue(payload, ['fromWell', 'tuGieng', 'w-tu-gieng']);
    const fromRig = getPayloadValue(payload, ['fromRig', 'tuGian', 'w-tu-gian']);
    const wellProfile = getPayloadValue(payload, ['wellProfile', 'hoSoGieng', 'w-ho-so-gieng']);
    const worker1 = getPayloadValue(payload, ['worker1', 'currentUser', 'nguoiTH1', 'w-nguoi-th-1']);
    const worker2 = getPayloadValue(payload, ['worker2', 'nguoiTH2', 'w-nguoi-th-2']);
    const waterMeter = getPayloadValue(payload, ['waterMeter', 'dongHoNuoc', 'w-dong-ho']);
    const note = getPayloadValue(payload, ['note', 'ghiChu', 'w-ghi-chu']);

    if (!pipeNoText) throw new Error('Thiếu số ống.');
    if (!process) throw new Error('Thiếu nguyên công.');
    if (!status) throw new Error('Thiếu tình trạng ống.');

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Không tìm thấy sheet Data.');

    const pipeList = parsePipeList(pipeNoText);
    if (pipeList.length === 0) {
      throw new Error('Không có số ống hợp lệ để ghi.');
    }

    const now = new Date();
    const reportDate = parseReportDate(getPayloadValue(payload, ['date', 'w-ngay']));
    const washingCount = getPayloadValue(payload, ['washCount', 'soLanRua', 'w-so-lan-rua'], process === 'Rửa ống' ? '1' : '');
    const inputStatus = getPayloadValue(payload, ['inputStatus', 'tinhTrangNhap', 'w-tinh-trang-nhap'], 'Nhập mới');
    const rows = pipeList.map((pipeNo, index) => [
      reportDate,                  // A Ngày
      shift,                       // B Ca
      process,                     // C Nguyên công
      1,                           // D Số lượng ống
      pipeNo,                      // E Số ống chi tiết
      entryRound,                  // F Lần nhập xưởng
      status,                      // G Tình trạng ống
      defectReason,                // H Nguyên nhân loại
      inputStatus,                 // I Tình trạng nhập
      washingCount,                // J Số lần rửa
      waterMeter,                  // K Đồng hồ nước
      pipeType,                    // L Loại ống
      bundleCode,                  // M Mã bó
      compartment,                 // N Khoang
      fromWell,                    // O Từ giếng
      fromRig,                     // P Từ giàn
      wellProfile,                 // Q Hồ sơ giếng
      worker1,                     // R Người TH 1
      worker2,                     // S Người TH 2
      '',                          // T Tình trạng
      now,                         // U Thời gian nhận
      note || 'Số đã nhập BC: ' + pipeNoText, // V Ghi chú
      Utilities.getUuid() + '-' + index       // W ID
    ]);

    const startRow = sheet.getLastRow() + 1;
    const range = sheet.getRange(startRow, 1, rows.length, DATA_COLUMN_COUNT);

    if (startRow > 1) {
      sheet
        .getRange(startRow - 1, 1, 1, DATA_COLUMN_COUNT)
        .copyTo(range, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    }

    range.setValues(rows);
    range.setHorizontalAlignment('center').setVerticalAlignment('middle');
    sheet.getRange(startRow, 1, rows.length, 1).setNumberFormat('dd/MM/yyyy');
    sheet.getRange(startRow, 21, rows.length, 1).setNumberFormat('HH:mm:ss');
    invalidateDashboardDataCache_();

    return {
      success: true,
      message: 'Đã ghi ' + rows.length + ' dòng dữ liệu thành công.',
      rows: rows.length,
      startRow,
      endRow: startRow + rows.length - 1,
      elapsedMs: Date.now() - startTime
    };

  } catch (err) {
    Logger.log('submitReport error: ' + (err && err.stack ? err.stack : err));
    return {
      success: false,
      message: err.message || String(err)
    };
  }
}
function getDailyReportData(filters) {
  try {
    filters = filters || {};
    const reportDate = _dailyReportParseDate_(filters.date);
    if (!reportDate) {
      return {
        success: false,
        message: 'Ngày báo cáo không hợp lệ.'
      };
    }

    const dateKey = _dailyReportDateKey_(reportDate);
    const shiftFilter = _dailyReportTrim_(filters.shift);
    const processFilter = _dailyReportTrim_(filters.process);
    const statusFilter = _dailyReportTrim_(filters.status);
    const transactions = typeof getRawTransactions === 'function' ? getRawTransactions() : [];
    const rows = [];
    const latestByPipe = {};

    for (let i = 0; i < transactions.length; i++) {
      const txn = transactions[i] || {};
      if (_dailyReportDateKey_(txn.date) !== dateKey) continue;
      if (shiftFilter && _dailyReportTrim_(txn.shift) !== shiftFilter) continue;
      if (processFilter && _dailyReportTrim_(txn.process) !== processFilter) continue;
      if (statusFilter && _dailyReportTrim_(txn.status) !== statusFilter) continue;

      const row = _dailyReportBuildRow_(txn);
      rows.push(row);

      if (row.pipeNo) {
        const previous = latestByPipe[row.pipeNo];
        if (!previous || row.rowIdx > previous.rowIdx) latestByPipe[row.pipeNo] = row;
      }
    }

    rows.sort(function(left, right) {
      return left.rowIdx - right.rowIdx;
    });

    return {
      success: true,
      date: dateKey,
      generatedAt: _dailyReportFormatDateTime_(new Date()),
      filters: {
        date: dateKey,
        shift: shiftFilter,
        process: processFilter,
        status: statusFilter
      },
      options: _dailyReportBuildOptions_(transactions, dateKey),
      summary: _dailyReportBuildSummary_(rows, latestByPipe),
      rows: rows
    };
  } catch (error) {
    Logger.log('getDailyReportData error: ' + (error && error.stack ? error.stack : error));
    return {
      success: false,
      message: 'Không tải được Báo cáo ngày: ' + (error && error.message ? error.message : error)
    };
  }
}

function _dailyReportBuildRow_(txn) {
  const statusKey = _dailyReportStatusKey_(txn);
  return {
    date: _dailyReportDateKey_(txn.date),
    shift: _dailyReportTrim_(txn.shift),
    process: _dailyReportTrim_(txn.process),
    pipeNo: _dailyReportTrim_(txn.pipeNo),
    entryNo: _dailyReportTrim_(txn.entryNo),
    status: _dailyReportTrim_(txn.status),
    defectReason: _dailyReportTrim_(txn.defectReason),
    size: _dailyReportTrim_(txn.size),
    bundleCode: _dailyReportTrim_(txn.bundleCode),
    compartment: _dailyReportTrim_(txn.compartment),
    well: _dailyReportTrim_(txn.well),
    rig: _dailyReportTrim_(txn.rig),
    worker1: _dailyReportTrim_(txn.worker1),
    worker2: _dailyReportTrim_(txn.worker2),
    receiveTime: _dailyReportFormatTime_(txn.receiveTime),
    notes: _dailyReportTrim_(txn.notes),
    id: _dailyReportTrim_(txn.id),
    rowIdx: Number(txn.rowIdx) || 0,
    statusKey: statusKey,
    statusLabel: _dailyReportStatusLabel_(statusKey)
  };
}

function _dailyReportBuildSummary_(rows, latestByPipe) {
  const summary = {
    totalPipes: Object.keys(latestByPipe || {}).length,
    totalRows: rows.length,
    thanhPham: 0,
    choSua: 0,
    hong: 0
  };

  Object.keys(latestByPipe || {}).forEach(function(pipeNo) {
    const row = latestByPipe[pipeNo];
    if (row.statusKey === 'tp') summary.thanhPham++;
    if (row.statusKey === 'cs') summary.choSua++;
    if (row.statusKey === 'hong') summary.hong++;
  });

  return summary;
}

function _dailyReportBuildOptions_(transactions, dateKey) {
  const shifts = {};
  const processes = {};
  const statuses = {};

  for (let i = 0; i < transactions.length; i++) {
    const txn = transactions[i] || {};
    if (_dailyReportDateKey_(txn.date) !== dateKey) continue;
    if (_dailyReportTrim_(txn.shift)) shifts[_dailyReportTrim_(txn.shift)] = true;
    if (_dailyReportTrim_(txn.process)) processes[_dailyReportTrim_(txn.process)] = true;
    if (_dailyReportTrim_(txn.status)) statuses[_dailyReportTrim_(txn.status)] = true;
  }

  return {
    shifts: _dailyReportSortedKeys_(shifts),
    processes: _dailyReportSortedKeys_(processes),
    statuses: _dailyReportSortedKeys_(statuses)
  };
}

function _dailyReportStatusKey_(transaction) {
  if (typeof getTransactionDashboardStatusKey_ === 'function') {
    return getTransactionDashboardStatusKey_(transaction, '', {});
  }
  return '';
}

function _dailyReportStatusLabel_(statusKey) {
  if (statusKey === 'tp') return 'Thành phẩm';
  if (statusKey === 'cs') return 'Chờ sửa';
  if (statusKey === 'hong') return 'Hỏng';
  if (statusKey === 'dxl') return 'Đang xử lý';
  return '';
}

function _dailyReportParseDate_(value) {
  const text = _dailyReportTrim_(value);
  if (!text) return new Date();

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);
    if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) return date;
    return null;
  }

  if (typeof parseDashboardDate === 'function') return parseDashboardDate(text);
  return null;
}

function _dailyReportDateKey_(value) {
  const date = value instanceof Date
    ? value
    : (typeof parseDashboardDate === 'function' ? parseDashboardDate(value) : null);
  if (!date || isNaN(date.getTime())) return '';
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function _dailyReportFormatTime_(value) {
  const date = value instanceof Date ? value : null;
  if (!date || isNaN(date.getTime())) return _dailyReportTrim_(value);
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'HH:mm:ss');
}

function _dailyReportFormatDateTime_(value) {
  return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function _dailyReportSortedKeys_(map) {
  return Object.keys(map || {}).sort(function(left, right) {
    return left.localeCompare(right);
  });
}

function _dailyReportTrim_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}
function getReportMonthData(filters) {
  try {
    filters = filters || {};
    const monthInfo = _monthReportParseMonth_(filters.month);
    if (!monthInfo) {
      return { success: false, message: 'Tháng báo cáo không hợp lệ.' };
    }

    const monthKey = _monthReportMonthKey_(monthInfo);
    const sizeFilter = _monthReportTrim_(filters.size);
    const processFilter = _monthReportTrim_(filters.process);
    const shiftFilter = _monthReportTrim_(filters.shift);
    const statusFilter = _monthReportTrim_(filters.status);
    const transactions = typeof getRawTransactions === 'function' ? getRawTransactions() : [];
    const monthlyTransactions = [];

    for (let i = 0; i < transactions.length; i++) {
      const txn = transactions[i] || {};
      if (!_monthReportIsSameMonth_(txn.date, monthInfo)) continue;
      if (sizeFilter && _monthReportTrim_(txn.size) !== sizeFilter) continue;
      if (processFilter && _monthReportTrim_(txn.process) !== processFilter) continue;
      if (shiftFilter && _monthReportTrim_(txn.shift) !== shiftFilter) continue;
      monthlyTransactions.push(txn);
    }

    const pipeObjects = typeof buildPipeEngine === 'function' ? buildPipeEngine(monthlyTransactions) : [];
    const pipeStatusByNo = _monthReportBuildPipeStatusMap_(pipeObjects);
    let rows = monthlyTransactions.map(function(txn) {
      return _monthReportBuildRow_(txn, pipeStatusByNo);
    });

    if (statusFilter) {
      rows = rows.filter(function(row) { return row.statusKey === statusFilter; });
    }

    rows.sort(function(left, right) {
      return left.rowIdx - right.rowIdx;
    });

    const filteredPipeObjects = _monthReportFilterPipesForRows_(pipeObjects, rows);
    const planInfo = _monthReportGetPlanInfo_(monthKey, sizeFilter);

    return {
      success: true,
      month: monthKey,
      monthLabel: _monthReportMonthLabel_(monthInfo),
      generatedAt: _monthReportFormatDateTime_(new Date()),
      filters: {
        month: monthKey,
        size: sizeFilter,
        process: processFilter,
        shift: shiftFilter,
        status: statusFilter
      },
      options: _monthReportBuildOptions_(transactions, monthInfo, pipeStatusByNo),
      summary: _monthReportBuildSummary_(rows, filteredPipeObjects, planInfo),
      groups: {
        bySize: _monthReportSummarizeRows_(rows, 'size'),
        byProcess: _monthReportSummarizeRows_(rows, 'process'),
        byShift: _monthReportSummarizeRows_(rows, 'shift'),
        byStatus: _monthReportSummarizeRows_(rows, 'statusLabel')
      },
      planRows: planInfo.rows,
      snapshotMeta: _monthReportReadSnapshotMeta_(),
      rows: rows
    };
  } catch (error) {
    Logger.log('getReportMonthData error: ' + (error && error.stack ? error.stack : error));
    return {
      success: false,
      message: 'Không tải được Báo cáo tháng: ' + (error && error.message ? error.message : error)
    };
  }
}

function _monthReportBuildPipeStatusMap_(pipeObjects) {
  const map = {};
  (Array.isArray(pipeObjects) ? pipeObjects : []).forEach(function(pipe) {
    const pipeNo = _monthReportTrim_(pipe && pipe.pipeNo);
    if (!pipeNo) return;
    const statusKey = typeof getPipeDashboardStatusKey_ === 'function' ? getPipeDashboardStatusKey_(pipe) : '';
    map[pipeNo] = {
      statusKey: statusKey,
      statusLabel: _monthReportStatusLabel_(statusKey)
    };
  });
  return map;
}

function _monthReportBuildRow_(txn, pipeStatusByNo) {
  const pipeNo = _monthReportTrim_(txn.pipeNo);
  const statusMeta = pipeStatusByNo[pipeNo] || { statusKey: '', statusLabel: '' };
  return {
    date: _monthReportDateKey_(txn.date),
    shift: _monthReportTrim_(txn.shift),
    process: _monthReportTrim_(txn.process),
    pipeNo: pipeNo,
    entryNo: _monthReportTrim_(txn.entryNo),
    status: _monthReportTrim_(txn.status),
    defectReason: _monthReportTrim_(txn.defectReason),
    size: _monthReportTrim_(txn.size),
    bundleCode: _monthReportTrim_(txn.bundleCode),
    compartment: _monthReportTrim_(txn.compartment),
    well: _monthReportTrim_(txn.well),
    rig: _monthReportTrim_(txn.rig),
    worker1: _monthReportTrim_(txn.worker1),
    worker2: _monthReportTrim_(txn.worker2),
    receiveTime: _monthReportFormatTime_(txn.receiveTime),
    notes: _monthReportTrim_(txn.notes),
    id: _monthReportTrim_(txn.id),
    rowIdx: Number(txn.rowIdx) || 0,
    statusKey: statusMeta.statusKey,
    statusLabel: statusMeta.statusLabel
  };
}

function _monthReportFilterPipesForRows_(pipeObjects, rows) {
  const included = {};
  rows.forEach(function(row) {
    if (row.pipeNo) included[row.pipeNo] = true;
  });
  return (Array.isArray(pipeObjects) ? pipeObjects : []).filter(function(pipe) {
    return included[_monthReportTrim_(pipe && pipe.pipeNo)] === true;
  });
}

function _monthReportBuildSummary_(rows, pipeObjects, planInfo) {
  const summary = {
    totalRows: rows.length,
    totalPipes: pipeObjects.length,
    thanhPham: 0,
    choSua: 0,
    hong: 0,
    planInspection: planInfo.hasPlan ? planInfo.inspection : null,
    planFinished: planInfo.hasPlan ? planInfo.finished : null
  };

  pipeObjects.forEach(function(pipe) {
    const statusKey = typeof getPipeDashboardStatusKey_ === 'function' ? getPipeDashboardStatusKey_(pipe) : '';
    if (statusKey === 'tp') summary.thanhPham++;
    if (statusKey === 'cs') summary.choSua++;
    if (statusKey === 'hong') summary.hong++;
  });

  return summary;
}

function _monthReportGetPlanInfo_(monthKey, sizeFilter) {
  const result = {
    hasPlan: false,
    inspection: 0,
    finished: 0,
    rows: []
  };

  if (typeof getPlanModuleData !== 'function') return result;

  try {
    const response = getPlanModuleData();
    const monthly = response && response.success === true && response.data && Array.isArray(response.data.monthly)
      ? response.data.monthly
      : [];

    monthly.forEach(function(plan) {
      if (_monthReportTrim_(plan.thoiGian) !== monthKey) return;
      if (sizeFilter && _monthReportTrim_(plan.size) !== sizeFilter) return;
      const inspection = Number(plan.kiemTra || 0);
      const finished = Number(plan.thanhPham || 0);
      result.hasPlan = true;
      result.inspection += inspection;
      result.finished += finished;
      result.rows.push({
        size: _monthReportTrim_(plan.size) || 'Khác',
        inspection: inspection,
        finished: finished,
        note: _monthReportTrim_(plan.ghiChu),
        updatedBy: _monthReportTrim_(plan.nguoiCapNhat),
        updatedAt: _monthReportTrim_(plan.capNhatLuc)
      });
    });
  } catch (error) {
    Logger.log('month report plan read skipped: ' + error);
  }

  result.rows.sort(function(left, right) {
    return left.size.localeCompare(right.size);
  });
  return result;
}

function _monthReportBuildOptions_(transactions, monthInfo, pipeStatusByNo) {
  const sizes = {};
  const processes = {};
  const shifts = {};
  const statuses = {};

  for (let i = 0; i < transactions.length; i++) {
    const txn = transactions[i] || {};
    if (!_monthReportIsSameMonth_(txn.date, monthInfo)) continue;
    if (_monthReportTrim_(txn.size)) sizes[_monthReportTrim_(txn.size)] = true;
    if (_monthReportTrim_(txn.process)) processes[_monthReportTrim_(txn.process)] = true;
    if (_monthReportTrim_(txn.shift)) shifts[_monthReportTrim_(txn.shift)] = true;
    const pipeNo = _monthReportTrim_(txn.pipeNo);
    const status = pipeStatusByNo[pipeNo];
    if (status && status.statusKey) statuses[status.statusKey] = status.statusLabel;
  }

  return {
    sizes: _monthReportSortedKeys_(sizes),
    processes: _monthReportSortedKeys_(processes),
    shifts: _monthReportSortedKeys_(shifts),
    statuses: Object.keys(statuses).sort().map(function(key) {
      return { value: key, label: statuses[key] };
    })
  };
}

function _monthReportSummarizeRows_(rows, field) {
  const map = {};
  rows.forEach(function(row) {
    const name = _monthReportTrim_(row[field]) || 'Khác';
    if (!map[name]) map[name] = { name: name, rows: 0, pipes: {} };
    map[name].rows++;
    if (row.pipeNo) map[name].pipes[row.pipeNo] = true;
  });

  return Object.keys(map).map(function(name) {
    return {
      name: name,
      rows: map[name].rows,
      pipes: Object.keys(map[name].pipes).length
    };
  }).sort(function(left, right) {
    if (right.pipes !== left.pipes) return right.pipes - left.pipes;
    return right.rows - left.rows;
  });
}

function _monthReportReadSnapshotMeta_() {
  if (typeof readDashboardSnapshot_ !== 'function') return {};
  try {
    const snapshot = readDashboardSnapshot_();
    return snapshot && snapshot.snapshotMeta ? snapshot.snapshotMeta : {};
  } catch (error) {
    return {};
  }
}

function _monthReportParseMonth_(value) {
  const text = _monthReportTrim_(value);
  const match = text.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!year || month < 1 || month > 12) return null;
  return { year: year, monthIndex: month - 1 };
}

function _monthReportIsSameMonth_(value, monthInfo) {
  const date = _monthReportParseDate_(value);
  return !!date && date.getFullYear() === monthInfo.year && date.getMonth() === monthInfo.monthIndex;
}

function _monthReportParseDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof parseDashboardDate === 'function') return parseDashboardDate(value);
  return null;
}

function _monthReportMonthKey_(monthInfo) {
  return monthInfo.year + '-' + String(monthInfo.monthIndex + 1).padStart(2, '0');
}

function _monthReportMonthLabel_(monthInfo) {
  return String(monthInfo.monthIndex + 1).padStart(2, '0') + '/' + monthInfo.year;
}

function _monthReportDateKey_(value) {
  const date = _monthReportParseDate_(value);
  if (!date) return '';
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function _monthReportFormatTime_(value) {
  const date = value instanceof Date ? value : null;
  if (!date || isNaN(date.getTime())) return _monthReportTrim_(value);
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'HH:mm:ss');
}

function _monthReportFormatDateTime_(value) {
  return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function _monthReportStatusLabel_(statusKey) {
  if (statusKey === 'tp') return 'Thành phẩm';
  if (statusKey === 'cs') return 'Chờ sửa';
  if (statusKey === 'hong') return 'Hỏng';
  if (statusKey === 'dxl') return 'Đang xử lý';
  return '';
}

function _monthReportSortedKeys_(map) {
  return Object.keys(map || {}).sort(function(left, right) {
    return left.localeCompare(right);
  });
}

function _monthReportTrim_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}
