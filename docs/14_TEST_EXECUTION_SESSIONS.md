# NKT Management System - Phase 6.1 Test Execution Sessions

## Purpose

This document converts the E2E Test Matrix into prioritized execution sessions for the first real QA run.

This is a test execution plan only. Do not record PASS/FAIL results here.

## Execution Principles

- Do not modify source code during testing.
- Do not modify Google Sheet structure during testing.
- Do not modify business rules during testing.
- Do not create bug tasks until a test actually fails with evidence.
- Treat unresolved audit findings as test items until proven by execution.
- Capture evidence before any cleanup or retest.

## Priority Order

1. Session 1 - Worker Basic Flow
2. Session 2 - Queue Processing
3. Session 3 - Dashboard
4. Session 4 - KPI Thanh pham
5. Session 5 - Edge Cases

## Session 1 - Worker Basic Flow

### Test Cases

- E2E-01: Worker submit thủy lực Đạt.
- E2E-02: Worker submit thủy lực Không đạt / Loại.
- E2E-10: Missing required fields.
- E2E-11: Bundle lookup from Worker UI.

### Mục tiêu

- Confirm Worker UI opens normally.
- Confirm required-field validation blocks invalid submit.
- Confirm valid Worker submit reaches `submitReport(payload)`.
- Confirm valid submit creates expected data rows after queue/process completion.
- Confirm bundle-related submit behavior is observable when a bundle code is used.

### Điều Kiện Trước Khi Test

- Approved Apps Script deployment URL is available.
- Worker URL opens default Web App route rendering `Index.html`.
- Tester has access to the Worker UI.
- Reserved test pipe number range is assigned.
- Baseline row count in Google Sheet `Data` is recorded.
- Baseline Dashboard KPI values are recorded for later comparison.
- Bundle test data is available in `SL nhận từ KH` for E2E-11, if this case is run.

### Dữ Liệu Cần Chuẩn Bị

- One reserved pipe for E2E-01.
- One reserved pipe for E2E-02.
- One reserved pipe and valid bundle number for E2E-11.
- Date, shift, worker, size, entry round, and process values.
- For E2E-02: reason such as `Xì pin`.
- For E2E-10: no valid data; intentionally leave required fields blank.

### Các Bước Thao Tác

1. Open Worker URL.
2. Confirm UI loads and login/user context is ready if required.
3. Run E2E-10 first by leaving required fields blank and attempting submit.
4. Run E2E-01 with `Ép thủy lực` and `Đạt`.
5. Run E2E-02 with `Ép thủy lực`, `Loại`, and a reason.
6. Run E2E-11 with a valid bundle code and blank bundle-derived fields where applicable.
7. Wait for queue flush when submit response or timing indicates queued processing.
8. Inspect Google Sheet `Data`.
9. Capture evidence.

### Màn Hình Cần Quan Sát

- Worker login/user screen if present.
- Worker form.
- Required field browser validation or alert.
- Submit loading overlay.
- Submit success or error alert.

### Giá Trị Cần Đối Chiếu Trong Google Sheet

- New row exists only after valid submit and queue/process completion.
- Columns match expected 23-column row layout.
- Process, Status, Reason, Pipe No, Date, Shift, Worker, Size, Entry Round are correct.
- Bundle code appears in the expected column.
- Bundle-derived fields or formulas are present/resolved as expected for E2E-11.
- Missing required field case creates no row.

### Giá Trị Cần Đối Chiếu Trên Dashboard

- New valid pipes appear in `pipeLists.all` after queue flush and Dashboard refresh.
- Loại/error case appears in the expected status group according to `classifyBusinessStatus()`.
- Bundle-related pipe detail shows available well/rig/profile values after Sheet calculation.
- No Dashboard change is expected for missing required field case.

### Evidence Cần Chụp

- Worker UI before submit.
- Required field validation for E2E-10.
- Submit success/error alert.
- Google Sheet row before/after.
- Bundle source row for E2E-11.
- Dashboard pipe detail after refresh.

### PASS Criteria

