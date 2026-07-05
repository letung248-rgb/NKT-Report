# NKT Documentation & Governance v1.0 Report

## Scope Checked

- Read all documentation files `docs/00` through `docs/07`.
- Added governance documents for Documentation & Governance v1.0:
  - `docs/README.md`
  - `docs/08_CHANGE_POLICY.md`
  - `docs/09_FUTURE_REFACTOR.md`
- Compared documentation against current source files:
  - `Code.js`
  - `SubmitReport.js`
  - `DashboardServer.js`
  - `Dashboard.html`
  - `Index.html`
  - `Utils.js`
  - `BundleLookup.js`
  - `appsscript.json`

## Source Facts Confirmed

- `Code.js` is the Web App entry point.
- `doGet(e)` renders `Dashboard.html` for `view=dashboard` or `view=admin`, otherwise renders `Index.html`.
- Worker Flow is `Index.html -> google.script.run.submitReport(payload) -> SubmitReport.js -> Google Sheet Data`.
- Dashboard Flow is `Dashboard.html -> google.script.run.getDashboardData() -> DashboardServer.js -> Utils.js -> Google Sheet Data / Kế hoạch`.
- `DashboardServer.js` is the active dashboard server source.
- `Dashboard.js` is not present in the current repo.
- KPI Thanh pham is calculated by `isThanhPhamKpiPipe(pipe)` and does not use `currentBusinessStatus`.
- `classifyBusinessStatus()` remains the current pipe status classifier.
- `BundleLookup.js` owns bundle lookup/cache/formula metadata for sheet `SL nhận từ KH`.
- Apps Script runtime is V8, with Web App execution/access configured in `appsscript.json`.

## Docs Updated

- Corrected plan sheet references from `Ke hoach` to `Kế hoạch`.
- Corrected bundle lookup sheet references from `SL nhan tu KH` to `SL nhận từ KH`.
- Corrected KPI Thanh pham condition to match source:
  - normalized process includes `ep thuy luc`
  - normalized status equals `ok`
  - or normalized notes include `ong rua lai khong ep`
- Clarified that top-level Dashboard KPI `kpi.tp` and `pipeLists.tp` use `isThanhPhamKpiPipe(pipe)`, while other status summaries may still use `currentBusinessStatus`.
- Added AI guideline requiring `git status --short` and relevant diff checks before editing.
- Added coding standard notes for Apps Script global scope and shared constants.
- Added `docs/README.md` to define reading order, source-of-truth files, and review/approve/commit workflow.
- Added `docs/08_CHANGE_POLICY.md` to define change governance and flow/data protection rules.
- Added `docs/09_FUTURE_REFACTOR.md` to record future refactor candidates without approving implementation.

## Legacy Check

- No active source file named `Dashboard.js` exists.
- The only documentation reference to `Dashboard.js` is ADR-002, which correctly records that it was legacy and removed.

## Open Decisions

- Whether `isThanhPhamKpiPipe(pipe)` should continue requiring normalized status exactly equal to `ok`, or should also accept statuses such as `dat` / `thanh pham`. Current docs now match source and do not expand this rule.
- Whether `planStats.actual` should follow the same KPI Thanh pham helper exactly. Current source counts actual plan progress from `tpPipes`, then requires an `Ep thuy luc` transaction with status containing `dat` or `thanh pham`.

## Readiness

Docs are ready to commit after reviewing the generated diff.

No source code, Google Sheet, commit, push, or deploy action was performed.
