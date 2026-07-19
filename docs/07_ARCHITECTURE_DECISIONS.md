# NKT Management System - Architecture Decisions

## ADR-001: Dashboard Server Source

Decision: `DashboardServer.js` is the standard server source for dashboard logic.

Rationale: Dashboard data assembly, pipe engine, KPI calculation, and dashboard business rules are implemented there.

## ADR-002: Legacy Dashboard.js Removal

Decision: `Dashboard.js` is a legacy file and has been removed.

Rationale: Active dashboard server logic is in `DashboardServer.js`.

## ADR-003: Dashboard UI Location

Decision: Dashboard UI lives in `Dashboard.html`.

Rationale: `Code.js` renders `Dashboard.html` for `view=dashboard` or `view=admin`.

## ADR-004: Dashboard Business Logic Location

Decision: Dashboard assembly lives in `DashboardServer.js`; shared business rules live in `BusinessRules.gs`.

Rationale: `Dashboard.html` calls `getDashboardData()`, the server-side calculation happens in `DashboardServer.js`, and current-state/KPI rule decisions are delegated to `BusinessRules.gs`.

## ADR-005: KPI Thanh Pham Rule

Decision: KPI Thanh pham keeps a helper, and the helper uses `BusinessRules.gs`.

Rationale: `isThanhPhamKpiPipe(pipe)` remains the compatibility helper, while BusinessRules keeps current-state awareness and legacy note compatibility in one place.

## ADR-006: Main Database

Decision: Google Sheet is the main database.

Rationale: Worker submit writes to Google Sheet, and dashboard reads from Google Sheet.

## ADR-007: Data Access Layer

Decision: `Utils.js` is currently the main data access/repository layer for dashboard reads.

Rationale: It opens the spreadsheet and reads `Data` and `Kế hoạch`.

## ADR-008: Bundle Lookup Service

Decision: `BundleLookup.js` is the lookup service.

Rationale: It owns bundle lookup, sheet scan, lookup cache, and formula metadata for bundle-related submit behavior.