- Worker UI opens.
- Invalid input does not write to Sheet.
- Valid input submits successfully.
- Expected Sheet rows appear after queue/process completion.
- Dashboard can read submitted pipes after refresh.
- Bundle case behavior is documented with evidence.

### FAIL Criteria

- Worker UI cannot open.
- Required validation allows invalid submit that writes a row.
- Valid submit returns error without expected reason.
- Row is missing after queue/process completion.
- Data is written to the wrong columns, wrong sheet, or wrong pipe.
- Dashboard cannot read the submitted pipe after queue flush.

## Session 2 - Queue Processing

### Test Cases

- E2E-04: Queue delay / submit success before Sheet write.
- E2E-05: Dashboard refresh after queue flush.

### Mục tiêu

- Confirm queued submit behavior is understood before judging Dashboard results.
- Confirm queued rows are eventually written to Google Sheet `Data`.
- Confirm Dashboard reads the newly written rows only after queue flush.

### Điều Kiện Trước Khi Test

- `SUBMIT_FAST_ACK_ENABLED` behavior is known from current deployment.
- Tester can observe submit response, Sheet row count, and Dashboard state.
- Queue flush method is approved before the run.
- Baseline row count and Dashboard KPI values are recorded immediately before submit.

### Dữ Liệu Cần Chuẩn Bị

- One reserved pipe for a valid Worker submit.
- Timestamped test note to identify the row.
- Evidence template for row count before, immediate after, and after flush.

### Các Bước Thao Tác

1. Record baseline `Data` row count.
2. Submit a valid Worker report.
3. Record submit response or UI success message.
4. Immediately check whether `Data` row count changed.
5. Wait for queue flush or run approved queue flush procedure.
6. Check `Data` row count again.
7. Refresh Dashboard.
8. Compare Dashboard state before and after flush.
9. Capture queue/log evidence when available.

### Màn Hình Cần Quan Sát

- Worker submit success alert.
- Google Sheet `Data`.
- Apps Script execution/queue logs if available.
- Dashboard loading and refreshed state.

### Giá Trị Cần Đối Chiếu Trong Google Sheet

- Row may be absent immediately after queued success.
- Row must appear after queue flush.
- Row content must match submitted payload.
- No duplicate row should be created by Dashboard refresh.

### Giá Trị Cần Đối Chiếu Trên Dashboard

- Dashboard before flush may not show new data.
- Dashboard after flush should show new pipe in relevant list/recent data.
- KPI should be evaluated only after queue flush.

### Evidence Cần Chụp

- Submit response/success alert.
- Row count before submit.
- Row count immediately after submit.
- Row count after flush.
- Dashboard before/after refresh.
- Queue trigger/log evidence if accessible.

### PASS Criteria

- Queued success is not judged as complete until flush.
- Row appears after queue flush.
- Dashboard reflects flushed data after refresh.

### FAIL Criteria

- Queue never flushes within approved wait/run procedure.
- Queued row is lost.
- Dashboard does not update after row exists in `Data`.
- Queue creates unexpected extra rows.

## Session 3 - Dashboard

### Test Cases

- E2E-05: Dashboard refresh after queue flush.
- E2E-12: Dashboard no-crash behavior for no matching data.

### Mục tiêu

- Confirm Dashboard opens and calls `getDashboardData()`.
- Confirm Dashboard renders KPI, pipe lists, recent rows, plan table, and charts without crashing.
- Confirm empty/no-match states do not crash the UI.

### Điều Kiện Trước Khi Test

- Dashboard URL is available.
- At least one flushed test row exists for positive Dashboard verification.
- A no-match or naturally empty condition is identified for E2E-12 without deleting production data.
- Browser console can be inspected.

### Dữ Liệu Cần Chuẩn Bị

- One known test pipe that exists in `Data`.
- Baseline Dashboard screenshot.
- Optional no-match case or dataset state with empty relevant list.

### Các Bước Thao Tác

1. Open Dashboard URL.
2. Observe loading and initial render.
3. Refresh Dashboard after confirmed queue flush.
4. Inspect KPI cards, recent table, pipe lists, and pipe passport/detail.
5. Navigate to relevant pipe lists.
6. Inspect browser console for client errors.
7. Run no-match/empty-state observation without deleting production data.
8. Capture evidence.

