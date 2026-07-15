const SPREADSHEET_ID = '18UgAbhjXvi0Vi2Jo-ePs7dXMZA7rCtcmeleWGWbtQUY';
const SHEET_NAME = 'Data';
const SHEET_DATA = 'Data';
const SHEET_PLAN = 'Kế hoạch';
const DATA_COLUMN_COUNT = 23;

function doGet(e) {
  const view = e && e.parameter ? String(e.parameter.view || e.parameter.page || '').toLowerCase() : '';
  if (view === 'ke-hoach' || view === 'plan') {
    return HtmlService
      .createHtmlOutputFromFile('PlanModule')
      .setTitle('Kế hoạch sản xuất')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  }

  if (view === 'xuat-bao-cao' || view === 'export') {
    return HtmlService
      .createHtmlOutputFromFile('Export')
      .setTitle('Xuất biên bản theo Mã bó')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  }

  if (view === 'dashboard-v2') {
    return HtmlService
      .createHtmlOutputFromFile('DashboardV2')
      .setTitle('NMS Dashboard v2')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  }

  if (view === 'dashboard' || view === 'admin') {
    return HtmlService
      .createHtmlOutputFromFile('Dashboard')
      .setTitle('NMS Dashboard')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1.0, user-scalable=no');
  }

  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('XCO Report 2026')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
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
