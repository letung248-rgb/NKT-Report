# NKT Management System - Coding Standard

## Apps Script Global Scope

Apps Script files share global scope.

Use clear and unique function names to avoid accidental collisions.

Do not assume module imports/exports between `.js` files. Apps Script loads project files into the same runtime scope.

## Function Naming

Function names should describe their responsibility clearly.

Examples:

- `getDashboardData()`
- `buildPipeEngine()`
- `isThanhPhamKpiPipe()`
- `lookupBundleInfo()`
- `processSubmitQueue()`

## UI and Business Logic Boundary

Do not put business rule changes in UI files.

UI files should collect input, call server functions, and render results.

Business rules should live in server-side modules.

## Dashboard Business Logic

Dashboard business logic belongs in `DashboardServer.js`.

Do not modify dashboard business rules from `Dashboard.html`.

## Submit Write Path

Submit write behavior belongs in `SubmitReport.js`.

Keep worker submit logic separate from dashboard read logic.

## Read Path and Write Path

Read path:

- `DashboardServer.js`
- `Utils.js`
- Google Sheet

Write path:

- `Index.html`
- `SubmitReport.js`
- Google Sheet

Keep these paths separated unless a task explicitly requires integration.

## Shared Constants

Use existing shared constants such as `SPREADSHEET_ID`, `SHEET_DATA`, `SHEET_PLAN`, and `DATA_COLUMN_COUNT` when working in server-side code.

Do not duplicate sheet names or column counts unless a compatibility fallback is explicitly required.

## Refactor Policy

Do not perform large refactors without a dedicated task.

Small cleanup is acceptable only when it is required by the active task.

## Business Rule Helpers

Business rule helpers must have clear names and narrow responsibility.

Example:

- `isThanhPhamKpiPipe(pipe)` is specifically for KPI Thanh pham.

Do not hide business rule changes inside generic helpers.
