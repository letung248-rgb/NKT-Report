var SUBMIT_FAST_ACK_ENABLED = false;
var SUBMIT_FAST_ACK_MAX_ROWS = 120;
var SUBMIT_QUEUE_PROPERTY_PREFIX = 'SUBMIT_QUEUE_JOB_';
var SUBMIT_QUEUE_TRIGGER_PENDING_KEY = 'SUBMIT_QUEUE_TRIGGER_PENDING';
var SUBMIT_QUEUE_LAST_SYNC_KEY = 'SUBMIT_QUEUE_LAST_SYNC_AT';
var SUBMIT_QUEUE_TRIGGER_STALE_MS = 10 * 60 * 1000;
var SUBMIT_QUEUE_TRIGGER_DELAY_MS = 60 * 1000;
var SUBMIT_QUEUE_MAX_PROPERTY_CHARS = 7500;
var SUBMIT_QUEUE_MAX_JOBS_PER_RUN = 30;

function submitReport(payload) {
  var tStart = Date.now();
  var timing = {};
  var lock = null;

  try {
    payload = payload || {};

    var tValidate = Date.now();
    var dataSheetName = _submitGetDataSheetName_();
    var data = _submitReadPayload_(payload);
    var pipeList = _submitParsePipeList_(data.pipeNoStr);
    timing.validateMs = Date.now() - tValidate;
    if (pipeList.length === 0) return _submitError_('Thieu so ong hop le.', timing, tStart);

    var now = new Date();

    var tBuildFast = Date.now();
    var fastRows = _submitBuildRows_(data, pipeList, now, function(target) {
      return _submitDynamicBundleFormula_(target);
    });
    timing.buildRows = Date.now() - tBuildFast;

    var fastAppend = _submitAppendRowsFast_(dataSheetName, fastRows, timing);
    if (fastAppend.success) {
      timing.writeMs = timing.fastAppend || 0;
      timing.lockWaitMs = 0;
      timing.businessUpdateMs = 0;
      timing.syncMs = 0;
      timing.flushMs = 0;
      timing.mode = 'fast_append';
      timing.total = Date.now() - tStart;
      timing.totalMs = timing.total;
      Logger.log('submitReport timing: ' + JSON.stringify(timing));
      return _submitSuccess_(fastRows.length, fastAppend.startRow, timing);
    }

    timing.fastAppendFallback = fastAppend.message || 'fast append unavailable';

    var tOpen = Date.now();
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    timing.openSpreadsheet = Date.now() - tOpen;
    if (!ss) return _submitError_('Khong tim thay Spreadsheet.', timing, tStart);

    var tSheet = Date.now();
    var sheet = ss.getSheetByName(dataSheetName);
    timing.getDataSheet = Date.now() - tSheet;
    if (!sheet) return _submitError_('Khong tim thay sheet: ' + dataSheetName, timing, tStart);

    var lookupFormulaMeta = null;
    if (data.bundleCode && (!data.fromWell || !data.fromRig || !data.wellProfile)) {
      var tFormulaMeta = Date.now();
      lookupFormulaMeta = _submitGetLookupFormulaMeta_(ss);
      timing.lookupFormulaMeta = Date.now() - tFormulaMeta;
    }

    var tLock = Date.now();
    lock = LockService.getDocumentLock() || LockService.getScriptLock();
    lock.waitLock(10000);
    timing.waitLock = Date.now() - tLock;
    timing.lockWaitMs = timing.waitLock;

    var tLastRow = Date.now();
    var startRow = sheet.getLastRow() + 1;
    timing.getLastRow = Date.now() - tLastRow;

    var tBuildFallback = Date.now();
    var rows = _submitBuildRows_(data, pipeList, now, function(target, rowNumber) {
      return _submitBundleFormula_(lookupFormulaMeta, target, rowNumber);
    }, startRow);
    timing.buildRowsFallback = Date.now() - tBuildFallback;

    var tSet = Date.now();
    sheet.getRange(startRow, 1, rows.length, 23).setValues(rows);
    timing.setValues = Date.now() - tSet;
    timing.writeMs = timing.setValues;
    invalidateDashboardDataCache_();

    if (lock) {
      lock.releaseLock();
      lock = null;
    }

    timing.businessUpdateMs = 0;
    timing.syncMs = 0;
    timing.flushMs = 0;
    timing.total = Date.now() - tStart;
    timing.totalMs = timing.total;
    timing.mode = 'spreadsheet_fallback';
    Logger.log('submitReport timing: ' + JSON.stringify(timing));
    return _submitSuccess_(rows.length, startRow, timing);
  } catch (error) {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (lockError) {}
    }
    Logger.log('submitReport error: ' + (error && error.stack ? error.stack : error));
    return _submitError_('Loi ghi du lieu: ' + (error && error.message ? error.message : error), timing, tStart);
  }
}

