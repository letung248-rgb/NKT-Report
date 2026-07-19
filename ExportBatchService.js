const EXPORT_BATCH_XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EXPORT_BATCH_LOOKUP_SHEET_FALLBACK = 'SL nhận từ KH';
const EXPORT_BATCH_HEADER_SCAN_ROWS = 20;

/**
 * Chạy thủ công trong Apps Script Editor để cấp quyền Drive cho Export.
 * Tạo rồi đưa file kiểm tra rỗng vào thùng rác để xác nhận quyền ghi.
 */
function authorizeDriveForExport() {
  var rootFolder = DriveApp.getRootFolder();
  var writeCheckFile = DriveApp.createFile('NKT_EXPORT_AUTH_CHECK.txt', '');
  var writeCheckFileId = writeCheckFile.getId();
  writeCheckFile.setTrashed(true);

  return {
    success: true,
    rootFolderId: rootFolder.getId(),
    writeCheckFileId: writeCheckFileId
  };
}

const EXPORT_BATCH_REQUIRED_METADATA = [
  { key: 'lsx', label: 'LSX' },
  { key: 'customer', label: 'Khách hàng' },
  { key: 'lot', label: 'Lô' },
  { key: 'pipeType', label: 'Loại ống' },
  { key: 'origin', label: 'Nguồn gốc ống' },
  { key: 'nominalThickness', label: 'Độ dày danh nghĩa' },
  { key: 'receiptNo', label: 'Số phiếu nhận' },
  { key: 'receiptDate', label: 'Ngày nhận' }
];

/**
 * Danh sách biên bản được tạo từ Mã bó tại nguyên công Đóng gói.
 * Chỉ dùng buildPipeEngine/currentBusinessStatus làm nguồn trạng thái.
 */
function getExportBundleList(filters) {
  try {
    const normalizedFilters = exportBatchNormalizeFilters_(filters);
    const spreadsheet = exportBatchGetSpreadsheet_();
    const metadataIndex = exportBatchReadMetadataIndex_(spreadsheet);
    const reports = exportBatchBuildReports_(buildPipeEngine(), metadataIndex);
    exportBatchApplyTemplateReadiness_(reports);
    const items = reports
      .filter(report => exportBatchMatchesFilters_(report, normalizedFilters))
      .sort(exportBatchCompareReports_)
      .map(exportBatchToListItem_);

    return {
      success: true,
      filters: normalizedFilters,
      items: items
    };
  } catch (error) {
    return {
      success: false,
      error: exportBatchErrorMessage_(error)
    };
  }
}

/**
 * Xuất một file XLSX nhiều sheet. Toàn bộ lựa chọn phải pass preflight trước
 * khi tạo file tạm, vì vậy không có output dở dang.
 */
function exportBatchBundleReports(selections) {
  let temporarySpreadsheet = null;
  let outputFile = null;

  try {
    const normalizedSelections = exportBatchNormalizeSelections_(selections);
    const spreadsheet = exportBatchGetSpreadsheet_();
    const metadataIndex = exportBatchReadMetadataIndex_(spreadsheet);
    const allReports = exportBatchBuildReports_(buildPipeEngine(), metadataIndex);
    const reports = exportBatchResolveSelections_(allReports, normalizedSelections);
    const templates = exportBatchLoadTemplates_(reports);

    temporarySpreadsheet = SpreadsheetApp.create(
      'TMP_Bien_ban_Ma_bo_' + Utilities.formatDate(new Date(), exportBatchTimeZone_(), 'yyyyMMdd_HHmmss')
    );
    const defaultSheet = temporarySpreadsheet.getSheets()[0];
    const usedSheetNames = {};

    reports.forEach(report => {
      const config = EXPORT_TEMPLATE_CONFIG[report.businessStatus];
      const templateSheet = templates[report.businessStatus].getSheetByName(config.sheetName);
      const outputSheet = templateSheet.copyTo(temporarySpreadsheet);
      const sheetName = exportBatchCreateSheetName_(report.bundleCode, report.businessStatus, usedSheetNames);

      outputSheet.setName(sheetName);
      report.sheetName = sheetName;
      exportBatchWriteReport_(outputSheet, report, config);
    });

    if (defaultSheet) temporarySpreadsheet.deleteSheet(defaultSheet);
    SpreadsheetApp.flush();

    const fileName = exportBatchCreateFileName_();
    const xlsxBlob = exportBatchDownloadXlsx_(temporarySpreadsheet.getId(), fileName);

    outputFile = DriveApp.createFile(xlsxBlob);
    outputFile.setName(fileName);
    exportBatchTrashFile_(temporarySpreadsheet.getId());
    temporarySpreadsheet = null;

    return {
      success: true,
      fileName: fileName,
      fileId: outputFile.getId(),
      url: outputFile.getUrl(),
      sheetCount: reports.length,
      reports: reports.map(report => ({
        bundleCode: report.bundleCode,
        businessStatus: report.businessStatus,
        sheetName: report.sheetName,
        pipeCount: report.pipes.length
      }))
    };
  } catch (error) {
    if (outputFile) exportBatchTrashFile_(outputFile.getId());
    if (temporarySpreadsheet) exportBatchTrashFile_(temporarySpreadsheet.getId());

    return {
      success: false,
      error: exportBatchErrorMessage_(error)
    };
  }
}