### Màn Hình Cần Quan Sát

- Dashboard loading indicator.
- KPI cards.
- Recent transactions table.
- Pipe list view.
- Pipe passport/detail view.
- Plan table.
- Browser console.

### Giá Trị Cần Đối Chiếu Trong Google Sheet

- Test pipe exists in `Data`.
- Dashboard refresh does not write new rows.
- No Sheet mutation is expected from Dashboard read.

### Giá Trị Cần Đối Chiếu Trên Dashboard

- `kpi.total`, status counts, and recent rows are consistent with the server response.
- Known test pipe appears in `pipeLists.all`.
- Empty/no-match condition is shown as controlled empty/error state.
- UI does not crash.

### Evidence Cần Chụp

- Dashboard initial load screenshot.
- Dashboard after refresh.
- Pipe list and pipe detail screenshots.
- Browser console screenshot.
- Sheet row evidence for known test pipe.

### PASS Criteria

- Dashboard opens.
- `getDashboardData()` returns a usable response.
- Dashboard renders without client crash.
- Known flushed row is visible after refresh.
- Empty/no-match state is controlled.

### FAIL Criteria

- Dashboard cannot open.
- `getDashboardData()` fails unexpectedly.
- UI crashes or remains stuck loading.
- Known flushed row is missing from Dashboard.
- Empty/no-match state causes client exception.

## Session 4 - KPI Thanh Pham

### Test Cases

- E2E-03: Notes `Ống rửa lại không ép`.
- E2E-06: Process `Ép thủy lực` and Status normalized `ok`.
- E2E-07: Notes rule.
- E2E-08: KPI must not rely only on `currentBusinessStatus`.

### Mục tiêu

- Confirm KPI Thanh pham follows `isThanhPhamKpiPipe(pipe)`.
- Confirm KPI Thanh pham counts status normalized `ok` with Process `Ép thủy lực`.
- Confirm KPI Thanh pham counts notes containing `Ống rửa lại không ép`.
- Confirm `currentBusinessStatus` alone is not used as KPI Thanh pham rule source.

### Điều Kiện Trước Khi Test

- Baseline `kpi.tp` and `pipeLists.tp` are recorded.
- Test pipes are reserved and unique.
- Queue flush method is approved.
- Tester understands that normal Worker UI status `Đạt` is not automatically equivalent to normalized `ok` unless the actual submitted data says so.

### Dữ Liệu Cần Chuẩn Bị

- One pipe with Process `Ép thủy lực` and Status `OK` or equivalent normalized `ok`.
- One pipe with Notes `Ống rửa lại không ép`.
- One pipe that may produce `currentBusinessStatus = THANH_PHAM` but does not satisfy the KPI helper rule.
- Baseline KPI screenshot and Sheet row count.

### Các Bước Thao Tác

1. Record baseline Dashboard `kpi.tp` and Thành phẩm list.
2. Submit or prepare approved input for status normalized `ok`.
3. Wait for queue flush and verify Sheet row.
4. Refresh Dashboard and inspect `kpi.tp` and `pipeLists.tp`.
5. Submit or prepare approved input with Notes `Ống rửa lại không ép`.
6. Wait for queue flush and repeat Dashboard verification.
7. Run `currentBusinessStatus` isolation case.
8. Capture before/after evidence for all KPI assertions.

### Màn Hình Cần Quan Sát

- Worker UI or approved submit channel.
- Google Sheet `Data`.
- Dashboard KPI cards.
- Thành phẩm pipe list.
- Pipe detail/passport.

### Giá Trị Cần Đối Chiếu Trong Google Sheet

- Process column includes `Ép thủy lực` for status `OK` case.
- Status column normalizes to `ok` for E2E-06.
- Notes column contains `Ống rửa lại không ép` for note-rule cases.
- Isolation case row does not contain status `OK` and does not contain note phrase.

### Giá Trị Cần Đối Chiếu Trên Dashboard

