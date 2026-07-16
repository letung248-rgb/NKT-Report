var SPRINT12_REGRESSION_EXPECTED_SIZES = [
  "Ø60",
  "Ø73",
  "Ø73 NVTL",
  "Ø89",
  "Ø89 NVTL",
  "Ø114",
  "Ø114 NVTL"
];

function sprint12RegressionSideEffects_(overrides) {
  var result = {
    sheetWrites: 0,
    dashboardRefreshes: 0,
    driveFilesCreated: 0,
    temporaryFilesCreated: 0,
    filesTrashed: 0,
    filesRemaining: 0
  };

  Object.keys(overrides || {}).forEach(function(key) {
    result[key] = Number(overrides[key] || 0);
  });
  return result;
}

function sprint12RegressionRunCase_(name, callback) {
  var startedAt = Date.now();
  var checks = [];
  var context = {
    assert: function(checkName, condition, expected, actual, message) {
      var check = {
        name: checkName,
        success: !!condition,
        expected: expected,
        actual: actual,
        message: condition ? "" : (message || checkName + " không đạt.")
      };
      checks.push(check);
      if (!condition) throw new Error(check.message);
    }
  };

  var result;
  try {
    var output = callback(context) || {};
    result = {
      name: name,
      success: true,
      status: "PASS",
      dryRun: true,
      durationMs: Date.now() - startedAt,
      checks: checks,
      details: output.details || {},
      sideEffects: sprint12RegressionSideEffects_(output.sideEffects),
      error: ""
    };
  } catch (error) {
    result = {
      name: name,
      success: false,
      status: "FAIL",
      dryRun: true,
      durationMs: Date.now() - startedAt,
      checks: checks,
      details: {},
      sideEffects: sprint12RegressionSideEffects_(),
      error: sprint12RegressionErrorMessage_(error)
    };
  }

  Logger.log(
    "SPRINT12_REGRESSION | test=" + name +
    " | status=" + result.status +
    " | durationMs=" + result.durationMs +
    (result.error ? " | error=" + result.error : "")
  );
  return result;
}

function sprint12RegressionErrorMessage_(error) {
  return error && error.message ? error.message : String(error || "Lỗi không xác định.");
}

function sprint12RegressionCaptureError_(callback) {
  try {
    callback();
    return "";
  } catch (error) {
    return sprint12RegressionErrorMessage_(error);
  }
}

function sprint12RegressionContains_(values, expectedText) {
  return (values || []).some(function(value) {
    return String(value || "").indexOf(expectedText) !== -1;
  });
}

function sprint12RegressionIsNonNegativeNumber_(value) {
  return typeof value === "number" && isFinite(value) && value >= 0;
}

/**
 * Reads the exact Size source used by Planning. No Sheet write is performed.
 */
function testPlanningSizeCatalog() {
  return sprint12RegressionRunCase_("testPlanningSizeCatalog", function(test) {
    var expected = SPRINT12_REGRESSION_EXPECTED_SIZES.slice();
    var actual = planServiceGetActiveSizes_();
    var missing = expected.filter(function(size) {
      return actual.indexOf(size) === -1;
    });
    var extra = actual.filter(function(size) {
      return expected.indexOf(size) === -1;
    });

    test.assert(
      "Planning dùng DANH_MUC_SIZE",
      SIZE_REPOSITORY_CONFIG.sheetName === "DANH_MUC_SIZE",
      "DANH_MUC_SIZE",
      SIZE_REPOSITORY_CONFIG.sheetName
    );
    test.assert(
      "Có đủ 7 Size bắt buộc",
      missing.length === 0,
      expected,
      actual,
      "DANH_MUC_SIZE thiếu Size: " + missing.join(", ") + "."
    );

    return {
      details: {
        readOnly: true,
        sheetName: SIZE_REPOSITORY_CONFIG.sheetName,
        expectedSizes: expected,
        actualSizes: actual,
        missingSizes: missing,
        extraSizes: extra
      }
    };
  });
}

/**
 * Verifies the Sheet Date -> ISO normalization fixed in Sprint 11A.
 * The localized text is display-only; the production repository uses the raw Date.
 */