function authorizeFastAppendAccess() {
  var sheetName = _submitGetDataSheetName_();
  var ss = _submitGetSpreadsheet_();
  var sheet = ss && ss.getSheetByName(sheetName);
  var lastRow = sheet ? sheet.getLastRow() : null;

  var response = UrlFetchApp.fetch('https://www.googleapis.com/generate_204', {
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
    }
  });

  return {
    success: true,
    message: 'Authorization OK. Fast append can be used after redeploy.',
    sheetName: sheetName,
    lastRow: lastRow,
    urlFetchStatus: response.getResponseCode()
  };
}

function processSubmitQueue() {
  var tStart = Date.now();
  var timing = {};
  var lock = LockService.getScriptLock();
  var didWriteDashboardData = false;

  if (!lock.tryLock(30000)) {
    Logger.log('processSubmitQueue skipped: queue lock busy.');
    return;
  }

  try {
    var props = PropertiesService.getScriptProperties();
    var all = props.getProperties();
    var keys = [];

    for (var key in all) {
      if (key.indexOf(SUBMIT_QUEUE_PROPERTY_PREFIX) === 0) keys.push(key);
    }
    keys.sort();

    if (keys.length === 0) {
      props.deleteProperty(SUBMIT_QUEUE_TRIGGER_PENDING_KEY);
      _submitDeleteQueueTriggers_();
      Logger.log('processSubmitQueue: empty queue.');
      return;
    }

    var rowsBySheet = {};
    var sheetOrder = [];
    var processedKeys = [];
    var maxJobs = Math.min(keys.length, _submitQueueMaxJobsPerRun_());

    for (var i = 0; i < maxJobs; i++) {
      try {
        var job = JSON.parse(all[keys[i]]);
        if (job && job.rows && job.rows.length) {
          var jobSheetName = job.sheetName || _submitGetDataSheetName_();
          if (!rowsBySheet[jobSheetName]) {
            rowsBySheet[jobSheetName] = [];
            sheetOrder.push(jobSheetName);
          }
          for (var r = 0; r < job.rows.length; r++) rowsBySheet[jobSheetName].push(job.rows[r]);
          processedKeys.push(keys[i]);
        } else {
          processedKeys.push(keys[i]);
          Logger.log('processSubmitQueue empty job removed: ' + keys[i]);
        }
      } catch (parseError) {
        processedKeys.push(keys[i]);
        Logger.log('processSubmitQueue bad job removed: ' + keys[i] + ' | ' + parseError);
      }
    }

    if (sheetOrder.length > 0) {
      var tOpen = Date.now();
      var ss = _submitGetSpreadsheet_();
      timing.openSpreadsheet = Date.now() - tOpen;

      timing.rows = 0;
      timing.sheets = sheetOrder.length;

      for (var s = 0; s < sheetOrder.length; s++) {
        var sheetName = sheetOrder[s];
        var sheetRows = rowsBySheet[sheetName];
        var sheet = ss && ss.getSheetByName(sheetName);
        if (!sheet) throw new Error('Khong tim thay sheet: ' + sheetName);

        var tLastRow = Date.now();
        var startRow = sheet.getLastRow() + 1;
        timing.getLastRow = (timing.getLastRow || 0) + (Date.now() - tLastRow);

        var tWrite = Date.now();
        sheet.getRange(startRow, 1, sheetRows.length, 23).setValues(sheetRows);
        timing.setValues = (timing.setValues || 0) + (Date.now() - tWrite);
        timing.rows += sheetRows.length;
        timing.startRow = timing.startRow || startRow;
        if (sheetName === _submitGetDataSheetName_()) didWriteDashboardData = true;
      }
    }

    if (didWriteDashboardData) invalidateDashboardDataCache_();

    for (var d = 0; d < processedKeys.length; d++) {
      props.deleteProperty(processedKeys[d]);
    }

    if (processedKeys.length > 0) {
      props.setProperty(SUBMIT_QUEUE_LAST_SYNC_KEY, new Date().toISOString());
    }

    var remaining = keys.length - processedKeys.length;
    if (remaining > 0) {
      _submitEnsureQueueTrigger_(props, true);
    } else {
      props.deleteProperty(SUBMIT_QUEUE_TRIGGER_PENDING_KEY);
      _submitDeleteQueueTriggers_();
    }

    timing.total = Date.now() - tStart;
    Logger.log('processSubmitQueue timing: ' + JSON.stringify(timing));
  } catch (error) {
    Logger.log('processSubmitQueue error: ' + (error && error.stack ? error.stack : error));
    _submitEnsureQueueTrigger_(null, true);
  } finally {
    lock.releaseLock();
  }
}

