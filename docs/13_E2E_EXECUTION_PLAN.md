# NKT Management System - Phase 5C E2E Execution Plan

## Purpose

This document guides execution of the Phase 5A E2E Test Matrix.

It is an execution plan, not a test result report.

## A. Objectives

- Run the full E2E Test Matrix in `docs/10_E2E_TEST_MATRIX.md`.
- Do not modify source code during test execution.
- Do not modify Google Sheet structure during test execution.
- Do not modify business rules or architecture during test execution.
- Record every FAIL as evidence and analysis only; do not auto-fix.

## B. Environment Preparation

| Item | Value / Link | Owner | Notes |
|---|---|---|---|
| Apps Script deployment to use | TBD | TBD | Use only the approved deployment for Phase 5C. |
| Google Sheet to use | TBD | TBD | Prefer controlled test data area; avoid production data where possible. |
| Dashboard URL | TBD | TBD | Expected route: Web App URL with `view=dashboard` or `view=admin`. |
| Worker URL | TBD | TBD | Expected route: default Web App URL rendering `Index.html`. |
| Test account | TBD | TBD | Use a controlled account if login/user context is required. |
| Test data owner | TBD | TBD | Responsible for assigning pipe numbers and evidence storage. |
| Bundle Number range | TBD | TBD | Use a clearly reserved test bundle range; do not reuse production bundle numbers if avoidable. |
| Test pipe number range | TBD | TBD | Use reserved test pipe numbers not present in baseline data. |
| Evidence storage location | TBD | TBD | Store screenshots, row snapshots, logs, and notes by Test ID. |

### Environment Rules

- Do not use production data when a controlled test record can be used.
- Do not rename sheets or columns.
- Do not delete production rows.
- Record baseline `Data` row count and Dashboard KPI values before each test.
- If `submitReport(payload)` returns `queued: true`, wait for queue flush before judging Dashboard results.

## C. Test Execution Order

```text
Step 1
Open Worker UI

v

Step 2
Submit valid or scenario-specific test input

v

Step 3
Wait for queue flush or run the approved queue flush procedure

v

Step 4
Check Google Sheet `Data`

v

Step 5
Refresh Dashboard

v

Step 6
Compare KPI, pipe lists, recent rows, and pipe detail

v

Step 7
Capture evidence

v

Step 8
Mark PASS / FAIL and record notes
```

## D. Test Case Execution Table

