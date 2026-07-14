# NKT Documentation & Governance v1.0 Report

## Scope Checked

- Read all documentation files `docs/00` through `docs/07`.
- Added governance documents for Documentation & Governance v1.0:
  - `docs/README.md`
  - `docs/08_CHANGE_POLICY.md`
  - `docs/09_FUTURE_REFACTOR.md`
- Added Phase 5A E2E verification planning document:
  - `docs/10_E2E_TEST_MATRIX.md`
- Added Phase 5B acceptance and release checklists:
  - `docs/11_ACCEPTANCE_CHECKLIST.md`
  - `docs/12_RELEASE_CHECKLIST.md`
- Added Phase 5C E2E execution planning document:
  - `docs/13_E2E_EXECUTION_PLAN.md`
- Added Phase 6.1 test execution sessions document:
  - `docs/14_TEST_EXECUTION_SESSIONS.md`
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
- Added `docs/10_E2E_TEST_MATRIX.md` to define the Phase 5A end-to-end verification matrix before any code changes.
- Added `docs/11_ACCEPTANCE_CHECKLIST.md` to define acceptance gates before release approval.
- Added `docs/12_RELEASE_CHECKLIST.md` to define release, deployment, and rollback gates.
- Added `docs/13_E2E_EXECUTION_PLAN.md` to guide execution of the E2E matrix without changing code.
- Added `docs/14_TEST_EXECUTION_SESSIONS.md` to organize E2E execution into prioritized QA sessions.

## Phase 5A E2E Verification Plan

- Added test objectives for Worker submit, queue/process, Google Sheet write, Dashboard read/render, and KPI Thanh pham.
- Added test scope and out-of-scope boundaries.
- Added 12 NOT RUN test cases covering Worker UI submit, queue delay, Dashboard refresh, KPI Thanh pham rule paths, duplicate submit behavior, missing required fields, bundle lookup, and empty/no-match Dashboard behavior.
- No business rule content was changed.

## Phase 5B Acceptance And Release Checklists

- Added Worker, Google Sheet, Dashboard, Business Rule, Regression, and Result acceptance checklist sections.
- Added Git, Documentation, Source, Testing, Deployment, and Rollback release checklist sections.
- No source code, Google Sheet structure, business rule, or architecture content was changed.

## Phase 5C E2E Execution Plan

- Added environment preparation checklist for Apps Script deployment, Google Sheet, Dashboard URL, Worker URL, test account, test data, bundle range, and evidence storage.
- Added recommended execution order from Worker UI through queue flush, Sheet verification, Dashboard refresh, KPI comparison, and evidence capture.
- Added execution table for all 12 E2E test cases with owner, inputs, steps, Sheet checks, Dashboard checks, KPI checks, evidence, PASS/FAIL, Root Cause, and Bug ID fields.
- Added FAIL handling flow: collect evidence, do not modify code, analyze root cause, open bug task, review, approve, then fix in a separate phase.
- Added final result definitions for Ready for Bug Fix Phase, Ready for Production Candidate, and Retest Required.
- No source code, Google Sheet structure, business rule, or architecture content was changed.

## Phase 6.1 Test Execution Sessions

- Converted the E2E Test Matrix into five prioritized execution sessions:
  - Session 1: Worker Basic Flow
  - Session 2: Queue Processing
  - Session 3: Dashboard
  - Session 4: KPI Thanh pham
  - Session 5: Edge Cases
- Added goals, preconditions, test data, execution steps, observed screens, Sheet checks, Dashboard checks, evidence requirements, PASS criteria, and FAIL criteria for each session.
- No PASS/FAIL results were recorded.
- No bug tasks were created.
- No source code, Google Sheet structure, business rule, or architecture content was changed.

## Legacy Check

- No active source file named `Dashboard.js` exists.
- The only documentation reference to `Dashboard.js` is ADR-002, which correctly records that it was legacy and removed.

## Open Decisions

- Whether `isThanhPhamKpiPipe(pipe)` should continue requiring normalized status exactly equal to `ok`, or should also accept statuses such as `dat` / `thanh pham`. Current docs now match source and do not expand this rule.
- Whether `planStats.actual` should follow the same KPI Thanh pham helper exactly. Current source counts actual plan progress from `tpPipes`, then requires an `Ep thuy luc` transaction with status containing `dat` or `thanh pham`.

## Readiness

Docs are ready to commit after reviewing the generated diff.

No source code, Google Sheet, commit, push, or deploy action was performed.

## Sprint 7 Production Release Closure - 2026-07-13

- Sprint 7 candidate source: commit `277eec8`.
- Apps Script version 42 was deployed temporarily to the main Production deployment for release verification.
- Production verification found that `submitReport()` waited synchronously for `refreshDashboardSnapshot_()`, causing Worker App submit responses to take approximately 51-52 seconds after the data write completed.
- No runtime exception or data-write failure was identified; the blocking delay came from the synchronous dashboard snapshot rebuild.
- The main Production deployment was rolled back to Apps Script version 37.
- Main Production deployment ID: `AKfycbyYIPl-YJj4Oftxf7G_XV1Bl6sC4D1AEiQ0NTOVpzwyqKfnk0PD7TJ7_n5tA6fRUTwA`.
- Worker App operation was confirmed stable again after rollback.
- Version 42 remains a non-active release candidate and investigation reference; it is not the active main Production version.
- No source change, commit, GitHub push, `clasp push`, or additional deployment was performed while closing the release.