function exportBatchDownloadXlsx_(spreadsheetId, fileName) {
  const response = UrlFetchApp.fetch(
    'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(spreadsheetId) + '/export?format=xlsx',
    {
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
      },
      muteHttpExceptions: true
    }
  );
  const responseCode = response.getResponseCode();

  if (responseCode < 200 || responseCode >= 300) {
    throw new Error('Không thể xuất file XLSX (HTTP ' + responseCode + ').');
  }

  return response.getBlob().setContentType(EXPORT_BATCH_XLSX_MIME).setName(fileName);
}

function exportBatchNormalizeFilters_(filters) {
  const source = filters || {};
  const businessStatus = String(source.businessStatus || 'ALL').trim().toUpperCase();
  const date = String(source.date || '').trim();
  const month = String(source.month || '').trim();
  const states = getBusinessStates_();

  return {
    businessStatus: businessStatus === states.THANH_PHAM || businessStatus === states.LOAI ? businessStatus : 'ALL',
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
    month: /^\d{4}-\d{2}$/.test(month) ? month : '',
    query: String(source.query || '').trim()
  };
}

function exportBatchNormalizeSelections_(selections) {
  if (!Array.isArray(selections) || selections.length === 0) {
    throw new Error('Chưa chọn biên bản để xuất.');
  }

  const normalized = [];
  const seen = {};

  selections.forEach(selection => {
    const bundleCode = exportBatchText_(selection && selection.bundleCode);
    if (!bundleCode) throw new Error('Thiếu mã bó, không thể xuất biên bản.');

    const businessStatus = String(selection && selection.businessStatus || '').trim().toUpperCase();
    if (!isBusinessFinishedState_(businessStatus) && !isBusinessScrapState_(businessStatus)) {
      throw new Error('Loại biên bản không hợp lệ cho Mã bó ' + bundleCode + '.');
    }

    const key = exportBatchBundleKey_(bundleCode) + '|' + businessStatus;
    if (seen[key]) return;
    seen[key] = true;
    normalized.push({ bundleCode: bundleCode, bundleKey: exportBatchBundleKey_(bundleCode), businessStatus: businessStatus });
  });

  return normalized;
}

function exportBatchResolveSelections_(allReports, selections) {
  const reportMap = {};
  (allReports || []).forEach(report => {
    reportMap[report.bundleKey + '|' + report.businessStatus] = report;
  });

  const reports = [];
  const issues = [];

  selections.forEach(selection => {
    const key = selection.bundleKey + '|' + selection.businessStatus;
    const report = reportMap[key];

    if (!report) {
      issues.push('Không tìm thấy biên bản phù hợp cho Mã bó ' + selection.bundleCode + '.');
      return;
    }
    if (!report.ready) {
      issues.push('Mã bó ' + report.bundleCode + ': ' +
        (report.blockingIssues || report.issues).join('; ') + '.');
      return;
    }
    reports.push(report);
  });

  if (issues.length > 0) throw new Error(issues.join('\n'));
  if (reports.length === 0) throw new Error('Không có biên bản hợp lệ để xuất.');

  return reports;
}