function syncDashboardDataQueue() {
  try {
    var before = _submitCountQueueJobs_();
    processSubmitQueue();
    var after = _submitCountQueueJobs_();
    var processed = Math.max(before - after, 0);
    var queueStatus = getSubmitQueueStatus();

    if (before > 0 && after >= before) {
      return {
        success: false,
        message: 'Queue ch\u01b0a \u0111\u01b0\u1ee3c x\u1eed l\u00fd. Vui l\u00f2ng th\u1eed l\u1ea1i sau.',
        before: before,
        after: after,
        processed: processed,
        queueStatus: queueStatus
      };
    }

    var snapshotResult = refreshDashboardSnapshot_();
    if (!snapshotResult || !snapshotResult.success) {
      return {
        success: false,
        message: 'Du lieu da dong bo nhung dashboard snapshot rebuild that bai.',
        before: before,
        after: after,
        processed: processed,
        queueStatus: queueStatus,
        snapshotResult: snapshotResult
      };
    }

    return {
      success: true,
      message: before === 0
        ? 'Kh\u00f4ng c\u00f3 d\u1eef li\u1ec7u \u0111ang ch\u1edd \u0111\u1ed3ng b\u1ed9.'
        : '\u0110\u00e3 \u0111\u1ed3ng b\u1ed9 ' + processed + ' job queue.',
      before: before,
      after: after,
      processed: processed,
      queueStatus: queueStatus,
      snapshotResult: snapshotResult
    };
  } catch (error) {
    return {
      success: false,
      message: 'L\u1ed7i \u0111\u1ed3ng b\u1ed9 d\u1eef li\u1ec7u: ' + (error && error.message ? error.message : error)
    };
  }
}

function getSubmitQueueStatus() {
  try {
    var props = PropertiesService.getScriptProperties();
    var pendingJobs = _submitCountQueueJobs_(props);
    var lastSyncAt = props.getProperty(SUBMIT_QUEUE_LAST_SYNC_KEY) || '';
    var status = pendingJobs > 0 ? 'Processing' : (lastSyncAt ? 'Done' : 'Idle');

    return {
      success: true,
      pendingJobs: pendingJobs,
      lastSyncAt: lastSyncAt,
      status: status
    };
  } catch (error) {
    return {
      success: false,
      pendingJobs: 0,
      lastSyncAt: '',
      status: 'Idle',
      message: 'L\u1ed7i \u0111\u1ecdc tr\u1ea1ng th\u00e1i queue: ' + (error && error.message ? error.message : error)
    };
  }
}

function _submitReadPayload_(payload) {
  return {
    pipeNoStr: _submitTrim_(payload['w-so-ong']),
    reportDate: _submitParseDate_(payload['w-ngay']),
    process: _submitTrim_(payload['w-nguyen-cong']),
    status: _submitTrim_(payload['w-tinh-trang']),
    shift: _submitTrim_(payload['w-ca']),
    entryRound: _submitTrim_(payload['w-lan-nhap']),
    defectReason: _submitTrim_(payload['w-nguyen-nhan-loai']),
    pipeType: _submitTrim_(payload['w-loai-ong']),
    bundleCode: _submitTrim_(payload['w-ma-bo']),
    compartment: _submitTrim_(payload['w-khoang']),
    fromWell: _submitTrim_(payload['w-tu-gieng']),
    fromRig: _submitTrim_(payload['w-tu-gian']),
    wellProfile: _submitTrim_(payload['w-ho-so-gieng']),
    worker2: _submitTrim_(payload['w-nguoi-th-2']),
    note: _submitTrim_(payload['w-ghi-chu']),
    worker1: _submitTrim_(payload.worker1),
    waterMeter: _submitTrim_(payload['w-dong-ho']),
    pressure: _submitTrim_(payload['w-ap-suat']),
    thickness: _submitTrim_(payload['w-chieu-day'])
  };
}

