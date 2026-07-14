/**
 * Public read API used by PlanModule.html.
 * CRUD APIs are exposed separately; the current UI can keep this read contract unchanged.
 */
function getPlanModuleData() {
  try {
    var repositoryData = planRepositoryReadAll_();
    var monthly = planServiceMapRows_(repositoryData.monthly, "thang");
    var daily = planServiceMapRows_(repositoryData.daily, "ngay");
    var sizeCatalog = getActiveSizeCatalog();
    var sizes = sizeCatalog && sizeCatalog.success === true && sizeCatalog.data &&
      Array.isArray(sizeCatalog.data.sizes) ? sizeCatalog.data.sizes : [];

    return {
      success: true,
      data: {
        monthly: monthly,
        daily: daily,
        sizes: sizes
      },
      meta: {
        monthlySheet: repositoryData.monthly.sheetName,
        dailySheet: repositoryData.daily.sheetName,
        monthlyCount: monthly.length,
        dailyCount: daily.length,
        readOnly: true
      }
    };
  } catch (error) {
    var message = error && error.message ? error.message : String(error);
    Logger.log("getPlanModuleData error: " + message);
    throw new Error("Không đọc được dữ liệu kế hoạch: " + message);
  }
}

function createPlan(request) {
  try {
    var input = request || {};
    var type = planServiceValidateType_(input.loai);
    var common = planServiceValidateCommonInput_(input);
    var periods = type === "thang"
      ? [planServiceValidateMonth_(input.thang || input.thoiGian)]
      : planServiceValidateDailyRange_(input.tuNgay, input.denNgay);

    return planServiceWithWriteLock_(function() {
      var existing = planServiceListRepositoryByType_(type);
      var conflicts = planServiceFindDuplicatePeriods_(existing, periods, common.size, type, "");

      if (conflicts.length) {
        throw new Error("Kế hoạch đã tồn tại: " + conflicts.join(", ") + ".");
      }

      var records = periods.map(function(period) {
        return {
          period: period,
          size: common.size,
          inspectionPlan: common.inspectionPlan,
          finishedPlan: common.finishedPlan,
          note: common.note
        };
      });
      var created = planServiceInsertRepositoryByType_(type, records);

      return {
        success: true,
        data: {
          created: created.map(function(record) {
            return planServiceMapRecord_(record, type);
          })
        },
        meta: {
          createdCount: created.length
        }
      };
    });
  } catch (error) {
    planServiceThrowOperationError_("createPlan", "Không thể tạo kế hoạch", error);
  }
}

function updatePlan(request) {
  try {
    var input = request || {};
    var type = planServiceValidateType_(input.loai);
    var id = planServiceRequiredText_(input.id, "ID kế hoạch");
    var common = planServiceValidateCommonInput_(input);
    var period = type === "thang"
      ? planServiceValidateMonth_(input.thoiGian || input.thang)
      : planServiceValidateSingleDay_(input.thoiGian || input.ngay);

    return planServiceWithWriteLock_(function() {
      var existing = planServiceListRepositoryByType_(type);
      var current = existing.find(function(record) {
        return String(record.id || "") === id;
      });

      if (!current) throw new Error("Không tìm thấy kế hoạch ID " + id + ".");

      var conflicts = planServiceFindDuplicatePeriods_(existing, [period], common.size, type, id);
      if (conflicts.length) {
        throw new Error("Kế hoạch đã tồn tại: " + conflicts.join(", ") + ".");
      }

      var updated = planServiceUpdateRepositoryByType_(type, id, {
        period: period,
        size: common.size,
        inspectionPlan: common.inspectionPlan,
        finishedPlan: common.finishedPlan,
        note: common.note
      });

      return {
        success: true,
        data: {
          updated: planServiceMapRecord_(updated, type)
        }
      };
    });
  } catch (error) {
    planServiceThrowOperationError_("updatePlan", "Không thể cập nhật kế hoạch", error);
  }
}