function testPlanningDateNormalize() {
  return sprint12RegressionRunCase_("testPlanningDateNormalize", function(test) {
    var spreadsheet = getSpreadsheet();
    var timeZone = planRepositoryGetTimeZone_(spreadsheet);
    var storedDate = planRepositoryToPeriod_("2026-07-16", "day", timeZone);
    var fromVietnamDisplay = planRepositoryFromPeriod_(
      storedDate,
      "16/07/2026",
      "day",
      timeZone
    );
    var fromIsoDisplay = planRepositoryFromPeriod_(
      storedDate,
      "2026-07-16",
      "day",
      timeZone
    );
    var fromUsDisplay = planRepositoryFromPeriod_(
      storedDate,
      "07/16/2026",
      "day",
      timeZone
    );
    var validatedIso = planServiceValidateSingleDay_("2026-07-16");
    var invalidSwappedError = sprint12RegressionCaptureError_(function() {
      planServiceValidateSingleDay_("2026-16-07");
    });

    test.assert(
      "16/07/2026 normalize đúng ISO",
      fromVietnamDisplay === "2026-07-16",
      "2026-07-16",
      fromVietnamDisplay
    );
    test.assert(
      "2026-07-16 giữ nguyên ISO",
      fromIsoDisplay === "2026-07-16" && validatedIso === "2026-07-16",
      "2026-07-16",
      { repository: fromIsoDisplay, service: validatedIso }
    );
    test.assert(
      "Không sinh 2026-16-07",
      fromVietnamDisplay !== "2026-16-07" &&
        fromIsoDisplay !== "2026-16-07" &&
        fromUsDisplay === "2026-07-16",
      "Không có 2026-16-07",
      {
        vietnamDisplay: fromVietnamDisplay,
        isoDisplay: fromIsoDisplay,
        usDisplay: fromUsDisplay
      }
    );
    test.assert(
      "Ngày đảo tháng bị chặn",
      invalidSwappedError.length > 0,
      "Có lỗi validation",
      invalidSwappedError || "Không có lỗi"
    );

    return {
      details: {
        readOnly: true,
        timeZone: timeZone,
        cases: {
          "16/07/2026": fromVietnamDisplay,
          "2026-07-16": fromIsoDisplay,
          "07/16/2026": fromUsDisplay,
          invalidSwappedRejected: true
        }
      }
    };
  });
}

/**
 * Runs the same pure validation and payload mapping as createPlan(), but never
 * enters its lock/repository insert/dashboard refresh write boundary.
 */
function testCreatePlanDryRun() {
  return sprint12RegressionRunCase_("testCreatePlanDryRun", function(test) {
    var input = {
      loai: "ngay",
      tuNgay: "2026-07-16",
      denNgay: "2026-07-16",
      size: "Ø60",
      kiemTra: 3,
      thanhPham: 5,
      ghiChu: "Sprint 12 dry-run"
    };
    var type = planServiceValidateType_(input.loai);
    var common = planServiceValidateCommonInput_(input);
    var periods = planServiceValidateDailyRange_(input.tuNgay, input.denNgay);
    var records = periods.map(function(period) {
      return {
        period: period,
        size: common.size,
        inspectionPlan: common.inspectionPlan,
        finishedPlan: common.finishedPlan,
        note: common.note
      };
    });

    test.assert("Loại kế hoạch ngày hợp lệ", type === "ngay", "ngay", type);
    test.assert("Dry-run tạo đúng một payload", records.length === 1, 1, records.length);
    test.assert(
      "Payload có ngày ISO đúng",
      records[0].period === "2026-07-16",
      "2026-07-16",
      records[0].period
    );
    test.assert("Payload dùng Size chuẩn", records[0].size === "Ø60", "Ø60", records[0].size);
    test.assert(
      "Payload giữ đúng chỉ tiêu kiểm tra",
      records[0].inspectionPlan === 3,
      3,
      records[0].inspectionPlan
    );
    test.assert(
      "Payload giữ đúng chỉ tiêu thành phẩm",
      records[0].finishedPlan === 5,
      5,
      records[0].finishedPlan
    );
    test.assert(
      "Payload giữ đúng ghi chú",
      records[0].note === "Sprint 12 dry-run",
      "Sprint 12 dry-run",
      records[0].note
    );

    return {
      details: {
        normalizedType: type,
        records: records,
        writeBoundaryCalled: false,
        dashboardRefreshCalled: false
      }
    };
  });
}

function sprint12RegressionMockExportPipe_(pipeNo, bundleCode, businessStatus) {
  var entries = {};
  entries[1] = [{
    process: "Đóng gói",
    bundleCode: bundleCode,
    date: "2026-07-16",
    status: "Đạt"
  }];

  return {
    pipeNo: String(pipeNo),
    currentEntryNo: 1,
    currentBusinessStatus: businessStatus,
    entries: entries,
    size: "Ø60",
    well: "",
    rig: "",
    wellProfile: ""
  };
}