function _submitBuildRows_(data, pipeList, now, formulaForTarget, startRow) {
  var reportDateText = _submitFormatDate_(data.reportDate || now);
  var receiveTimeText = _submitFormatTime_(now);
  var baseId = now.getTime();
  var importStatus = 'Nh\u1eadp m\u1edbi';
  var washingCount = _submitNormalizeText_(data.process).indexOf('rua ong') !== -1 ? 1 : '';
  var rows = [];

  for (var i = 0; i < pipeList.length; i++) {
    var rowNumber = startRow ? startRow + i : null;
    var rowFromWell = data.fromWell || (data.bundleCode && formulaForTarget ? formulaForTarget('well', rowNumber) : '');
    var rowFromRig = data.fromRig || (data.bundleCode && formulaForTarget ? formulaForTarget('rig', rowNumber) : '');
    var rowWellProfile = data.wellProfile || (data.bundleCode && formulaForTarget ? formulaForTarget('profile', rowNumber) : '');
    var rowNote = data.note || '';
    if (data.pressure) rowNote = rowNote ? rowNote + ' | Ap suat: ' + data.pressure : 'Ap suat: ' + data.pressure;
    if (data.thickness) rowNote = rowNote ? rowNote + ' | Chieu day: ' + data.thickness : 'Chieu day: ' + data.thickness;

    rows.push([
      reportDateText,
      data.shift,
      data.process,
      1,
      pipeList[i],
      data.entryRound,
      data.status,
      data.defectReason,
      importStatus,
      washingCount,
      data.waterMeter,
      data.pipeType,
      data.bundleCode,
      data.compartment,
      rowFromWell,
      rowFromRig,
      rowWellProfile,
      data.worker1,
      data.worker2,
      data.status,
      receiveTimeText,
      rowNote
        ? rowNote + ' | S\u1ed1 \u0111\u00e3 nh\u1eadp BC: ' + data.pipeNoStr
        : 'S\u1ed1 \u0111\u00e3 nh\u1eadp BC: ' + data.pipeNoStr,
      baseId + '-' + i + '-' + Math.floor(Math.random() * 10000)
    ]);
  }

  return rows;
}

function _submitAppendRowsFast_(sheetName, rows, timing) {
  if (typeof SPREADSHEET_ID === 'undefined' || !SPREADSHEET_ID) {
    return { success: false, message: 'SPREADSHEET_ID is missing' };
  }
  if (typeof UrlFetchApp === 'undefined' || typeof ScriptApp === 'undefined') {
    return { success: false, message: 'UrlFetchApp or ScriptApp is unavailable' };
  }

  try {
    var rangeName = _submitQuoteSheetNameForA1_(sheetName) + '!A:W';
    var url = 'https://sheets.googleapis.com/v4/spreadsheets/' +
      encodeURIComponent(SPREADSHEET_ID) +
      '/values/' +
      encodeURIComponent(rangeName) +
      ':append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS&includeValuesInResponse=false';

    var tFetch = Date.now();
    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
      },
      payload: JSON.stringify({ values: rows }),
      muteHttpExceptions: true
    });
    timing.fastAppend = Date.now() - tFetch;

    var code = response.getResponseCode();
    if (code < 200 || code >= 300) {
      var body = response.getContentText();
      return { success: false, message: 'Sheets API ' + code + ': ' + body.substring(0, 250) };
    }

    invalidateDashboardDataCache_();

    return {
      success: true,
      startRow: null
    };
  } catch (e) {
    return { success: false, message: String(e && e.message ? e.message : e) };
  }
}