function deletePlan(request) {
  try {
    var input = request || {};
    var type = planServiceValidateType_(input.loai);
    var id = planServiceRequiredText_(input.id, "ID kế hoạch");

    return planServiceWithWriteLock_(function() {
      var deleted = planServiceDeleteRepositoryByType_(type, id);
      return {
        success: true,
        data: {
          deleted: planServiceMapRecord_(deleted, type)
        }
      };
    });
  } catch (error) {
    planServiceThrowOperationError_("deletePlan", "Không thể xóa kế hoạch", error);
  }
}

function planServiceMapRows_(sheetData, type) {
  var result = [];
  var rows = sheetData && Array.isArray(sheetData.rows) ? sheetData.rows : [];

  for (var index = 0; index < rows.length; index++) {
    result.push(planServiceMapRecord_(rows[index], type));
  }

  return result;
}

function planServiceMapRecord_(repositoryRow, type) {
  return {
    id: repositoryRow.id,
    loai: type,
    thoiGian: planServiceText_("", repositoryRow.period),
    size: planServiceText_("", repositoryRow.size),
    kiemTra: planServiceNumber_(repositoryRow.inspectionPlan),
    thanhPham: planServiceNumber_(repositoryRow.finishedPlan),
    ghiChu: planServiceText_("", repositoryRow.note),
    capNhatLuc: planServiceText_("", repositoryRow.updatedAt),
    capNhatBoi: ""
  };
}

function planServiceValidateType_(value) {
  if (value !== "thang" && value !== "ngay") {
    throw new Error("Loại kế hoạch phải là thang hoặc ngay.");
  }
  return value;
}

function planServiceValidateCommonInput_(input) {
  var note = input.ghiChu === null || input.ghiChu === undefined
    ? ""
    : String(input.ghiChu).trim();
  if (note.length > 500) throw new Error("Ghi chú không được vượt quá 500 ký tự.");

  return {
    size: planServiceRequireActiveSize_(input.size),
    inspectionPlan: planServiceValidateNonNegativeNumber_(input.kiemTra, "KH kiểm tra"),
    finishedPlan: planServiceValidateNonNegativeNumber_(input.thanhPham, "KH thành phẩm"),
    note: note
  };
}

function planServiceRequireActiveSize_(value) {
  var requested = planServiceRequiredText_(value, "Size");
  var result = getActiveSizeCatalog();
  var sizes = result && result.success === true && result.data && Array.isArray(result.data.sizes)
    ? result.data.sizes
    : [];
  var normalized = requested.toLocaleLowerCase("vi");

  for (var index = 0; index < sizes.length; index++) {
    var canonical = String(sizes[index] || "").trim();
    if (canonical.toLocaleLowerCase("vi") === normalized) return canonical;
  }

  throw new Error("Size không tồn tại hoặc không hoạt động: " + requested + ".");
}

function planServiceValidateNonNegativeNumber_(value, fieldName) {
  if (value === null || value === undefined || String(value).trim() === "") {
    throw new Error(fieldName + " là bắt buộc.");
  }
  var number = Number(value);
  if (!isFinite(number) || number < 0) {
    throw new Error(fieldName + " phải là số lớn hơn hoặc bằng 0.");
  }
  return number;
}

function planServiceValidateMonth_(value) {
  var text = planServiceRequiredText_(value, "Tháng");
  var match = text.match(/^(\d{4})-(\d{2})$/);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) {
    throw new Error("Tháng không hợp lệ. Định dạng yêu cầu: yyyy-MM.");
  }
  return match[1] + "-" + match[2];
}

function planServiceValidateSingleDay_(value) {
  return planServiceParseDay_(planServiceRequiredText_(value, "Ngày")).value;
}