/**
 * Exercises Export preflight with in-memory fixtures only.
 */
function testExportPreflight() {
  return sprint12RegressionRunCase_("testExportPreflight", function(test) {
    var metadataBundle = "S12-MISSING-METADATA";
    var metadataReports = exportBatchBuildReports_([
      sprint12RegressionMockExportPipe_("S12-001", metadataBundle, "THANH_PHAM")
    ], {});
    var metadataReport = metadataReports[0];
    var metadataItem = exportBatchToListItem_(metadataReport);
    var metadataSelection = exportBatchNormalizeSelections_([{
      bundleCode: metadataBundle,
      businessStatus: "THANH_PHAM"
    }]);
    var metadataResolved = exportBatchResolveSelections_(metadataReports, metadataSelection);

    test.assert(
      "Thiếu metadata vẫn exportable",
      metadataReport.ready === true && metadataResolved.length === 1,
      true,
      metadataReport.ready
    );
    test.assert(
      "Thiếu metadata chỉ là cảnh báo",
      metadataReport.metadataIssues.length > 0 && metadataItem.status === "THIEU_THONG_TIN",
      "THIEU_THONG_TIN",
      metadataItem.status
    );

    var overLimitPipes = [];
    for (var index = 1; index <= EXPORT_MAX_ROWS + 1; index++) {
      overLimitPipes.push(sprint12RegressionMockExportPipe_(
        "S12-LIMIT-" + index,
        "S12-OVER-40",
        "THANH_PHAM"
      ));
    }
    var overLimitReport = exportBatchBuildReports_(overLimitPipes, {})[0];
    var overLimitError = sprint12RegressionCaptureError_(function() {
      var selection = exportBatchNormalizeSelections_([{
        bundleCode: "S12-OVER-40",
        businessStatus: "THANH_PHAM"
      }]);
      exportBatchResolveSelections_([overLimitReport], selection);
    });

    test.assert("Giới hạn Export vẫn là 40", EXPORT_MAX_ROWS === 40, 40, EXPORT_MAX_ROWS);
    test.assert(
      ">40 ống bị chặn",
      overLimitReport.ready === false &&
        sprint12RegressionContains_(overLimitReport.blockingIssues, "vượt giới hạn 40 ống") &&
        overLimitError.length > 0,
      "Bị chặn",
      { ready: overLimitReport.ready, error: overLimitError }
    );

    var missingBundleError = sprint12RegressionCaptureError_(function() {
      exportBatchNormalizeSelections_([{
        bundleCode: " ",
        businessStatus: "THANH_PHAM"
      }]);
    });
    test.assert(
      "Thiếu Mã bó bị chặn",
      missingBundleError.indexOf("Thiếu mã bó") !== -1,
      "Lỗi Thiếu mã bó",
      missingBundleError
    );

    var invalidReport = exportBatchBuildReports_([
      sprint12RegressionMockExportPipe_("S12-INVALID-1", "S12-INVALID-TYPE", "CHO_SUA")
    ], {})[0];
    test.assert(
      "Không xác định loại biên bản bị chặn",
      invalidReport.businessStatus === "INVALID" &&
        invalidReport.ready === false &&
        sprint12RegressionContains_(invalidReport.blockingIssues, "Không xác định được loại biên bản"),
      "INVALID và bị chặn",
      {
        businessStatus: invalidReport.businessStatus,
        ready: invalidReport.ready,
        blockingIssues: invalidReport.blockingIssues
      }
    );

    return {
      details: {
        fixturesOnly: true,
        cases: {
          missingMetadata: metadataItem.status,
          over40Blocked: true,
          missingBundleBlocked: true,
          invalidReportTypeBlocked: true
        }
      }
    };
  });
}

/**
 * Reads both templates and calls the production XLSX endpoint. The returned
 * blobs stay in memory; no Spreadsheet or Drive file is created.
 */
