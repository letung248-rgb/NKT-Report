# NKT Management System - Phase 5A E2E Test Matrix

## Purpose

This document defines the end-to-end verification matrix for Production Readiness Phase 5A.

No source code, Google Sheet structure, architecture, or business rule should be changed during this phase.

## A. Test Objectives

- Prove the Worker submit flow writes the expected report rows through queue/process into Google Sheet `Data`.
- Prove the Dashboard reads Google Sheet data correctly after queued writes have flushed.
- Prove KPI Thanh pham follows the approved business rule in `isThanhPhamKpiPipe(pipe)`.
- Prove Dashboard pipe lists and KPI cards reflect the server response returned by `getDashboardData()`.

## B. Test Scope

- Worker UI submit in `Index.html`.
- Server submit entry `submitReport(payload)`.
- Background queue processor `processSubmitQueue()`.
- Google Sheet write to `Data`.
- Dashboard data entry `getDashboardData()`.
- Dashboard rendering in `Dashboard.html`.
- KPI Thanh pham.
- Related dashboard pipe lists, especially `pipeLists.tp`, `pipeLists.cs`, `pipeLists.hong`, `pipeLists.dxl`, and `pipeLists.all`.

## C. Out Of Scope

- Large-volume performance testing.
- Public utility hardening.
- `Utils.js` refactor.
- Google Sheet structure changes.
- New business rules.
- Deployment changes.
- Push or release workflow.

## Preconditions

- Use a controlled test pipe number range that is not used by production records.
- Record baseline row count in sheet `Data` before each test.
- Record baseline Dashboard KPI values before each test.
- If `submitReport(payload)` returns `queued: true`, wait for `processSubmitQueue()` to finish or run the approved queue flush procedure before judging Dashboard results.
- Collect evidence before cleanup or follow-up actions.

## Test Matrix

