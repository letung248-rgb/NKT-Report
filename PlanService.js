/**
 * Public read API for the Production Plan Module foundation.
 */
function getPlanModuleData() {
  try {
    var repositoryData = planRepositoryReadAll_();
    var daily = planServiceMapRows_(repositoryData.daily.rows, "ngay");
    var monthly = planServiceMapRows_(repositoryData.monthly.rows, "thang");
    var sizes = planServiceGetActiveSizes_();

    return {
      success: true,
      data: {
        daily: daily,
        monthly: monthly,
        sizes: sizes
      },
      meta: {
        dailySheet: repositoryData.daily.sheetName,
        monthlySheet: repositoryData.monthly.sheetName,
        dailyCount: daily.length,
        monthlyCount: monthly.length,
        readOnly: true
      }
    };
  } catch (error) {
    planServiceThrowOperationError_("getPlanModuleData", "Khong doc duoc du lieu ke hoach", error);
  }
}

function createPlan(request) {
  try {
    var input = request || {};
    var type = planServiceValidateType_(input.loai || input.type);
    var period = planServiceValidatePeriodByType_(type, input);
    var common = planServiceValidateCommonInput_(input);
    var updatedBy = planServiceCurrentUser_();
    var updatedAt = new Date();

    return planServiceWithWriteLock_(function() {
      if (planServiceExistsByType_(type, period, common.size, "")) {
        throw new Error("Ke hoach da ton tai: " + period + " - " + common.size + ".");
      }

      var created = planServiceInsertRepositoryByType_(type, {
        period: period,
        size: common.size,
        inspectionPlan: common.inspectionPlan,
        finishedPlan: common.finishedPlan,
        note: common.note,
        updatedBy: updatedBy,
        updatedAt: updatedAt
      });

      return {
        success: true,
        data: {
          created: planServiceMapRecord_(created, type)
        }
      };
    });
  } catch (error) {
    planServiceThrowOperationError_("createPlan", "Khong the tao ke hoach", error);
  }
}

function updatePlan(request) {
  try {
    var input = request || {};
    var type = planServiceValidateType_(input.loai || input.type);
    var id = planServiceRequiredText_(input.id, "ID ke hoach");
    var period = planServiceValidatePeriodByType_(type, input);
    var common = planServiceValidateCommonInput_(input);
    var updatedBy = planServiceCurrentUser_();
    var updatedAt = new Date();

    return planServiceWithWriteLock_(function() {
      if (planServiceExistsByType_(type, period, common.size, id)) {
        throw new Error("Ke hoach da ton tai: " + period + " - " + common.size + ".");
      }

      var updated = planServiceUpdateRepositoryByType_(type, id, {
        period: period,
        size: common.size,
        inspectionPlan: common.inspectionPlan,
        finishedPlan: common.finishedPlan,
        note: common.note,
        updatedBy: updatedBy,
        updatedAt: updatedAt
      });

      return {
        success: true,
        data: {
          updated: planServiceMapRecord_(updated, type)
        }
      };
    });
  } catch (error) {
    planServiceThrowOperationError_("updatePlan", "Khong the cap nhat ke hoach", error);
  }
}

function planServiceMapRows_(rows, type) {
  var result = [];
  (Array.isArray(rows) ? rows : []).forEach(function(row) {
    result.push(planServiceMapRecord_(row, type));
  });
  return result;
}

function planServiceMapRecord_(repositoryRow, type) {
  return {
    id: repositoryRow.id,
    loai: type,
    thoiGian: planServiceText_(repositoryRow.period),
    size: planServiceText_(repositoryRow.size),
    kiemTra: planServiceNumber_(repositoryRow.inspectionPlan),
    thanhPham: planServiceNumber_(repositoryRow.finishedPlan),
    ghiChu: planServiceText_(repositoryRow.note),
    nguoiCapNhat: planServiceText_(repositoryRow.updatedBy),
    capNhatLuc: planServiceText_(repositoryRow.updatedAt)
  };
}

function planServiceValidateType_(value) {
  var type = planServiceText_(value).toLowerCase();
  if (type === "ngay" || type === "daily" || type === "day") return "ngay";
  if (type === "thang" || type === "monthly" || type === "month") return "thang";
  throw new Error("Loai ke hoach phai la ngay hoac thang.");
}

function planServiceValidatePeriodByType_(type, input) {
  if (type === "ngay") {
    return planServiceValidateSingleDay_(planServiceFirstDefined_(input.ngay, input.Ngay, input.thoiGian, input.date));
  }
  return planServiceValidateMonth_(planServiceFirstDefined_(input.thang, input.Thang, input.thoiGian, input.month));
}

function planServiceValidateCommonInput_(input) {
  var note = planServiceText_(planServiceFirstDefined_(input.ghiChu, input.GhiChu, input.note));
  if (note.length > 500) throw new Error("GhiChu khong duoc vuot qua 500 ky tu.");

  return {
    size: planServiceRequireActiveSize_(input.size),
    inspectionPlan: planServiceValidateNonNegativeNumber_(
      planServiceFirstDefined_(input.kiemTra, input.KH_KiemTra, input.khKiemTra, input.inspectionPlan),
      "KH_KiemTra"
    ),
    finishedPlan: planServiceValidateNonNegativeNumber_(
      planServiceFirstDefined_(input.thanhPham, input.KH_ThanhPham, input.khThanhPham, input.finishedPlan),
      "KH_ThanhPham"
    ),
    note: note
  };
}

