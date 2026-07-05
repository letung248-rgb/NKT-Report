# NKT Management System - System Architecture

## Overall Architecture

NKT Management System is a Google Apps Script Web App with Google Sheet as the main database.

The application is organized around two UI surfaces:

- Worker/Mobile UI for submitting production reports.
- Dashboard UI for reading aggregated production status and KPI.

Server-side Apps Script files provide routing, write path, read path, business rules, lookup service, queue processing, and infrastructure integration with Google services.

## Main Modules

- `Code.js`: Web App entry point and shared constants.
- `Index.html`: Worker/Mobile UI.
- `SubmitReport.js`: report submit service and write path.
- `Dashboard.html`: Dashboard UI.
- `DashboardServer.js`: dashboard business logic and KPI service.
- `Utils.js`: spreadsheet read helpers and shared utilities.
- `BundleLookup.js`: bundle lookup service.
- `appsscript.json`: Apps Script runtime, OAuth, and Web App configuration.

## Layers

### Presentation Layer

- `Index.html`
- `Dashboard.html`

### Application Layer

- `Code.js`
- `SubmitReport.js`
- `DashboardServer.js`

### Business Layer

- `DashboardServer.js`
- selected submit policy and row-building logic in `SubmitReport.js`

### Data Layer

- `Utils.js`
- `SubmitReport.js`
- `BundleLookup.js`

### Infrastructure Layer

- `appsscript.json`
- `.clasp.json`
- Apps Script services: `SpreadsheetApp`, `ScriptApp`, `PropertiesService`, `CacheService`, `LockService`, `UrlFetchApp`

## Dependency Graph

```text
Code.js
    |
    +-- Index.html
    |       |
    |       +-- google.script.run.submitReport()
    |               |
    |               +-- SubmitReport.js
    |                       |
    |                       +-- BundleLookup.js
    |                       |       |
    |                       |       +-- Google Sheet: SL nhận từ KH
    |                       |
    |                       +-- Google Sheet: Data
    |                       +-- PropertiesService / ScriptApp / LockService
    |
    +-- Dashboard.html
            |
            +-- google.script.run.getDashboardData()
                    |
                    +-- DashboardServer.js
                            |
                            +-- Utils.js
                                    |
                                    +-- Google Sheet: Data
                                    +-- Google Sheet: Kế hoạch
```

## File Responsibilities

### Code.js

- Defines shared constants such as `SPREADSHEET_ID`, `SHEET_DATA`, `SHEET_PLAN`, and `DATA_COLUMN_COUNT`.
- Defines `doGet(e)`.
- Routes `view=dashboard` or `view=admin` to `Dashboard.html`.
- Routes default requests to `Index.html`.
- Contains legacy submit helper `submitReportLegacy_`.

### Index.html

- Worker/Mobile UI.
- Handles local UI state, form input, operation selection, basic validation, and submit feedback.
- Calls `submitReport(payload)` through `google.script.run`.

### SubmitReport.js

- Main write path for worker reports.
- Defines `submitReport(payload)`.
- Parses payload, expands pipe lists, builds rows, and writes to Google Sheet.
- Supports fast append, queue fallback, direct SpreadsheetApp fallback, and background queue processing.

### Dashboard.html

- Dashboard UI.
- Calls `getDashboardData()` through `google.script.run`.
- Renders KPI, status summaries, recent transactions, pipe lists, and drill-down views.

### DashboardServer.js

- Dashboard server source.
- Builds pipe engine from raw transactions.
- Owns dashboard business rules and KPI calculation.
- Defines `classifyBusinessStatus()`, `isThanhPhamKpiPipe()`, `buildPipeEngine()`, and `getDashboardData()`.

### Utils.js

- Shared data access and utility layer.
- Opens spreadsheet through `getSpreadsheet()`.
- Reads raw transactions from sheet `Data`.
- Reads plan data from sheet `Kế hoạch`.
- Provides column mapping, date/time parsing, and string normalization helpers.

### BundleLookup.js

- Lookup service for bundle information.
- Reads sheet `SL nhận từ KH`.
- Uses `CacheService` to cache lookup results.
- Provides formula metadata used by submit row generation.

### appsscript.json

- Defines Apps Script runtime settings.
- Defines OAuth scopes.
- Defines Web App execution/access settings.