| ID | Mục tiêu | Input / thao tác | Điều kiện trước test | Expected Sheet result | Expected Dashboard result | Acceptance criteria | Evidence cần thu thập | Status |
|---|---|---|---|---|---|---|---|---|
| E2E-01 | Worker submit thủy lực Đạt đi qua Worker Flow đầy đủ. | Mở Worker UI, chọn `Ép thủy lực`, status `Đạt`, nhập 1 pipe test, submit. | Web App chạy thật; test pipe chưa có trong baseline; queue state ghi nhận trước test. | Sau khi queue flush, sheet `Data` có 1 row mới với Process `Ép thủy lực`, Status `Đạt`, đúng pipe/date/shift/worker. | Dashboard đọc được pipe mới trong `pipeLists.all`; status summary phản ánh theo source hiện tại. KPI Thanh pham chỉ tăng nếu approved KPI rule được thỏa. | Submit success; row xuất hiện sau flush; Dashboard không crash và hiển thị pipe. Không kết luận bug nếu KPI không tăng trước khi đối chiếu rule. | Screenshot Worker success, row mới trong Sheet, Dashboard KPI trước/sau, server response nếu có. | NOT RUN |
| E2E-02 | Worker submit thủy lực Không đạt/Loại ghi đúng lỗi và không bị tính nhầm Thành phẩm. | Worker UI chọn `Ép thủy lực`, status `Loại`, chọn reason như `Xì pin`, submit 1 pipe test. | Test pipe riêng; baseline KPI/row count đã ghi nhận. | Sau flush, `Data` có row mới với Process `Ép thủy lực`, Status chứa `Loại`, Reason đúng lựa chọn. | Dashboard đưa pipe vào nhóm phù hợp theo `classifyBusinessStatus()`; KPI Thanh pham không tăng nếu không có `ok` hoặc note rule. | Row và reason đúng; Dashboard list/KPI không tính Thành phẩm ngoài approved rule. | Screenshot UI, Sheet row, Dashboard KPI/list trước/sau. | NOT RUN |
| E2E-03 | Worker submit có notes `Ống rửa lại không ép` kích hoạt KPI Thành phẩm theo note rule. | Worker UI nhập note chính xác `Ống rửa lại không ép` cho 1 pipe test, submit. | Test pipe chưa có baseline; note field visible/available. | Sau flush, `Data` có row mới; Notes chứa text được submit, có thể kèm suffix `Số đã nhập BC`. | `kpi.tp` tăng 1 và pipe xuất hiện trong `pipeLists.tp` nếu normalized notes contain `ong rua lai khong ep`. | KPI Thành phẩm tăng theo note rule sau flush; không yêu cầu `currentBusinessStatus` là `THANH_PHAM`. | Sheet notes cell, Dashboard KPI before/after, pipe list Thành phẩm. | NOT RUN |
| E2E-04 | Queue delay: submit success nhưng Sheet chưa ghi ngay được xử lý đúng là trạng thái pending, không kết luận fail sớm. | Submit 1 pipe test khi `SUBMIT_FAST_ACK_ENABLED` đang bật; quan sát response có thể `queued: true`. | Queue properties/triggers quan sát được; baseline row count đã ghi nhận ngay trước submit. | Ngay sau submit có thể chưa có row mới; sau queue flush row phải xuất hiện. | Dashboard trước flush có thể chưa đổi; sau flush phải đọc row mới. | Không đánh fail Dashboard trước khi queue flush; pass nếu row và Dashboard cập nhật sau flush. | Submit response, timestamp, row count trước/ngay sau/sau flush, trigger/log evidence. | NOT RUN |
| E2E-05 | Dashboard refresh sau queue flush đọc đúng dữ liệu mới. | Sau khi E2E-04 hoặc test submit khác flush xong, mở/refresh Dashboard. | Queue đã xử lý xong; row test đã tồn tại trong `Data`. | Không ghi thêm row khi chỉ refresh Dashboard. | `getDashboardData()` trả success; KPI/list/recent phản ánh row test. | Dashboard không lỗi; `lastUpdate` cập nhật; dữ liệu mới hiển thị đúng sau flush. | Dashboard screenshot, Apps Script log/getDashboardData output nếu có. | NOT RUN |
| E2E-06 | KPI Thành phẩm tăng khi Process = Ép thủy lực và Status normalized = `ok`. | Gọi `submitReport(payload)` với `w-nguyen-cong = Ép thủy lực`, `w-tinh-trang = OK`, 1 pipe test; hoặc nhập dữ liệu test bằng kênh đã được duyệt. | Không đổi business rule; test input phải tạo status normalized `ok`; baseline KPI đã ghi nhận. | Sau flush, `Data` có row với Process `Ép thủy lực`, Status `OK` hoặc equivalent normalized `ok`. | `kpi.tp` tăng 1; pipe xuất hiện trong `pipeLists.tp`. | Pass khi KPI tăng do `isThanhPhamKpiPipe(pipe)`, không do `currentBusinessStatus`. | Payload/Sheet row, Dashboard before/after, pipe detail evidence. | NOT RUN |
| E2E-07 | KPI Thành phẩm tăng khi Notes chứa `Ống rửa lại không ép`. | Submit payload/UI row có Notes chứa phrase này, với status không cần `OK`. | Phrase phải được giữ trong Notes sau `_submitBuildRows_`. | Sheet `Data` notes cell chứa normalized-matchable phrase. | `kpi.tp` tăng và pipe nằm trong Thành phẩm list. | Pass khi note rule đủ để tính KPI Thành phẩm. | Sheet notes, Dashboard KPI, `pipeLists.tp` screenshot/output. | NOT RUN |
| E2E-08 | KPI Thành phẩm không tăng chỉ vì `currentBusinessStatus = THANH_PHAM`. | Tạo/submit case làm `classifyBusinessStatus()` có thể ra `THANH_PHAM` nhưng không có status normalized `ok` và không có note phrase. | Test pipe riêng; baseline KPI/list ghi nhận; queue đã flush trước assert. | Sheet row tồn tại với data tạo current status theo classifier nhưng không thỏa KPI helper. | `currentBusinessStatus` có thể là `THANH_PHAM`; `kpi.tp` và `pipeLists.tp` không tăng nếu helper không thỏa. | Pass nếu KPI không dựa riêng vào `currentBusinessStatus`. | Sheet row, Dashboard pipe detail showing current status, KPI before/after. | NOT RUN |
| E2E-09 | Duplicate submit behavior được quan sát và ghi nhận theo source hiện tại. | Submit cùng payload/pipe hai lần liên tiếp. | Không thấy submit-time duplicate guard trong write path; test dùng pipe riêng; baseline row count ghi nhận. | Expected theo source hiện tại: có thể có 2 rows nếu cả hai submit thành công. | Dashboard xử lý theo lịch sử pipe; không crash; KPI/list behavior được ghi nhận. | Không coi duplicate là bug trong Phase 5A nếu source chưa có guard; chỉ ghi actual behavior. | Two submit responses, row count delta, duplicate rows, Dashboard pipe history. | NOT RUN |
| E2E-10 | Missing required fields bị chặn ở Worker UI nếu source hiện có validate. | Bỏ trống required fields như date/pipe/process/worker and click submit. | Chạy qua Worker UI, không gọi trực tiếp server bypass. | Sheet `Data` không có row mới. | Dashboard không đổi. | Browser validation or UI alert blocks submit; no new Sheet row. | Screenshot validation/alert, row count before/after, Dashboard unchanged. | NOT RUN |
| E2E-11 | Bundle lookup/formula path hoạt động khi Worker UI gửi mã bó. | Worker UI nhập `Mã bó` hợp lệ, để trống `Từ giếng`/`Từ giàn`/`Hồ sơ giếng`, submit. | Sheet `SL nhận từ KH` có bundle test hợp lệ; queue/fast append behavior được ghi nhận. | Row mới có bundle code; well/rig/profile columns contain formula or resolved values according to active write path. | Dashboard pipe detail shows well/rig/profile when Google Sheet values are available to `getRawTransactions()`. | Pass if bundle-related fields are populated or formula-resolved as designed before Dashboard assertion. | Bundle source row, submitted Data row/formulas, Dashboard pipe detail. | NOT RUN |
| E2E-12 | Dashboard không crash khi không có dữ liệu phù hợp. | Mở Dashboard trong điều kiện filter/test data không tạo list phù hợp, hoặc dùng dataset không có matching KPI case. | Không xóa production data; chỉ dùng trạng thái naturally empty/missing relevant records. | Không cần ghi Sheet. | Dashboard shows controlled empty/error state; render does not throw client-side exception. | No JS crash; user sees error/empty state from `getDashboardData()` or empty tables. | Browser console screenshot, Dashboard screenshot, server response/error message. | NOT RUN |

## E. Phase 5A Acceptance Criteria

- Do not conclude a bug before the relevant test is actually run.
- Treat all audit concerns as `TEST ITEM` until a test produces a clear FAIL.
- Open a separate bug task only after a test case fails with evidence.
- Do not change code in Phase 5A.
- Do not change Google Sheet structure in Phase 5A.
- Do not change business rules in Phase 5A.
- Do not change architecture in Phase 5A.
- Do not commit, push, or deploy as part of creating this matrix.

## Evidence Package Checklist

For each executed test, collect:

- Test ID and timestamp.
- Tester name/environment.
- Input payload or UI screenshot.
- Sheet row count before/after.
- New row screenshot or exported row values.
- Queue status/log evidence when applicable.
- Dashboard screenshot before/after.
- Pass/fail result with notes.
