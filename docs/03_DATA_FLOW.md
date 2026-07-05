# NKT Management System - Data Flow

## Worker Submit Flow

```text
Worker/Mobile user
    -> Index.html
    -> google.script.run.submitReport(payload)
    -> SubmitReport.js
    -> Google Sheet: Data
```

Steps:

1. Worker enters report data in `Index.html`.
2. UI builds `payload`.
3. UI calls `submitReport(payload)`.
4. `SubmitReport.js` parses payload and expands pipe list.
5. Rows are built using the expected 23-column data layout.
6. Rows are written to Google Sheet `Data`.
7. Result is returned to `Index.html`.

## Dashboard Read Flow

```text
Dashboard user
    -> Dashboard.html
    -> google.script.run.getDashboardData()
    -> DashboardServer.js
    -> Utils.js
    -> Google Sheet: Data / Kế hoạch
    -> DashboardServer.js
    -> Dashboard.html
```

Steps:

1. Dashboard UI calls `getDashboardData()`.
2. `DashboardServer.js` calls `buildPipeEngine()`.
3. `buildPipeEngine()` reads raw transactions through `getRawTransactions()`.
4. `Utils.js` reads Google Sheet `Data`.
5. `DashboardServer.js` applies business rules and KPI calculations.
6. `DashboardServer.js` reads plan data through `getPlanData()`.
7. `Utils.js` reads Google Sheet `Kế hoạch`.
8. Final dashboard data is returned to `Dashboard.html`.

## Bundle Lookup Flow

```text
SubmitReport.js / BundleLookup.js
    -> lookupBundleInfo() or formula metadata
    -> BundleLookup.js
    -> CacheService
    -> Google Sheet: SL nhận từ KH
```

Steps:

1. Bundle code is normalized.
2. Cache is checked first.
3. If not cached, `BundleLookup.js` opens the spreadsheet.
4. Sheet `SL nhận từ KH` is scanned.
5. Matching bundle information is returned and cached.

## Queue / Fallback Submit Flow

`SubmitReport.js` supports multiple write paths:

```text
submitReport(payload)
    -> build rows
    -> queued fast ack if enabled and eligible
    -> fast append through Sheets API if available
    -> queued fallback through PropertiesService
    -> direct SpreadsheetApp fallback
```

Background queue:

```text
PropertiesService queue
    -> ScriptApp time trigger
    -> processSubmitQueue()
    -> Google Sheet: Data
```

If queued jobs remain, the queue trigger may be scheduled again. If queue is empty, queue trigger state is cleared.