function exportBatchBuildReports_(pipes, metadataIndex) {
  const groups = {};

  (pipes || []).forEach(pipe => {
    const packing = exportBatchCurrentPackingTransaction_(pipe);
    if (!packing) return;

    const bundleCode = exportBatchText_(packing.bundleCode);
    if (!bundleCode) return;

    const bundleKey = exportBatchBundleKey_(bundleCode);
    if (!bundleKey) return;

    if (!groups[bundleKey]) {
      groups[bundleKey] = {
        bundleCode: bundleCode,
        bundleKey: bundleKey,
        bundleVariants: {},
        pipes: [],
        statuses: {},
        packingDates: {},
        packingDateValue: null
      };
    }

    const group = groups[bundleKey];
    group.bundleVariants[bundleCode] = true;
    group.pipes.push(pipe);
    group.statuses[getPipeExportBusinessState_(pipe) || ''] = true;

    const packingDate = exportBatchDateKey_(packing.date);
    if (packingDate) {
      group.packingDates[packingDate] = true;
      if (!group.packingDateValue) group.packingDateValue = packing.date;
    }
  });

  return Object.keys(groups).map(groupKey => {
    const group = groups[groupKey];
    const statuses = Object.keys(group.statuses).filter(Boolean);
    const finalStatuses = statuses.filter(status => isBusinessFinishedState_(status) || isBusinessScrapState_(status));
    const issues = [];
    const blockingIssues = [];

    if (Object.keys(group.bundleVariants).length > 1) {
      issues.push('Mã bó không nhất quán trong dữ liệu Đóng gói');
    }
    if (group.pipes.length === 0) blockingIssues.push('Không có dữ liệu ống trong Mã bó');
    if (group.pipes.length > EXPORT_MAX_ROWS) {
      blockingIssues.push('Có ' + group.pipes.length + ' ống, vượt giới hạn ' + EXPORT_MAX_ROWS + ' ống');
    }
    if (Object.keys(group.packingDates).length === 0) issues.push('Thiếu ngày Đóng gói');
    if (Object.keys(group.packingDates).length > 1) issues.push('Có nhiều ngày Đóng gói');
    if (finalStatuses.length > 1) {
      issues.push('Mã bó vừa có thành phẩm vừa có ống hỏng');
    } else if (statuses.length > 1) {
      issues.push('Mã bó có trạng thái hiện tại không đồng nhất');
    }
    const hasSingleFinalStatus = finalStatuses.length === 1 && statuses.length === 1;
    if (!hasSingleFinalStatus) blockingIssues.push('Không xác định được loại biên bản');
    const businessStatus = hasSingleFinalStatus ? finalStatuses[0] : 'INVALID';
    const report = {
      bundleCode: group.bundleCode,
      bundleKey: group.bundleKey,
      businessStatus: businessStatus,
      pipes: group.pipes.sort(exportBatchComparePipes_),
      packingDate: Object.keys(group.packingDates)[0] || '',
      packingDateValue: group.packingDateValue,
      issues: issues,
      blockingIssues: blockingIssues,
      metadataIssues: []
    };

    report.metadata = exportBatchResolveMetadata_(metadataIndex[group.bundleKey], report);
    if (hasSingleFinalStatus) {
      report.metadataIssues = exportBatchMissingMetadata_(report.metadata);
    }
    report.ready = report.blockingIssues.length === 0;
    return report;
  }).filter(Boolean);
}

function exportBatchCurrentPackingTransaction_(pipe) {
  const transactions = exportCurrentEntryTransactions_(pipe);

  for (let i = transactions.length - 1; i >= 0; i--) {
    const transaction = transactions[i] || {};
    if (
      normalizeString(transaction.process).includes('dong goi') &&
      exportBatchText_(transaction.bundleCode)
    ) {
      return transaction;
    }
  }

  return null;
}

function exportBatchResolveMetadata_(source, report) {
  const metadata = source ? exportBatchCopyMetadata_(source) : {};
  const sizes = exportBatchUniqueTexts_(report.pipes.map(pipe => pipe.size));
  const wells = exportBatchUniqueTexts_(report.pipes.map(pipe => pipe.well));
  const rigs = exportBatchUniqueTexts_(report.pipes.map(pipe => pipe.rig));
  const profiles = exportBatchUniqueTexts_(report.pipes.map(pipe => pipe.wellProfile));

  metadata.pipeType = metadata.pipeType || sizes.join(', ');
  metadata.origin = metadata.origin || wells.join(', ') || rigs.join(', ') || profiles.join(', ');
  metadata.executionDate = report.packingDateValue || report.packingDate;
  metadata.bundleCode = report.bundleCode;
  return metadata;
}