function _submitQueueRowsForBackgroundWrite_(sheetName, rows, timing) {
  try {
    if (typeof PropertiesService === 'undefined' || typeof ScriptApp === 'undefined') {
      return { success: false, message: 'PropertiesService or ScriptApp is unavailable' };
    }

    var tQueue = Date.now();
    var jobs = _submitBuildQueueJobs_(sheetName, rows);
    if (!jobs.success) return jobs;

    var lock = LockService.getScriptLock();
    lock.waitLock(5000);

    var writtenKeys = [];
    try {
      var props = PropertiesService.getScriptProperties();
      for (var i = 0; i < jobs.jobs.length; i++) {
        props.setProperty(jobs.jobs[i].key, jobs.jobs[i].value);
        writtenKeys.push(jobs.jobs[i].key);
      }
      _submitEnsureQueueTrigger_(props);
    } catch (writeError) {
      try {
        var cleanupProps = PropertiesService.getScriptProperties();
        for (var d = 0; d < writtenKeys.length; d++) cleanupProps.deleteProperty(writtenKeys[d]);
      } catch (cleanupError) {
        Logger.log('submit queue cleanup error: ' + cleanupError);
      }
      throw writeError;
    } finally {
      lock.releaseLock();
    }

    timing.queueRows = Date.now() - tQueue;
    timing.queueJobs = jobs.jobs.length;
    return { success: true, jobs: jobs.jobs.length };
  } catch (e) {
    return { success: false, message: String(e && e.message ? e.message : e) };
  }
}

function _submitShouldFastAck_(payload, rows) {
  if (typeof SUBMIT_FAST_ACK_ENABLED !== 'undefined' && SUBMIT_FAST_ACK_ENABLED === false) {
    return { enabled: false, reason: 'disabled' };
  }

  payload = payload || {};
  if (payload.forceImmediateWrite || payload.immediateWrite || payload.syncWrite) {
    return { enabled: false, reason: 'payload_immediate' };
  }
  if (payload.fastAck === false || payload.queueFirst === false) {
    return { enabled: false, reason: 'payload_disabled' };
  }

  var maxRows = typeof SUBMIT_FAST_ACK_MAX_ROWS !== 'undefined' ? Number(SUBMIT_FAST_ACK_MAX_ROWS) : 0;
  if (maxRows > 0 && rows && rows.length > maxRows) {
    return { enabled: false, reason: 'too_many_rows' };
  }

  return { enabled: true };
}

function _submitBuildQueueJobs_(sheetName, rows) {
  rows = rows || [];
  if (!rows.length) return { success: false, message: 'No rows to queue' };

  var maxChars = _submitQueueMaxPropertyChars_();
  var createdAt = new Date().toISOString();
  var batchId = _submitQueueBatchId_();
  var jobs = [];
  var chunkRows = [];

  for (var i = 0; i < rows.length; i++) {
    var candidateRows = chunkRows.slice();
    candidateRows.push(rows[i]);

    var candidateValue = _submitQueueJobValue_(sheetName, candidateRows, createdAt, batchId, jobs.length);
    if (chunkRows.length > 0 && candidateValue.length > maxChars) {
      var currentValue = _submitQueueJobValue_(sheetName, chunkRows, createdAt, batchId, jobs.length);
      jobs.push(_submitQueueJob_(batchId, jobs.length, currentValue));
      chunkRows = [rows[i]];

      var singleValue = _submitQueueJobValue_(sheetName, chunkRows, createdAt, batchId, jobs.length);
      if (singleValue.length > maxChars) {
        return { success: false, message: 'Queue row is too large for ScriptProperties' };
      }
    } else {
      chunkRows = candidateRows;
    }
  }

  if (chunkRows.length > 0) {
    jobs.push(_submitQueueJob_(batchId, jobs.length, _submitQueueJobValue_(sheetName, chunkRows, createdAt, batchId, jobs.length)));
  }

  return { success: true, jobs: jobs };
}

function _submitQueueJobValue_(sheetName, rows, createdAt, batchId, chunkIndex) {
  return JSON.stringify({
    createdAt: createdAt,
    sheetName: sheetName,
    batchId: batchId,
    chunkIndex: chunkIndex,
    rows: rows
  });
}

function _submitQueueJob_(batchId, chunkIndex, value) {
  return {
    key: SUBMIT_QUEUE_PROPERTY_PREFIX + batchId + '_' + _submitPadQueueIndex_(chunkIndex),
    value: value
  };
}

function _submitQueueBatchId_() {
  var uuid = typeof Utilities !== 'undefined' && Utilities.getUuid
    ? Utilities.getUuid().replace(/-/g, '').substring(0, 8)
    : String(Math.floor(Math.random() * 100000000));
  return String(Date.now()) + '_' + uuid;
}

function _submitPadQueueIndex_(index) {
  var s = String(index);
  while (s.length < 4) s = '0' + s;
  return s;
}

function _submitQueueMaxPropertyChars_() {
  var maxChars = typeof SUBMIT_QUEUE_MAX_PROPERTY_CHARS !== 'undefined'
    ? Number(SUBMIT_QUEUE_MAX_PROPERTY_CHARS)
    : 7500;
  return maxChars > 1000 ? maxChars : 7500;
}

