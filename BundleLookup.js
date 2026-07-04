var BUNDLE_LOOKUP_SHEET_NAME = 'SL nh\u1eadn t\u1eeb KH';
var BUNDLE_LOOKUP_CACHE_PREFIX = 'NKT_BUNDLE_LOOKUP_FAST_V1';
var BUNDLE_LOOKUP_CACHE_MASTER_KEY = BUNDLE_LOOKUP_CACHE_PREFIX + '_KEYS';
var BUNDLE_LOOKUP_HEADER_SCAN_ROWS = 20;

function testLookupBundleInfo() {
  var result = lookupBundleInfo('6/25A1');
  Logger.log(JSON.stringify(result));
  return result;
}

function lookupBundleInfo(bundleCode, ssObj, timing) {
  var empty = _bundleLookupResult_(false, '', '', '');
  var normalizedKey = _bundleLookupNormalizeBundle_(bundleCode);

  if (!normalizedKey) {
    _bundleLookupSetTiming_(timing, 'lookup bundle', 'empty_bundle_code');
    return empty;
  }

  var cached = _bundleLookupReadCache_(normalizedKey);
  if (cached) {
    _bundleLookupSetTiming_(timing, 'lookup bundle', 'cache_hit');
    return cached;
  }

  try {
    var ss = ssObj || _bundleLookupGetSpreadsheet_();
    if (!ss) {
      _bundleLookupSetTiming_(timing, 'lookup bundle', 'no_spreadsheet');
      return empty;
    }

    var tSheet = Date.now();
    var sheet = _bundleLookupGetSheet_(ss);
    _bundleLookupSetTiming_(timing, 'lookup sheet', Date.now() - tSheet);
    if (!sheet) {
      _bundleLookupSetTiming_(timing, 'lookup bundle', 'sheet_not_found');
      return empty;
    }

    var table = _bundleLookupScanSheet_(sheet, timing);
    if (!table || table.colBundle < 0 || table.dataRowCount <= 0) {
      _bundleLookupSetTiming_(timing, 'lookup bundle', 'header_or_data_not_found');
      return empty;
    }

    var matchRow = _bundleLookupFindMatchRow_(table, bundleCode, normalizedKey, timing);
    if (matchRow < 0) {
      _bundleLookupWriteCache_(normalizedKey, empty);
      _bundleLookupSetTiming_(timing, 'lookup bundle', 'not_found');
      return empty;
    }

    var tRead = Date.now();
    var row = sheet.getRange(matchRow, 1, 1, table.lastCol).getValues()[0];
    _bundleLookupSetTiming_(timing, 'lookup matched row read', Date.now() - tRead);

    var fromWell = table.colWell >= 0 ? _bundleLookupTrim_(row[table.colWell]) : '';
    var fromRig = table.colRig >= 0 ? _bundleLookupTrim_(row[table.colRig]) : '';
    var wellProfile = table.colProfile >= 0 ? _bundleLookupTrim_(row[table.colProfile]) : '';
    var result = _bundleLookupResult_(true, fromWell, fromRig, wellProfile);

    _bundleLookupWriteCache_(normalizedKey, result);
    _bundleLookupSetTiming_(timing, 'lookup bundle', 'fetched_and_cached');
    return result;
  } catch (e) {
    Logger.log('lookupBundleInfo error: ' + (e && e.stack ? e.stack : e));
    _bundleLookupSetTiming_(timing, 'lookup bundle', 'error');
    return empty;
  }
}

function clearBundleLookupCache() {
  try {
    var cache = CacheService.getScriptCache();
    var raw = cache.get(BUNDLE_LOOKUP_CACHE_MASTER_KEY);
    var keys = raw ? JSON.parse(raw) : [];
    for (var i = 0; i < keys.length; i++) {
      cache.remove(_bundleLookupCacheKey_(keys[i]));
    }
    cache.remove(BUNDLE_LOOKUP_CACHE_MASTER_KEY);
    return { success: true, message: 'Bundle lookup cache cleared: ' + keys.length + ' entries.' };
  } catch (e) {
    return { success: false, message: String(e && e.message ? e.message : e) };
  }
}