function exportBatchCopyMetadata_(source) {
  const result = {};
  [
    'requestNo', 'lsx', 'customer', 'lot', 'pipeType', 'origin', 'nominalThickness',
    'receiptNo', 'receiptDate', 'cableInfo', 'duplicateFields'
  ].forEach(key => {
    result[key] = source[key] || '';
  });
  return result;
}

function exportBatchMissingMetadata_(metadata) {
  const missing = EXPORT_BATCH_REQUIRED_METADATA
    .filter(field => !exportBatchText_(metadata[field.key]))
    .map(field => 'Thiếu ' + field.label);

  if (metadata.duplicateFields && metadata.duplicateFields.length > 0) {
    missing.push('Metadata không nhất quán: ' + metadata.duplicateFields.join(', '));
  }
  return missing;
}

function exportBatchMatchesFilters_(report, filters) {
  if (filters.businessStatus !== 'ALL' && report.businessStatus !== filters.businessStatus) return false;
  if (filters.date && report.packingDate !== filters.date) return false;
  if (filters.month && report.packingDate.indexOf(filters.month) !== 0) return false;

  const query = exportBatchBundleKey_(filters.query);
  if (!query) return true;

  const searchable = [
    report.bundleCode,
    report.metadata.lsx,
    report.metadata.pipeType
  ].join(' ');
  return exportBatchBundleKey_(searchable).indexOf(query) !== -1;
}

function exportBatchCompareReports_(left, right) {
  return String(right.packingDate || '').localeCompare(String(left.packingDate || '')) ||
    String(left.bundleCode || '').localeCompare(String(right.bundleCode || ''), 'vi', { numeric: true });
}

function exportBatchComparePipes_(left, right) {
  return String(left.pipeNo || '').localeCompare(String(right.pipeNo || ''), 'vi', { numeric: true });
}

function exportBatchToListItem_(report) {
  const isFinished = isBusinessFinishedState_(report.businessStatus);
  const isRejected = isBusinessScrapState_(report.businessStatus);
  const metadataIssues = report.metadataIssues || [];
  const blockingIssues = report.blockingIssues || [];
  const hasDataError = !report.ready;

  return {
    bundleCode: report.bundleCode,
    businessStatus: report.businessStatus,
    businessStatusGroup: isFinished ? 'tp' : isRejected ? 'hong' : 'invalid',
    isFinished: isFinished,
    isRejected: isRejected,
    businessStatusLabel: isFinished ? 'Thành phẩm' : isRejected ? 'Ống hỏng' : 'Không xác định',
    packingDate: report.packingDate,
    pipeCount: report.pipes.length,
    size: report.metadata.pipeType || '',
    lsx: report.metadata.lsx || '',
    ready: report.ready,
    status: hasDataError ? 'LOI' : metadataIssues.length > 0 ? 'THIEU_THONG_TIN' : 'CHO_XUAT',
    statusLabel: hasDataError ? 'Không thể xuất' : metadataIssues.length > 0 ? 'Thiếu thông tin' : 'Chờ xuất',
    issues: blockingIssues.concat(report.issues, metadataIssues),
    metadataIssues: metadataIssues.slice()
  };
}

function exportBatchApplyTemplateReadiness_(reports) {
  const templateErrors = {};

  (reports || []).forEach(report => {
    if (!report.ready || templateErrors[report.businessStatus] !== undefined) return;
    try {
      exportBatchOpenTemplate_(report.businessStatus);
      templateErrors[report.businessStatus] = '';
    } catch (error) {
      templateErrors[report.businessStatus] = 'Template lỗi: ' + exportBatchErrorMessage_(error);
    }
  });

  (reports || []).forEach(report => {
    const templateError = templateErrors[report.businessStatus];
    if (!templateError) return;
    report.blockingIssues.push(templateError);
    report.ready = false;
  });
}

function exportBatchLoadTemplates_(reports) {
  const templates = {};
  const errors = [];

  (reports || []).forEach(report => {
    const businessStatus = report.businessStatus;
    if (templates[businessStatus]) return;

    try {
      templates[businessStatus] = exportBatchOpenTemplate_(businessStatus);
    } catch (error) {
      errors.push('Không thể mở template cho Mã bó ' + report.bundleCode + ': ' + exportBatchErrorMessage_(error));
    }
  });

  if (errors.length > 0) throw new Error(errors.join('\n'));
  return templates;
}