- `kpi.tp` increases for `ok` rule case.
- `kpi.tp` increases for note rule case.
- `pipeLists.tp` includes matching pipes.
- `kpi.tp` does not increase solely from `currentBusinessStatus`.

### Evidence Cần Chụp

- Baseline KPI.
- Sheet rows for each KPI case.
- Dashboard KPI before/after each case.
- Thành phẩm list showing expected pipes.
- Pipe detail showing current status and notes/status evidence.

### PASS Criteria

- KPI increments only for approved KPI helper conditions.
- Note-rule pipe appears in Thành phẩm list.
- Status normalized `ok` pipe appears in Thành phẩm list.
- `currentBusinessStatus`-only case does not create KPI false positive.

### FAIL Criteria

- KPI does not increase for approved `ok` or note rule after flush.
- KPI increases only due to `currentBusinessStatus` without helper condition.
- Thành phẩm list does not match KPI count.
- Evidence cannot prove which rule triggered the KPI.

## Session 5 - Edge Cases

### Test Cases

- E2E-09: Duplicate submit behavior.
- E2E-10: Missing required fields.
- E2E-11: Bundle lookup/formula behavior.
- E2E-12: Dashboard empty/no-match behavior.

### Mục tiêu

- Observe edge behavior without classifying it as a bug before evidence review.
- Confirm duplicate submit behavior is documented.
- Confirm validation prevents missing required-field writes.
- Confirm bundle lookup/formula path is observable.
- Confirm Dashboard handles no-match/empty states.

### Điều Kiện Trước Khi Test

- Test pipes are reserved and isolated.
- Bundle test record exists in `SL nhận từ KH`, if bundle test is run.
- Baseline row counts and Dashboard state are recorded.
- Duplicate test uses clearly identifiable pipe/note values.

### Dữ Liệu Cần Chuẩn Bị

- One duplicate-submit pipe and payload.
- One missing-field Worker UI scenario.
- One valid bundle number and pipe.
- One no-match/empty-state Dashboard condition.

### Các Bước Thao Tác

1. Run duplicate submit with same payload twice.
2. Wait for queue flush and inspect row count/history.
3. Run missing required-field case through Worker UI.
4. Run bundle lookup submit.
5. Wait for Sheet formulas/calculation if applicable.
6. Refresh Dashboard and inspect relevant pipe details.
7. Run Dashboard empty/no-match observation.
8. Capture all evidence.

### Màn Hình Cần Quan Sát

- Worker UI validation.
- Worker submit success alerts.
- Google Sheet `Data`.
- Google Sheet `SL nhận từ KH`.
- Dashboard pipe lists and pipe detail.
- Browser console for Dashboard empty/no-match case.

### Giá Trị Cần Đối Chiếu Trong Google Sheet

- Duplicate submit actual row count delta.
- Missing required-field case produces no new row.
- Bundle code appears in correct column.
- Bundle-derived fields/formulas resolve where expected.
- No unexpected Sheet structure changes occur.

### Giá Trị Cần Đối Chiếu Trên Dashboard

- Duplicate pipe history/list behavior is recorded.
- Missing-field case produces no Dashboard change.
- Bundle fields appear in pipe detail when available from Sheet.
- Empty/no-match case does not crash Dashboard.

### Evidence Cần Chụp

- Duplicate submit responses.
- Duplicate row evidence.
- Missing-field validation screenshot.
- Bundle source row and Data row.
- Dashboard pipe detail.
- Browser console for empty/no-match case.

### PASS Criteria

- Edge behavior is observed and documented with evidence.
- No source or Sheet structure changes are made.
- Missing required fields do not write rows.
- Dashboard remains stable in edge scenarios.

### FAIL Criteria

- Edge case causes data loss.
- Missing required fields write rows.
- Bundle case writes to wrong columns or breaks Dashboard read.
- Dashboard crashes or throws uncontrolled errors.

## Session Completion Rules

- Do not mark PASS/FAIL in this document.
- Record actual outcomes in the approved execution evidence package or test run sheet.
- If a session produces a FAIL, follow `docs/13_E2E_EXECUTION_PLAN.md` FAIL handling.
- Do not fix during the QA execution session.