function _bundleLookupGetFormulaMeta_(ssObj) {
  try {
    var ss = ssObj || _bundleLookupGetSpreadsheet_();
    if (!ss) return null;

    var sheet = _bundleLookupGetSheet_(ss);
    if (!sheet) return null;

    var table = _bundleLookupScanSheet_(sheet, null);
    if (!table || table.colBundle < 0 || table.dataRowCount <= 0) return null;

    return {
      sheetNameForFormula: _bundleLookupFormulaSheetName_(sheet.getName()),
      dataStartRow: table.dataStartRow,
      lastRow: table.lastRow,
      bundleColA1: _bundleLookupColumnToA1_(table.colBundle + 1),
      wellColA1: table.colWell >= 0 ? _bundleLookupColumnToA1_(table.colWell + 1) : '',
      rigColA1: table.colRig >= 0 ? _bundleLookupColumnToA1_(table.colRig + 1) : '',
      profileColA1: table.colProfile >= 0 ? _bundleLookupColumnToA1_(table.colProfile + 1) : ''
    };
  } catch (e) {
    Logger.log('Bundle formula meta error: ' + (e && e.stack ? e.stack : e));
    return null;
  }
}

function _bundleLookupGetSheet_(ss) {
  var exact = ss.getSheetByName(BUNDLE_LOOKUP_SHEET_NAME);
  if (exact) return exact;

  var target = _bundleLookupNormalizeHeader_(BUNDLE_LOOKUP_SHEET_NAME);
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (_bundleLookupNormalizeHeader_(sheets[i].getName()) === target) {
      return sheets[i];
    }
  }
  return null;
}

