const EXPORT_MAX_ROWS = 40;
const EXPORT_DATA_START_ROW = 13;

const EXPORT_TEMPLATE_CONFIG = {
  THANH_PHAM: {
    templateId: "14ALAEYglRdOz_WqZfdbEHzfVWqqslVQwLZrlJ5BisDA",
    sheetName: "177",
    filePrefix: "BB_ong_thanh_pham",
    classificationLabel: "Ống thành phẩm"
  },
  LOAI: {
    templateId: "1ZGdjzPD9nvyI2LJ4iHJxu-UzbjSq8bo_ThBOiQHaLas",
    sheetName: "71H",
    filePrefix: "BB_ong_hong",
    classificationLabel: "Ống hỏng"
  }
};

/**
 * Export tối đa hai biên bản theo Mã bó.
 * Trạng thái được lấy trực tiếp từ buildPipeEngine/currentBusinessStatus.
 */
function exportBundleReports(bundleCode) {
  const createdFileIds = [];

  try {
    const rawBundleCode = (bundleCode || "").toString().trim();
    const bundleKey = normalizeString(rawBundleCode);
    if (!bundleKey) throw new Error("Thiếu Mã bó.");

    const groups = exportGroupPipesByBundle_(buildPipeEngine(), bundleKey);
    const files = [];

    if (groups.matchedCount === 0) {
      throw new Error("Không tìm thấy Mã bó: " + rawBundleCode + ".");
    }

    const states = getBusinessStates_();
    if (groups[states.THANH_PHAM].length > 0) {
      const report = exportCreateReport_(rawBundleCode, states.THANH_PHAM, groups[states.THANH_PHAM]);
      files.push(report);
      createdFileIds.push(report.spreadsheetId);
    }
    if (groups[states.LOAI].length > 0) {
      const report = exportCreateReport_(rawBundleCode, states.LOAI, groups[states.LOAI]);
      files.push(report);
      createdFileIds.push(report.spreadsheetId);
    }

    if (files.length === 0) {
      throw new Error("Mã bó không có trạng thái Thành phẩm hoặc Loại để Export.");
    }

    return {
      success: true,
      bundleCode: rawBundleCode,
      files: files
    };
  } catch (error) {
    const rollbackErrors = exportRollbackFiles_(createdFileIds);
    let errorMessage = error && error.message ? error.message : String(error);
    if (rollbackErrors.length > 0) {
      errorMessage += " Rollback không hoàn tất: " + rollbackErrors.join(" | ");
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

function exportGroupPipesByBundle_(pipes, bundleKey) {
  const states = getBusinessStates_();
  const groups = { matchedCount: 0 };
  groups[states.THANH_PHAM] = [];
  groups[states.LOAI] = [];

  (pipes || []).forEach(pipe => {
    if (!exportPipeMatchesBundle_(pipe, bundleKey)) return;
    groups.matchedCount++;

    // Single Source of Truth: không tính lại trạng thái tại ExportService.
    const businessStatus = getPipeExportBusinessState_(pipe);
    if (businessStatus) {
      groups[businessStatus].push(pipe);
    }
  });

  [states.THANH_PHAM, states.LOAI].forEach(status => {
    groups[status].sort((a, b) => String(a.pipeNo || "").localeCompare(
      String(b.pipeNo || ""),
      "vi",
      { numeric: true }
    ));
  });

  return groups;
}

function exportPipeMatchesBundle_(pipe, bundleKey) {
  return exportCurrentEntryTransactions_(pipe).some(transaction =>
    normalizeString(transaction.process).includes("dong goi") &&
    normalizeString(transaction.bundleCode) === bundleKey
  );
}

function exportCurrentEntryTransactions_(pipe) {
  if (!pipe || !pipe.entries || pipe.currentEntryNo === undefined || pipe.currentEntryNo === null) {
    return [];
  }
  return pipe.entries[pipe.currentEntryNo] || [];
}

function exportCreateReport_(bundleCode, businessStatus, pipes) {
  const config = EXPORT_TEMPLATE_CONFIG[businessStatus];
  if (!config) throw new Error("Không có cấu hình template cho " + businessStatus + ".");
  if (!config.templateId || config.templateId.indexOf("PASTE_") === 0) {
    throw new Error("Chưa cấu hình templateId cho " + businessStatus + ".");
  }
  if (pipes.length > EXPORT_MAX_ROWS) {
    throw new Error(
      config.classificationLabel + " của Mã bó " + bundleCode +
      " có " + pipes.length + " ống, vượt giới hạn " + EXPORT_MAX_ROWS + "."
    );
  }

  const templateSpreadsheet = SpreadsheetApp.openById(config.templateId);
  if (!templateSpreadsheet.getSheetByName(config.sheetName)) {
    throw new Error("Không tìm thấy sheet template: " + config.sheetName + ".");
  }

  const fileName = config.filePrefix + "_" + exportSafeFileName_(bundleCode);
  let outputSpreadsheet = null;

  try {
    outputSpreadsheet = templateSpreadsheet.copy(fileName);
    const sheet = outputSpreadsheet.getSheetByName(config.sheetName);
    if (!sheet) throw new Error("Không tìm thấy sheet trong file copy: " + config.sheetName + ".");

    exportWriteReport_(sheet, bundleCode, businessStatus, config, pipes);
    SpreadsheetApp.flush();

    return {
      businessStatus: businessStatus,
      count: pipes.length,
      spreadsheetId: outputSpreadsheet.getId(),
      url: outputSpreadsheet.getUrl()
    };
  } catch (error) {
    const rollbackErrors = outputSpreadsheet
      ? exportRollbackFiles_([outputSpreadsheet.getId()])
      : [];
    if (rollbackErrors.length > 0) {
      throw new Error(
        (error && error.message ? error.message : String(error)) +
        " Rollback không hoàn tất: " + rollbackErrors.join(" | ")
      );
    }
    throw error;
  }
}

function exportRollbackFiles_(fileIds) {
  const errors = [];

  (fileIds || []).forEach(fileId => {
    if (!fileId) return;
    try {
      DriveApp.getFileById(fileId).setTrashed(true);
    } catch (error) {
      errors.push(fileId + ": " + (error && error.message ? error.message : String(error)));
    }
  });

  return errors;
}

function exportWriteReport_(sheet, bundleCode, businessStatus, config, pipes) {
  sheet.getRange(EXPORT_DATA_START_ROW, 1, EXPORT_MAX_ROWS, 3).clearContent();
  sheet.getRange(EXPORT_DATA_START_ROW, 5, EXPORT_MAX_ROWS, 10).clearContent();

  const leftRows = [];
  const rightRows = [];

  pipes.forEach((pipe, index) => {
    const transactions = exportCurrentEntryTransactions_(pipe);
    const inspection = exportLatestTransaction_(transactions, "dau vao");
    const washing = exportLatestTransaction_(transactions, "rua ong");
    const drift = exportLatestTransaction_(transactions, "thong nong");
    const ndt = exportLatestTransaction_(transactions, "ndt");
    const threadInspection = exportLatestTransaction_(transactions, "lam sach ren");
    const threadRepair = exportLatestTransaction_(transactions, "tien ren");
    const couplingRepair = exportLatestTransaction_(transactions, "thay coupling");
    const pressureTest = exportLatestTransaction_(transactions, "ep thuy luc");
    const packing = exportLatestTransaction_(transactions, "dong goi");

    leftRows.push([
      index + 1,
      pipe.pipeNo || "",
      exportStatusMark_(inspection)
    ]);
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
      isBusinessScrapState_(businessStatus)
        ? exportLatestNonEmpty_(transactions, "defectReason") || pipe.currentReason || ""
        : exportLatestNonEmpty_(transactions, "notes")
    ]);
  });

  if (leftRows.length > 0) {
    sheet.getRange(EXPORT_DATA_START_ROW, 1, leftRows.length, 3).setValues(leftRows);
    sheet.getRange(EXPORT_DATA_START_ROW, 5, rightRows.length, 10).setValues(rightRows);
  }

  sheet.getRange("D9").setValue(bundleCode);
  sheet.getRange("I8").setValue(config.classificationLabel);
  sheet.showRows(EXPORT_DATA_START_ROW, pipes.length);
  if (pipes.length < EXPORT_MAX_ROWS) {
    sheet.hideRows(EXPORT_DATA_START_ROW + pipes.length, EXPORT_MAX_ROWS - pipes.length);
  }
}

function exportLatestTransaction_(transactions, processName) {
  for (let i = transactions.length - 1; i >= 0; i--) {
    if (normalizeString(transactions[i].process).includes(processName)) return transactions[i];
  }
  return null;
}

function exportStatusMark_(transaction) {
  if (!transaction) return "-";

  // Chỉ đổi cách hiển thị trong template, không phân loại business status.
  const status = normalizeString(transaction.status);
  if (status === "dat" || status === "thanh pham" || status === "ok") return "OK";
  return status ? "NO" : "-";
}

function exportLatestNonEmpty_(transactions, field) {
  for (let i = transactions.length - 1; i >= 0; i--) {
    const value = (transactions[i][field] || "").toString().trim();
    if (value) return value;
  }
  return "";
}

function exportSafeFileName_(value) {
  return String(value || "").trim().replace(/[\\/:*?"<>|]+/g, "_");
}