function exportBatchOpenTemplate_(businessStatus) {
  const config = EXPORT_TEMPLATE_CONFIG[businessStatus];
  if (!config || !config.templateId || config.templateId.indexOf('PASTE_') === 0) {
    throw new Error('Không có cấu hình template.');
  }

  const template = SpreadsheetApp.openById(config.templateId);
  if (!template.getSheetByName(config.sheetName)) {
    throw new Error('Không tìm thấy sheet template ' + config.sheetName + '.');
  }
  return template;
}

function exportBatchWriteReport_(sheet, report, config) {
  const pipes = report.pipes;
  const metadata = report.metadata;

  sheet.showRows(EXPORT_DATA_START_ROW, EXPORT_MAX_ROWS);
  sheet.getRange(EXPORT_DATA_START_ROW, 1, EXPORT_MAX_ROWS, 3).clearContent();
  sheet.getRange(EXPORT_DATA_START_ROW, 5, EXPORT_MAX_ROWS, 10).clearContent();
  exportBatchWriteHeader_(sheet, report, config);

  const leftRows = [];
  const rightRows = [];

  pipes.forEach((pipe, index) => {
    const transactions = exportCurrentEntryTransactions_(pipe);
    const inspection = exportLatestTransaction_(transactions, 'dau vao');
    const washing = exportLatestTransaction_(transactions, 'rua ong');
    const drift = exportLatestTransaction_(transactions, 'thong nong');
    const ndt = exportLatestTransaction_(transactions, 'ndt');
    const threadInspection = exportLatestTransaction_(transactions, 'lam sach ren');
    const threadRepair = exportLatestTransaction_(transactions, 'tien ren');
    const couplingRepair = exportLatestTransaction_(transactions, 'thay coupling');
    const pressureTest = exportLatestTransaction_(transactions, 'ep thuy luc');
    const packing = exportLatestTransaction_(transactions, 'dong goi');

    leftRows.push([index + 1, pipe.pipeNo || '', exportStatusMark_(inspection)]);
    rightRows.push([
      exportStatusMark_(washing),
      exportStatusMark_(drift),
      exportStatusMark_(ndt),
      exportStatusMark_(threadInspection),
      exportStatusMark_(threadRepair),
      exportStatusMark_(threadInspection),
      exportStatusMark_(couplingRepair),
      exportStatusMark_(pressureTest),
      exportStatusMark_(packing),
      isBusinessScrapState_(report.businessStatus)
        ? exportLatestNonEmpty_(transactions, 'defectReason') || pipe.currentReason || ''
        : exportLatestNonEmpty_(transactions, 'notes')
    ]);
  });

  sheet.getRange(EXPORT_DATA_START_ROW, 1, leftRows.length, 3).setValues(leftRows);
  sheet.getRange(EXPORT_DATA_START_ROW, 5, rightRows.length, 10).setValues(rightRows);

  if (pipes.length < EXPORT_MAX_ROWS) {
    sheet.hideRows(EXPORT_DATA_START_ROW + pipes.length, EXPORT_MAX_ROWS - pipes.length);
  }
}

function exportBatchWriteHeader_(sheet, report, config) {
  const metadata = report.metadata;
  const reportNoCell = exportBatchReportNumberCell_(report.businessStatus);
  const headerCells = [
    reportNoCell, 'D4', 'N4', 'D5', 'I5', 'D6', 'I6', 'D7', 'I7', 'N7', 'D8', 'I8', 'D9', 'F9'
  ];
  if (isBusinessFinishedState_(report.businessStatus)) headerCells.push('I3');

  headerCells.forEach(a1 => sheet.getRange(a1).clearContent());

  sheet.getRange(reportNoCell).setValue(report.bundleCode);
  sheet.getRange('D4').setValue(metadata.requestNo || '');
  sheet.getRange('N4').setValue(metadata.lsx || '');
  sheet.getRange('D5').setValue(metadata.customer || '');
  sheet.getRange('I5').setValue(metadata.lot || '');
  sheet.getRange('D6').setValue(metadata.pipeType || '');
  sheet.getRange('I6').setValue(metadata.origin || '');
  sheet.getRange('D7').setValue(metadata.nominalThickness || '');
  sheet.getRange('I7').setValue(metadata.receiptNo || '');
  exportBatchWriteDate_(sheet, 'N7', metadata.receiptDate);
  exportBatchWriteDate_(sheet, 'D8', metadata.executionDate);
  sheet.getRange('I8').setValue(config.classificationLabel);
  sheet.getRange('D9').setValue(report.bundleCode);
  sheet.getRange('F9').setValue(metadata.cableInfo || '');
}