function _submitQueueMaxJobsPerRun_() {
  var maxJobs = typeof SUBMIT_QUEUE_MAX_JOBS_PER_RUN !== 'undefined'
    ? Number(SUBMIT_QUEUE_MAX_JOBS_PER_RUN)
    : 30;
  return maxJobs > 0 ? maxJobs : 30;
}

function _submitCountQueueJobs_(props) {
  props = props || PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var count = 0;

  for (var key in all) {
    if (key.indexOf(SUBMIT_QUEUE_PROPERTY_PREFIX) === 0) count++;
  }

  return count;
}

function _submitGetSpreadsheet_() {
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}

  if (typeof SPREADSHEET_ID !== 'undefined' && SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  if (typeof getSpreadsheet === 'function') {
    return getSpreadsheet();
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function _submitGetDataSheetName_() {
  if (typeof SHEET_DATA !== 'undefined' && SHEET_DATA) {
    return SHEET_DATA;
  }
  if (typeof SHEET_NAME !== 'undefined' && SHEET_NAME) {
    return SHEET_NAME;
  }
  return 'Data';
}

function _submitGetLookupSheetName_() {
  if (typeof BUNDLE_LOOKUP_SHEET_NAME !== 'undefined' && BUNDLE_LOOKUP_SHEET_NAME) {
    return BUNDLE_LOOKUP_SHEET_NAME;
  }
  return 'SL nh\u1eadn t\u1eeb KH';
}

function _submitParsePipeList_(input) {
  var pipes = [];
  var segments = String(input || '').split(/[\n,;]+/);
  for (var s = 0; s < segments.length; s++) {
    var part = segments[s].trim();
    if (!part) continue;

    var match = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (match) {
      var start = parseInt(match[1], 10);
      var end = parseInt(match[2], 10);
      if (!isNaN(start) && !isNaN(end)) {
        var min = Math.min(start, end);
        var max = Math.max(start, end);
        for (var n = min; n <= max; n++) pipes.push(String(n));
        continue;
      }
    }
    pipes.push(part);
  }
  return pipes;
}

function _submitParseDate_(value) {
  var text = _submitTrim_(value);
  var match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  var year = parseInt(match[1], 10);
  var month = parseInt(match[2], 10) - 1;
  var day = parseInt(match[3], 10);
  var date = new Date(year, month, day);

  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  return date;
}

var _SUBMIT_MONTH_ABBR_ = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function _submitPad2_(value) {
  return value < 10 ? '0' + value : String(value);
}

function _submitFormatDate_(date) {
  return _submitPad2_(date.getDate()) + '-' + _SUBMIT_MONTH_ABBR_[date.getMonth()] + '-' + date.getFullYear();
}

function _submitFormatTime_(date) {
  return _submitPad2_(date.getHours()) + ':' + _submitPad2_(date.getMinutes()) + ':' + _submitPad2_(date.getSeconds());
}

function _submitDynamicBundleFormula_(target) {
  var lookupSheet = "'" + _submitFormulaSheetName_(_submitGetLookupSheetName_()) + "'";
  var headerRange = lookupSheet + '!$A$1:$Z$20';
  var dataRange = lookupSheet + '!$A:$Z';
  var headerMatch = _submitFormulaMatchAny_(['M\u00e3 b\u00f3', 'Ma bo']);
  var valueMatch = _submitFormulaMatchAny_(_submitTargetHeaders_(target));

  return '=IF(INDEX($M:$M,ROW())="","",IFERROR(LET(hdr,' + headerRange +
    ',rng,' + dataRange +
    ',pos,' + headerMatch +
    ',hr,INT((pos-1)/COLUMNS(hdr))+1' +
    ',mbc,MOD(pos-1,COLUMNS(hdr))+1' +
    ',vpos,' + valueMatch +
    ',vc,MOD(vpos-1,COLUMNS(hdr))+1' +
    ',INDEX(rng,MATCH(INDEX($M:$M,ROW()),INDEX(rng,0,mbc),0),vc)),""))';
}

function _submitTargetHeaders_(target) {
  if (target === 'well') return ['T\u1eeb gi\u1ebfng', 'Tu gieng'];
  if (target === 'rig') return ['T\u1eeb gi\u00e0n', 'Tu gian'];
  return ['S\u1ed1 BBGN', 'So BBGN', 'H\u1ed3 s\u01a1 gi\u1ebfng', 'Ho so gieng', 'Ghi ch\u00fa', 'Ghi chu'];
}

function _submitFormulaMatchAny_(headers) {
  var expr = 'MATCH("' + headers[0] + '",FLATTEN(hdr),0)';
  if (headers.length === 1) return expr;

  for (var i = 1; i < headers.length; i++) {
    expr = 'IFERROR(' + expr + ',MATCH("' + headers[i] + '",FLATTEN(hdr),0))';
  }
  return expr;
}

function _submitBundleFormula_(meta, target, rowNumber) {
  if (!meta || !meta.bundleColA1 || !meta[target + 'ColA1']) return _submitDynamicBundleFormula_(target);

  var valueColA1 = meta[target + 'ColA1'];
  var bundleRange = "'" + meta.sheetNameForFormula + "'!$" + meta.bundleColA1 + "$" + meta.dataStartRow + ':$' + meta.bundleColA1 + '$' + meta.lastRow;
  var valueRange = "'" + meta.sheetNameForFormula + "'!$" + valueColA1 + "$" + meta.dataStartRow + ':$' + valueColA1 + '$' + meta.lastRow;

  return '=IF($M' + rowNumber + '="","",IFERROR(INDEX(' + valueRange + ',MATCH($M' + rowNumber + ',' + bundleRange + ',0)),""))';
}

function _submitGetLookupFormulaMeta_(ss) {
  if (typeof _bundleLookupGetFormulaMeta_ === 'function') {
    return _bundleLookupGetFormulaMeta_(ss);
  }
  return null;
}

function _submitNormalizeText_(value) {
  var s = String(value || '').trim().toLowerCase();
  if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return s.replace(/\u0111/g, 'd');
}

function _submitTrim_(value) {
  return value == null ? '' : String(value).trim();
}

function _submitQuoteSheetNameForA1_(name) {
  return "'" + _submitFormulaSheetName_(name) + "'";
}

function _submitFormulaSheetName_(name) {
  return String(name || '').replace(/'/g, "''");
}

function _submitEnsureQueueTrigger_(props, force) {
  props = props || PropertiesService.getScriptProperties();
  var now = Date.now();
  var pending = props.getProperty(SUBMIT_QUEUE_TRIGGER_PENDING_KEY);
  var pendingAt = Number(pending || 0);
  if (!force && pendingAt && now - pendingAt < SUBMIT_QUEUE_TRIGGER_STALE_MS) return;

  if (force) {
    _submitDeleteQueueTriggers_();
  }

  var triggers = force ? [] : ScriptApp.getProjectTriggers();

  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction && triggers[i].getHandlerFunction() === 'processSubmitQueue') {
      props.setProperty(SUBMIT_QUEUE_TRIGGER_PENDING_KEY, String(now));
      return;
    }
  }

  ScriptApp.newTrigger('processSubmitQueue')
    .timeBased()
    .after(SUBMIT_QUEUE_TRIGGER_DELAY_MS)
    .create();
  props.setProperty(SUBMIT_QUEUE_TRIGGER_PENDING_KEY, String(now));
}

function _submitDeleteQueueTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction && triggers[i].getHandlerFunction() === 'processSubmitQueue') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function _submitSuccess_(rowCount, startRow, timing) {
  return {
    success: true,
    message: '\u0110\u00e3 ghi ' + rowCount + ' d\u00f2ng d\u1eef li\u1ec7u th\u00e0nh c\u00f4ng.',
    rows: rowCount,
    startRow: startRow || null,
    endRow: startRow ? startRow + rowCount - 1 : null,
    timing: timing
  };
}

function _submitQueuedSuccess_(rowCount, timing) {
  return {
    success: true,
    queued: true,
    message: '\u0110\u00e3 nh\u1eadn ' + rowCount + ' d\u00f2ng b\u00e1o c\u00e1o. H\u1ec7 th\u1ed1ng s\u1ebd ghi v\u00e0o Sheet trong n\u1ec1n.',
    rows: rowCount,
    startRow: null,
    endRow: null,
    timing: timing
  };
}

function _submitError_(message, timing, tStart) {
  timing = timing || {};
  timing.total = Date.now() - tStart;
  timing.totalMs = timing.total;
  return {
    success: false,
    message: message,
    timing: timing
  };
}