function planServiceRequireActiveSize_(value) {
  var requested = planServiceRequiredText_(value, "Size");
  var sizes = planServiceGetActiveSizes_();
  var normalized = requested.toLocaleLowerCase("vi");

  for (var index = 0; index < sizes.length; index++) {
    var canonical = String(sizes[index] || "").trim();
    if (canonical.toLocaleLowerCase("vi") === normalized) return canonical;
  }

  throw new Error("Size khong ton tai hoac khong hoat dong: " + requested + ".");
}

function planServiceGetActiveSizes_() {
  var catalog = getActiveSizeCatalog();
  var catalogSizes = catalog && catalog.success === true && catalog.data &&
    Array.isArray(catalog.data.sizes) ? catalog.data.sizes : [];
  catalogSizes = planServiceUniqueSizes_(catalogSizes);

  if (!catalogSizes.length) {
    throw new Error("Danh muc Size DANH_MUC_SIZE chua co Size dang hoat dong.");
  }

  return catalogSizes;
}

function planServiceUniqueSizes_(values) {
  var seen = {};
  var sizes = [];

  (Array.isArray(values) ? values : []).forEach(function(value) {
    var size = planServiceText_(value);
    if (!size) return;
    var key = size.toLocaleLowerCase("vi");
    if (seen[key]) return;
    seen[key] = true;
    sizes.push(size);
  });

  return sizes;
}

function planServiceValidateNonNegativeNumber_(value, fieldName) {
  if (value === null || value === undefined || String(value).trim() === "") {
    throw new Error(fieldName + " la bat buoc.");
  }
  var number = Number(value);
  if (!isFinite(number) || number < 0 || Math.floor(number) !== number) {
    throw new Error(fieldName + " phai la so nguyen >= 0.");
  }
  return number;
}

function planServiceValidateMonth_(value) {
  var text = planServiceRequiredText_(value, "Thang");
  var match = text.match(/^(\d{4})-(\d{2})$/);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) {
    throw new Error("Thang khong hop le. Dinh dang yeu cau: yyyy-MM.");
  }
  return match[1] + "-" + match[2];
}

function planServiceValidateSingleDay_(value) {
  return planServiceParseDay_(planServiceRequiredText_(value, "Ngay")).value;
}


function planServiceParseDay_(text) {
  var match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error("Ngay khong hop le. Dinh dang yeu cau: yyyy-MM-dd.");

  var year = Number(match[1]);
  var month = Number(match[2]);
  var day = Number(match[3]);
  var time = Date.UTC(year, month - 1, day);
  var date = new Date(time);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("Ngay khong hop le: " + text + ".");
  }

  return {
    value: match[1] + "-" + match[2] + "-" + match[3],
    time: time
  };
}


function planServiceExistsByType_(type, period, size, excludedId) {
  return type === "thang"
    ? planRepositoryExistsMonthly(period, size, excludedId)
    : planRepositoryExistsDaily(period, size, excludedId);
}

function planServiceInsertRepositoryByType_(type, record) {
  return type === "thang"
    ? planRepositoryInsertMonthly(record)
    : planRepositoryInsertDaily(record);
}

function planServiceUpdateRepositoryByType_(type, id, record) {
  return type === "thang"
    ? planRepositoryUpdateMonthlyById(id, record)
    : planRepositoryUpdateDailyById(id, record);
}

function planServiceWithWriteLock_(callback) {
  if (typeof LockService === "undefined" || !LockService.getScriptLock) return callback();
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function planServiceCurrentUser_() {
  try {
    var user = Session.getActiveUser && Session.getActiveUser();
    var email = user && user.getEmail ? user.getEmail() : "";
    return email || "unknown";
  } catch (error) {
    return "unknown";
  }
}

function planServiceFirstDefined_() {
  for (var index = 0; index < arguments.length; index++) {
    var value = arguments[index];
    if (value === null || value === undefined) continue;
    if (String(value).trim() === "") continue;
    return value;
  }
  return "";
}

function planServiceRequiredText_(value, fieldName) {
  var text = planServiceText_(value);
  if (!text) throw new Error(fieldName + " la bat buoc.");
  return text;
}

function planServiceThrowOperationError_(operation, prefix, error) {
  var message = error && error.message ? error.message : String(error);
  if (typeof Logger !== "undefined" && Logger.log) Logger.log(operation + " error: " + message);
  throw new Error(prefix + ": " + message);
}

function planServiceText_(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function planServiceNumber_(value) {
  if (typeof value === "number" && isFinite(value)) return value;
  var number = Number(String(value === null || value === undefined ? "" : value).replace(/\s/g, "").replace(/,/g, ""));
  return isFinite(number) ? number : 0;
}