function exportBatchReportNumberCell_(businessStatus) {
  return isBusinessScrapState_(businessStatus) ? 'G3' : 'H3';
}

function exportBatchWriteDate_(sheet, a1, value) {
  const range = sheet.getRange(a1);
  const parsed = typeof parseDashboardDate === 'function' ? parseDashboardDate(value) : null;
  range.setValue(parsed || value || '');
  if (parsed) range.setNumberFormat('dd/MM/yyyy');
}

function exportBatchCreateSheetName_(bundleCode, businessStatus, usedSheetNames) {
  const typeSuffix = isBusinessFinishedState_(businessStatus) ? '_TP' : '_H';
  const cleaned = exportBatchText_(bundleCode)
    .replace(/[\\/:*?\[\]]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'Ma_bo';
  const maxBaseLength = 31 - typeSuffix.length;
  const base = cleaned.substring(0, maxBaseLength);
  let candidate = base + typeSuffix;
  let sequence = 2;

  while (usedSheetNames[candidate]) {
    const duplicateSuffix = '_' + sequence;
    candidate = base.substring(0, 31 - typeSuffix.length - duplicateSuffix.length) + typeSuffix + duplicateSuffix;
    sequence++;
  }

  usedSheetNames[candidate] = true;
  return candidate;
}

function exportBatchCreateFileName_() {
  return 'Bien_ban_Ma_bo_' + Utilities.formatDate(new Date(), exportBatchTimeZone_(), 'yyyyMMdd_HHmmss') + '.xlsx';
}

function exportBatchGetSpreadsheet_() {
  if (typeof getSpreadsheet === 'function') return getSpreadsheet();
  if (typeof SPREADSHEET_ID !== 'undefined' && SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function exportBatchReadMetadataIndex_(spreadsheet) {
  if (!spreadsheet) return {};

  const lookupSheetName = typeof BUNDLE_LOOKUP_SHEET_NAME !== 'undefined'
    ? BUNDLE_LOOKUP_SHEET_NAME
    : EXPORT_BATCH_LOOKUP_SHEET_FALLBACK;
  const sheet = spreadsheet.getSheetByName(lookupSheetName);
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return {};

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const scanRows = Math.min(EXPORT_BATCH_HEADER_SCAN_ROWS, lastRow);
  const headerRows = sheet.getRange(1, 1, scanRows, lastColumn).getValues();
  let headerRowIndex = -1;
  let columns = null;

  for (let rowIndex = 0; rowIndex < headerRows.length; rowIndex++) {
    const candidate = exportBatchFindMetadataColumns_(headerRows[rowIndex]);
    if (candidate.bundle >= 0) {
      headerRowIndex = rowIndex;
      columns = candidate;
      break;
    }
  }

  if (headerRowIndex < 0 || !columns) return {};

  const dataStartRow = headerRowIndex + 2;
  const rowCount = Math.max(0, lastRow - dataStartRow + 1);
  if (rowCount === 0) return {};

  const rows = sheet.getRange(dataStartRow, 1, rowCount, lastColumn).getValues();
  const index = {};

  rows.forEach(row => {
    const bundleCode = exportBatchText_(row[columns.bundle]);
    const bundleKey = exportBatchBundleKey_(bundleCode);
    if (!bundleKey) return;

    const candidate = exportBatchMetadataFromRow_(row, columns);
    if (!index[bundleKey]) {
      index[bundleKey] = candidate;
      return;
    }
    exportBatchMergeMetadata_(index[bundleKey], candidate);
  });

  return index;
}

function exportBatchFindMetadataColumns_(headers) {
  const columns = {
    bundle: -1,
    requestNo: -1,
    lsx: -1,
    customer: -1,
    lot: -1,
    pipeType: -1,
    origin: -1,
    nominalThickness: -1,
    receiptNo: -1,
    receiptDate: -1,
    cableInfo: -1
  };

  (headers || []).forEach((header, index) => {
    const key = exportBatchHeaderKey_(header);
    if (!key) return;

    if (columns.bundle < 0 && key.indexOf('mabo') !== -1) columns.bundle = index;
    if (columns.requestNo < 0 && (key.indexOf('socongvanyeucau') !== -1 || key.indexOf('congvanyeucau') !== -1)) columns.requestNo = index;
    if (columns.lsx < 0 && (key === 'lsx' || key.indexOf('lenhsanxuat') !== -1)) columns.lsx = index;
    if (columns.customer < 0 && (key.indexOf('khachhang') !== -1 || key === 'customer')) columns.customer = index;
    if (columns.lot < 0 && (key === 'lo' || key.indexOf('lohang') !== -1 || key.indexOf('lophieu') !== -1)) columns.lot = index;
    if (columns.pipeType < 0 && (key.indexOf('loaiong') !== -1 || key === 'size' || key.indexOf('quycach') !== -1)) columns.pipeType = index;
    if (columns.origin < 0 && key.indexOf('nguongoc') !== -1) columns.origin = index;
    if (columns.nominalThickness < 0 && (key.indexOf('dodaydanhnghia') !== -1 || key === 'doday')) columns.nominalThickness = index;
    if (columns.receiptNo < 0 && (key.indexOf('sophieunhan') !== -1 || key === 'phieunhan')) columns.receiptNo = index;
    if (columns.receiptDate < 0 && key.indexOf('ngaynhan') !== -1) columns.receiptDate = index;
    if (columns.cableInfo < 0 && key.indexOf('thongtincap') !== -1) columns.cableInfo = index;
  });

  return columns;
}

function exportBatchMetadataFromRow_(row, columns) {
  const metadata = { duplicateFields: [] };
  [
    'requestNo', 'lsx', 'customer', 'lot', 'pipeType', 'origin', 'nominalThickness',
    'receiptNo', 'receiptDate', 'cableInfo'
  ].forEach(field => {
    metadata[field] = columns[field] >= 0 ? row[columns[field]] : '';
  });
  return metadata;
}

function exportBatchMergeMetadata_(target, candidate) {
  [
    'requestNo', 'lsx', 'customer', 'lot', 'pipeType', 'origin', 'nominalThickness',
    'receiptNo', 'receiptDate', 'cableInfo'
  ].forEach(field => {
    const targetValue = exportBatchText_(target[field]);
    const candidateValue = exportBatchText_(candidate[field]);
    if (!targetValue && candidateValue) {
      target[field] = candidate[field];
      return;
    }
    if (targetValue && candidateValue && targetValue !== candidateValue) {
      const label = exportBatchMetadataLabel_(field);
      if (target.duplicateFields.indexOf(label) === -1) target.duplicateFields.push(label);
    }
  });
}

function exportBatchMetadataLabel_(field) {
  const match = EXPORT_BATCH_REQUIRED_METADATA.filter(item => item.key === field)[0];
  return match ? match.label : field;
}

function exportBatchHeaderKey_(value) {
  return normalizeString(value).replace(/[^a-z0-9]/g, '');
}

function exportBatchDateKey_(value) {
  const parsed = typeof parseDashboardDate === 'function' ? parseDashboardDate(value) : null;
  return parsed ? Utilities.formatDate(parsed, exportBatchTimeZone_(), 'yyyy-MM-dd') : '';
}

function exportBatchTimeZone_() {
  try {
    return Session.getScriptTimeZone() || 'Asia/Bangkok';
  } catch (error) {
    return 'Asia/Bangkok';
  }
}

function exportBatchUniqueTexts_(values) {
  const seen = {};
  const result = [];

  (values || []).forEach(value => {
    const text = exportBatchText_(value);
    const key = normalizeString(text);
    if (!text || seen[key]) return;
    seen[key] = true;
    result.push(text);
  });
  return result;
}

function exportBatchBundleKey_(value) {
  return normalizeString(exportBatchText_(value));
}

function exportBatchText_(value) {
  return value == null ? '' : String(value).trim();
}

function exportBatchTrashFile_(fileId) {
  if (!fileId) return;
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (error) {
    Logger.log('Không thể xóa file tạm export: ' + exportBatchErrorMessage_(error));
  }
}

function exportBatchErrorMessage_(error) {
  return error && error.message ? error.message : String(error || 'Lỗi không xác định.');
}