function testExportXlsxDryRun() {
  return sprint12RegressionRunCase_("testExportXlsxDryRun", function(test) {
    var templateResults = [];

    ["THANH_PHAM", "LOAI"].forEach(function(businessStatus) {
      var config = EXPORT_TEMPLATE_CONFIG[businessStatus];
      var driveFile = DriveApp.getFileById(config.templateId);
      var template = exportBatchOpenTemplate_(businessStatus);
      var templateSheet = template.getSheetByName(config.sheetName);
      var blob = exportBatchDownloadXlsx_(
        template.getId(),
        "S12_DRYRUN_" + businessStatus + ".xlsx"
      );
      var bytes = blob.getBytes();

      test.assert(
        businessStatus + " template file access",
        !!driveFile.getName() && !!templateSheet,
        "Template và sheet đọc được",
        { fileName: driveFile.getName(), sheetName: config.sheetName }
      );
      test.assert(
        businessStatus + " XLSX endpoint",
        bytes.length > 4 && bytes[0] === 80 && bytes[1] === 75,
        "XLSX ZIP signature PK",
        { byteLength: bytes.length, signature: [bytes[0], bytes[1]] }
      );
      test.assert(
        businessStatus + " XLSX MIME",
        blob.getContentType() === EXPORT_BATCH_XLSX_MIME,
        EXPORT_BATCH_XLSX_MIME,
        blob.getContentType()
      );

      templateResults.push({
        businessStatus: businessStatus,
        sheetName: config.sheetName,
        sourceFileName: driveFile.getName(),
        byteLength: bytes.length,
        contentType: blob.getContentType()
      });
    });

    return {
      details: {
        readOnly: true,
        endpointRequests: templateResults.length,
        inMemoryBlobs: templateResults.length,
        templates: templateResults
      }
    };
  });
}

/**
 * Reads the minimal Dashboard snapshot without rebuilding or writing it.
 */
function testDashboardSnapshotRead() {
  return sprint12RegressionRunCase_("testDashboardSnapshotRead", function(test) {
    var source = "cache";
    var snapshot = readDashboardSnapshotCache_();
    if (!snapshot) {
      source = "durable";
      snapshot = readDashboardSnapshot_();
    }

    test.assert("Dashboard snapshot tồn tại", !!snapshot, true, !!snapshot);
    test.assert("Dashboard snapshot success", snapshot.success === true, true, snapshot.success);

    var snapshotMeta = snapshot.snapshotMeta || {};
    test.assert(
      "Dashboard snapshot có metadata",
      snapshotMeta.success === true && !!(snapshotMeta.version || snapshotMeta.builtAt),
      "success và version/builtAt",
      {
        success: snapshotMeta.success,
        version: snapshotMeta.version || "",
        builtAt: snapshotMeta.builtAt || ""
      }
    );

    var kpi = snapshot.kpi || {};
    var requiredKpiFields = ["total", "tp", "cs", "hong", "dxl", "transactions"];
    requiredKpiFields.forEach(function(field) {
      test.assert(
        "Dashboard KPI " + field,
        sprint12RegressionIsNonNegativeNumber_(kpi[field]),
        "Số >= 0",
        kpi[field]
      );
    });

    return {
      details: {
        readOnly: true,
        source: source,
        snapshotMeta: {
          success: snapshotMeta.success,
          version: snapshotMeta.version || "",
          builtAt: snapshotMeta.builtAt || ""
        },
        kpi: {
          total: Number(kpi.total),
          tp: Number(kpi.tp),
          cs: Number(kpi.cs),
          hong: Number(kpi.hong),
          dxl: Number(kpi.dxl),
          transactions: Number(kpi.transactions)
        }
      }
    };
  });
}

function sprint12RegressionAccumulateSideEffects_(target, source) {
  Object.keys(target).forEach(function(key) {
    target[key] += Number(source && source[key] || 0);
  });
}

/**
 * Main Sprint 12 server-side smoke test. Safe by default and by construction:
 * no public test in this suite contains a Sheet/Drive write path.
 */
function runSprint12RegressionSmokeTest() {
  var startedAtMs = Date.now();
  var startedAt = new Date(startedAtMs).toISOString();
  var tests = [
    testPlanningSizeCatalog(),
    testPlanningDateNormalize(),
    testCreatePlanDryRun(),
    testExportPreflight(),
    testExportXlsxDryRun(),
    testDashboardSnapshotRead()
  ];
  var passed = tests.filter(function(test) { return test.success === true; }).length;
  var sideEffects = sprint12RegressionSideEffects_();
  tests.forEach(function(test) {
    sprint12RegressionAccumulateSideEffects_(sideEffects, test.sideEffects);
  });

  var result = {
    suite: "Sprint 12 Regression Smoke",
    success: passed === tests.length,
    status: passed === tests.length ? "PASS" : "FAIL",
    dryRun: true,
    startedAt: startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAtMs,
    summary: {
      total: tests.length,
      passed: passed,
      failed: tests.length - passed
    },
    sideEffects: sideEffects,
    tests: tests
  };

  Logger.log("SPRINT12_REGRESSION_RESULT " + JSON.stringify(result));
  return result;
}
