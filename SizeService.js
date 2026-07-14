/**
 * Public read API used by PlanModule.html for the canonical Size catalog.
 */
function getActiveSizeCatalog() {
  try {
    var repositoryData = sizeRepositoryReadAll_();
    var items = sizeServiceBuildActiveItems_(repositoryData.rows);

    return {
      success: true,
      data: {
        sizes: items.map(function(item) { return item.size; })
      },
      meta: {
        sheetName: repositoryData.sheetName,
        activeCount: items.length,
        readOnly: true
      }
    };
  } catch (error) {
    var message = error && error.message ? error.message : String(error);
    Logger.log("getActiveSizeCatalog error: " + message);
    throw new Error("Không đọc được danh mục Size: " + message);
  }
}

/**
 * Admin-only setup. Run manually from the Apps Script editor.
 * Existing DANH_MUC_SIZE data is never changed by this function.
 */
function adminSetupAndSeedSizeCatalog() {
  return sizeRepositorySetupAndSeed_();
}

function sizeServiceBuildActiveItems_(rows) {
  var items = [];

  (Array.isArray(rows) ? rows : []).forEach(function(repositoryRow, index) {
    var values = repositoryRow.values || [];
    var displayValues = repositoryRow.displayValues || [];
    var size = sizeServiceText_(displayValues[0], values[0]);
    var active = sizeServiceIsActive_(values[1], displayValues[1]);
    if (!size || !active) return;

    items.push({
      size: size,
      order: sizeServiceOrder_(values[2], displayValues[2]),
      rowNumber: repositoryRow.rowNumber || index + 2
    });
  });

  items.sort(function(left, right) {
    if (left.order !== right.order) return left.order - right.order;
    return left.rowNumber - right.rowNumber;
  });

  var seen = {};
  return items.filter(function(item) {
    var key = item.size.toLocaleLowerCase("vi");
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function sizeServiceIsActive_(rawValue, displayValue) {
  if (rawValue === true) return true;
  var normalized = sizeServiceText_(displayValue, rawValue).toLocaleLowerCase("vi");
  return normalized === "true" || normalized === "1";
}

function sizeServiceOrder_(rawValue, displayValue) {
  var value = rawValue !== "" && rawValue !== null && rawValue !== undefined
    ? rawValue
    : displayValue;
  var order = Number(value);
  return isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
}

function sizeServiceText_(displayValue, rawValue) {
  var value = displayValue !== "" && displayValue !== null && displayValue !== undefined
    ? displayValue
    : rawValue;
  return value === null || value === undefined ? "" : String(value).trim();
}