function planServiceValidateDailyRange_(fromValue, toValue) {
  var from = planServiceParseDay_(planServiceRequiredText_(fromValue, "Từ ngày"));
  var to = planServiceParseDay_(planServiceRequiredText_(toValue, "Đến ngày"));
  if (to.time < from.time) throw new Error("Đến ngày phải bằng hoặc sau Từ ngày.");

  var dayCount = Math.floor((to.time - from.time) / 86400000) + 1;
  if (dayCount > 31) throw new Error("Khoảng ngày không được vượt quá 31 ngày.");

  var periods = [];
  for (var time = from.time; time <= to.time; time += 86400000) {
    periods.push(new Date(time).toISOString().slice(0, 10));
  }
  return periods;
}

function planServiceParseDay_(text) {
  var match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error("Ngày không hợp lệ. Định dạng yêu cầu: yyyy-MM-dd.");

  var year = Number(match[1]);
  var month = Number(match[2]);
  var day = Number(match[3]);
  var time = Date.UTC(year, month - 1, day);
  var date = new Date(time);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Ngày không hợp lệ: " + text + ".");
  }

  return {
    value: match[1] + "-" + match[2] + "-" + match[3],
    time: time
  };
}

function planServiceFindDuplicatePeriods_(records, periods, size, type, excludedId) {
  var requestedKeys = {};
  periods.forEach(function(period) {
    requestedKeys[planServiceBusinessKey_(period, size)] = period;
  });

  var conflicts = [];
  records.forEach(function(record) {
    if (excludedId && String(record.id || "") === excludedId) return;
    var period = planServiceText_("", record.period);
    var key = planServiceBusinessKey_(period, record.size);
    if (requestedKeys[key]) conflicts.push(requestedKeys[key] + " - " + size);
  });
  return conflicts;
}

function planServiceBusinessKey_(period, size) {
  return String(period || "").trim() + "\u0001" +
    String(size || "").trim().toLocaleLowerCase("vi");
}

function planServiceRequiredText_(value, fieldName) {
  var text = value === null || value === undefined ? "" : String(value).trim();
  if (!text) throw new Error(fieldName + " là bắt buộc.");
  return text;
}

function planServiceListRepositoryByType_(type) {
  return type === "thang" ? planRepositoryListMonthly() : planRepositoryListDaily();
}

function planServiceInsertRepositoryByType_(type, records) {
  return type === "thang"
    ? planRepositoryInsertManyMonthly(records)
    : planRepositoryInsertManyDaily(records);
}

function planServiceUpdateRepositoryByType_(type, id, record) {
  return type === "thang"
    ? planRepositoryUpdateMonthlyById(id, record)
    : planRepositoryUpdateDailyById(id, record);
}

function planServiceDeleteRepositoryByType_(type, id) {
  return type === "thang"
    ? planRepositoryDeleteMonthlyById(id)
    : planRepositoryDeleteDailyById(id);
}

function planServiceWithWriteLock_(callback) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function planServiceThrowOperationError_(operation, prefix, error) {
  var message = error && error.message ? error.message : String(error);
  Logger.log(operation + " error: " + message);
  throw new Error(prefix + ": " + message);
}

function planServiceIsEmptyRow_(values, displayValues) {
  for (var index = 0; index < PLAN_REPOSITORY_CONFIG.columnCount; index++) {
    var rawValue = values[index];
    var displayValue = displayValues[index];
    if (rawValue !== "" && rawValue !== null && rawValue !== undefined) return false;
    if (String(displayValue || "").trim()) return false;
  }
  return true;
}

function planServiceText_(displayValue, rawValue) {
  var value = displayValue !== "" && displayValue !== null && displayValue !== undefined
    ? displayValue
    : rawValue;
  return value === null || value === undefined ? "" : String(value).trim();
}

function planServiceNumber_(value) {
  if (typeof value === "number" && isFinite(value)) return value;
  var normalized = String(value === null || value === undefined ? "" : value)
    .replace(/\s/g, "")
    .replace(/,/g, "");
  var number = Number(normalized);
  return isFinite(number) ? number : 0;
}