| Test ID | Người thực hiện | Dữ liệu đầu vào | Các bước thao tác | Sheet cần kiểm tra | Dashboard cần kiểm tra | KPI cần kiểm tra | Evidence cần thu thập | PASS / FAIL | Root Cause | Bug ID |
|---|---|---|---|---|---|---|---|---|---|---|
| E2E-01 | TBD | Worker UI: `Ép thủy lực`, Status `Đạt`, 1 reserved pipe. | Open Worker URL; submit input; wait for queue flush; inspect Sheet; refresh Dashboard. | `Data`: new row, correct pipe/process/status/date/shift/worker. | `pipeLists.all`, recent rows, pipe detail. | KPI Thanh pham only if approved KPI rule is satisfied. | Worker success screenshot, Sheet row, Dashboard before/after. |  |  |  |
| E2E-02 | TBD | Worker UI: `Ép thủy lực`, Status `Loại`, reason such as `Xì pin`, 1 reserved pipe. | Open Worker URL; submit input; wait for queue flush; inspect Sheet; refresh Dashboard. | `Data`: new row with Process `Ép thủy lực`, Status/Reason captured correctly. | Relevant status list from `classifyBusinessStatus()`, pipe detail, recent rows. | KPI Thanh pham must not increase unless `ok` or note rule is satisfied. | UI screenshot, Sheet row, Dashboard KPI/list screenshots. |  |  |  |
| E2E-03 | TBD | Worker UI with Notes `Ống rửa lại không ép`, 1 reserved pipe. | Submit with note; wait for queue flush; inspect Sheet notes; refresh Dashboard. | `Data`: notes contain submitted phrase, possibly with submit suffix. | `pipeLists.tp`, pipe detail, recent rows. | KPI Thanh pham should increase through note rule. | Sheet notes cell, KPI before/after, Thành phẩm list screenshot. |  |  |  |
| E2E-04 | TBD | Any valid submit while queue fast-ack may be active. | Submit; immediately check response/Sheet; wait for queue flush; re-check Sheet/Dashboard. | `Data`: row may be absent before flush, present after flush. | Dashboard may be unchanged before flush, updated after flush. | Relevant KPI after flush only. | Submit response, row counts before/immediate/after, queue/log evidence. |  |  |  |
| E2E-05 | TBD | Existing flushed row from prior E2E case. | Confirm queue empty/flushed; refresh Dashboard; observe render. | `Data`: no extra row created by Dashboard refresh. | Dashboard success, last update, KPI/list/recent reflect flushed data. | KPI relevant to the flushed test row. | Dashboard screenshot, Apps Script logs/server response if available. |  |  |  |
| E2E-06 | TBD | Payload or approved test input: Process `Ép thủy lực`, Status `OK`, 1 reserved pipe. | Submit by approved channel; wait for flush; refresh Dashboard. | `Data`: row status normalized to `ok`. | `pipeLists.tp`, pipe detail. | KPI Thanh pham increases due to `isThanhPhamKpiPipe(pipe)`. | Payload, Sheet row, KPI before/after, pipe list evidence. |  |  |  |
| E2E-07 | TBD | Payload/UI row with Notes containing `Ống rửa lại không ép`. | Submit; wait for flush; inspect notes; refresh Dashboard. | `Data`: notes contain normalized-matchable phrase. | `pipeLists.tp`, pipe detail. | KPI Thanh pham increases due to note rule. | Sheet notes, Dashboard KPI, `pipeLists.tp`. |  |  |  |
| E2E-08 | TBD | Case that may yield `currentBusinessStatus = THANH_PHAM` but lacks `Status = OK` and lacks note phrase. | Submit/create approved test input; wait for flush; refresh Dashboard; inspect pipe detail. | `Data`: row exists and does not satisfy KPI helper. | Pipe detail may show current business status; Thành phẩm list should follow KPI helper only. | KPI Thanh pham must not increase solely from `currentBusinessStatus`. | Sheet row, pipe detail, KPI before/after. |  |  |  |
| E2E-09 | TBD | Same valid payload/pipe submitted twice. | Submit payload twice; wait for flush; inspect row count and Dashboard history. | `Data`: record actual duplicate behavior; expected may be two rows if no guard. | Dashboard does not crash; pipe history/list behavior recorded. | KPI/list behavior observed without calling it bug before review. | Two submit responses, row count delta, duplicate rows, Dashboard history. |  |  |  |
| E2E-10 | TBD | Worker UI missing required fields. | Leave required fields blank; attempt submit. | `Data`: no new row. | Dashboard unchanged. | No KPI change. | Validation screenshot/alert, row count before/after. |  |  |  |
| E2E-11 | TBD | Worker UI with valid `Mã bó`, blank well/rig/profile fields if applicable. | Submit bundle case; wait for flush/formula calculation; refresh Dashboard. | `Data`: bundle code and formula/resolved well/rig/profile fields. | Pipe detail shows available bundle-related fields after Sheet calculation. | KPI only if test input also satisfies KPI rule. | Bundle source row, Data row/formulas, Dashboard pipe detail. |  |  |  |
| E2E-12 | TBD | Dashboard state with no matching test data or naturally empty relevant lists. | Open/refresh Dashboard; inspect UI and console. | No Sheet write expected. | Dashboard shows controlled empty/error state without client crash. | KPI values remain consistent with available data. | Browser console, Dashboard screenshot, server response/error if available. |  |  |  |

## E. FAIL Handling Procedure

```text
FAIL

v

Collect evidence

v

Do not modify code

v

Analyze Root Cause

v

Open Bug Task

v

Review

v

Approve

v

Only then may code be changed in a separate phase
```

## F. Final Result Definitions

### Ready for Bug Fix Phase

Use this status when one or more test cases FAIL and evidence has been collected.

Required:

- FAIL cases have evidence.
- Root Cause fields are filled or explicitly marked pending analysis.
- Bug IDs are created or scheduled.
- No code has been changed during Phase 5C execution.

### Ready for Production Candidate

Use this status when all required E2E cases pass or are approved as N/A.

Required:

- E2E Matrix is complete.
- Acceptance Checklist is PASS.
- No blocker remains open.
- Release Checklist can begin.

### Retest Required

Use this status when tests cannot be trusted or must be rerun.

Examples:

- Wrong environment was used.
- Queue flush state was unclear.
- Evidence is missing.
- Test data collided with production data.
- A bug fix phase changed behavior and affected previous evidence.

## Execution Rules

- Do not edit source code during E2E execution.
- Do not edit Google Sheet structure during E2E execution.
- Do not change business rules during E2E execution.
- Do not change architecture during E2E execution.
- Do not commit, push, or deploy from this phase.