function _bundleLookupGetSpreadsheet_() {
  if (typeof getSpreadsheet === 'function') {
    return getSpreadsheet();
  }
  if (typeof SPREADSHEET_ID !== 'undefined' && SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function _bundleLookupScanSheet_(sheet, timing) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return null;

  var scanRows = Math.min(BUNDLE_LOOKUP_HEADER_SCAN_ROWS, lastRow);
  var tHeader = Date.now();
  var headerData = sheet.getRange(1, 1, scanRows, lastCol).getValues();
  _bundleLookupSetTiming_(timing, 'lookup header scan', Date.now() - tHeader);

  var headerRowIdx = -1;
  var colBundle = -1;
  var colWell = -1;
  var colRig = -1;
  var colProfile = -1;
  var colNote = -1;

  for (var r = 0; r < headerData.length; r++) {
    var row = headerData[r];
    var tmpBundle = -1;
    var tmpWell = -1;
    var tmpRig = -1;
    var tmpProfile = -1;
    var tmpNote = -1;

    for (var c = 0; c < row.length; c++) {
      var h = _bundleLookupNormalizeHeader_(row[c]);
      if (!h) continue;
      if (_bundleLookupIsBundleHeader_(h)) tmpBundle = c;
      if (_bundleLookupIsWellHeader_(h)) tmpWell = c;
      if (_bundleLookupIsRigHeader_(h)) tmpRig = c;
      if (_bundleLookupIsProfileHeader_(h)) tmpProfile = c;
      if (_bundleLookupIsNoteHeader_(h)) tmpNote = c;
    }

    if (tmpBundle >= 0) {
      headerRowIdx = r;
      colBundle = tmpBundle;
      colWell = tmpWell;
      colRig = tmpRig;
      colProfile = tmpProfile >= 0 ? tmpProfile : tmpNote;
      colNote = tmpNote;
      break;
    }
  }

  if (headerRowIdx < 0 || colBundle < 0) return null;

  var dataStartRow = headerRowIdx + 2;
  var dataRowCount = Math.max(0, lastRow - headerRowIdx - 1);
  return {
    sheet: sheet,
    lastRow: lastRow,
    lastCol: lastCol,
    colBundle: colBundle,
    colWell: colWell,
    colRig: colRig,
    colProfile: colProfile,
    colNote: colNote,
    dataStartRow: dataStartRow,
    dataRowCount: dataRowCount
  };
}

function _bundleLookupColumnToA1_(columnNumber) {
  var label = '';
  while (columnNumber > 0) {
    var remainder = (columnNumber - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    columnNumber = Math.floor((columnNumber - 1) / 26);
  }
  return label;
}

function _bundleLookupFormulaSheetName_(name) {
  return String(name || '').replace(/'/g, "''");
}

function _bundleLookupFindMatchRow_(table, rawBundleCode, normalizedKey, timing) {
  var range = table.sheet.getRange(table.dataStartRow, table.colBundle + 1, table.dataRowCount, 1);

  try {
    var tFinder = Date.now();
    var found = range
      .createTextFinder(String(rawBundleCode || '').trim())
      .matchCase(false)
      .matchEntireCell(true)
      .findNext();
    _bundleLookupSetTiming_(timing, 'lookup text finder', Date.now() - tFinder);
    if (found) return found.getRow();
  } catch (e) {
    Logger.log('TextFinder fallback: ' + e);
  }

  var tCol = Date.now();
  var values = range.getValues();
  _bundleLookupSetTiming_(timing, 'lookup bundle column read', Date.now() - tCol);

  var tLoop = Date.now();
  for (var i = 0; i < values.length; i++) {
    if (_bundleLookupNormalizeBundle_(values[i][0]) === normalizedKey) {
      _bundleLookupSetTiming_(timing, 'lookup bundle match loop', Date.now() - tLoop);
      return table.dataStartRow + i;
    }
  }
  _bundleLookupSetTiming_(timing, 'lookup bundle match loop', Date.now() - tLoop);
  return -1;
}

function _bundleLookupResult_(found, fromWell, fromRig, wellProfile) {
  return {
    found: !!found,
    fromWell: fromWell || '',
    fromRig: fromRig || '',
    wellProfile: wellProfile || '',
    bbgn: wellProfile || '',
    tuGieng: fromWell || '',
    tuGian: fromRig || '',
    hoSoGieng: wellProfile || ''
  };
}

function _bundleLookupNormalizeHeader_(value) {
  if (value == null) return '';
  var s = String(value).trim().toLowerCase();
  if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/\u0111/g, 'd').replace(/\u0110/g, 'd');
  return s.replace(/[^a-z0-9]/g, '');
}

function _bundleLookupNormalizeBundle_(value) {
  if (value == null) return '';
  return String(value).trim().toUpperCase().replace(/\s+/g, '');
}

function _bundleLookupTrim_(value) {
  return value == null ? '' : String(value).trim();
}

function _bundleLookupIsBundleHeader_(h) {
  return h === 'mabo' || h.indexOf('mabo') !== -1;
}

function _bundleLookupIsWellHeader_(h) {
  return h === 'tugieng' || h.indexOf('tugieng') !== -1;
}

function _bundleLookupIsRigHeader_(h) {
  return (h === 'tugian' || h.indexOf('tugian') !== -1) && h.indexOf('tugieng') === -1;
}

function _bundleLookupIsProfileHeader_(h) {
  return h === 'sobbgn' || h.indexOf('sobbgn') !== -1 ||
    h === 'hosogieng' || h.indexOf('hosogieng') !== -1;
}

function _bundleLookupIsNoteHeader_(h) {
  return h === 'ghichu' || h.indexOf('ghichu') !== -1;
}

function _bundleLookupCacheKey_(normalizedKey) {
  var encoded = Utilities.base64EncodeWebSafe(normalizedKey);
  if (encoded.length > 160) encoded = encoded.substring(0, 160);
  return BUNDLE_LOOKUP_CACHE_PREFIX + '_' + encoded;
}

function _bundleLookupReadCache_(normalizedKey) {
  try {
    var raw = CacheService.getScriptCache().get(_bundleLookupCacheKey_(normalizedKey));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function _bundleLookupWriteCache_(normalizedKey, result) {
  try {
    var cache = CacheService.getScriptCache();
    cache.put(
      _bundleLookupCacheKey_(normalizedKey),
      JSON.stringify(result),
      21600
    );

    var raw = cache.get(BUNDLE_LOOKUP_CACHE_MASTER_KEY);
    var keys = raw ? JSON.parse(raw) : [];
    if (keys.indexOf(normalizedKey) === -1) {
      keys.push(normalizedKey);
      if (keys.length > 200) keys = keys.slice(keys.length - 200);
      cache.put(BUNDLE_LOOKUP_CACHE_MASTER_KEY, JSON.stringify(keys), 21600);
    }
  } catch (e) {
    Logger.log('Bundle lookup cache write error: ' + e);
  }
}

function _bundleLookupSetTiming_(timing, key, value) {
  if (timing) timing[key] = value;
}
