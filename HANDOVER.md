# NKT Report 2026 - Project Handover

## Trạng thái hiện tại

- Branch: `main`.
- Source baseline trước commit cập nhật tài liệu này: `1a3c7897c959dca66f96141459c3062088d13e8e`.
- Sprint 16 - Executive Dashboard Polish: **CLOSED**.
- Executive Dashboard: **READY FOR PRODUCTION**, chưa deploy.
- Production Readiness Review: **COMPLETED**.
- Không có thay đổi Business Logic trong lần cập nhật tài liệu này.

## Trạng thái các Sprint liên quan

- Sprint 10A - Dashboard: **CLOSED**.
- Sprint 11A - Export biên bản theo Mã bó: **CLOSED**.
- Sprint 12 - Regression Smoke Test: **CLOSED**, `runSprint12RegressionSmokeTest` PASS 6/6, failed 0, side effects 0.
- Sprint 13B - Planning Regression: **CLOSED**, `runSprint13BPlanningRegression` PASS 4/4, failed 0, side effects 0.
- Sprint 15A - Business Rules standardization: **CLOSED**; Business Rules đã khóa.
- Sprint 16 - Executive Dashboard Polish: **CLOSED**; Production Readiness Review đã hoàn thành.

## Business Rules - LOCKED

- `BusinessRules.gs` là **Single Source of Truth**.
- Không thay đổi Business Logic nếu chưa có PM approval.
- Không thay đổi Business State, PipeID, KPI hoặc API contract.
- Không thay đổi Google Sheet schema hay Apps Script data flow.
- `buildPipeEngine()` và `currentBusinessStatus` tiếp tục là nguồn sự thật cho dữ liệu/trạng thái nghiệp vụ tương ứng.
- Mã bó là Business Key, đồng thời là số biên bản; không thay bằng `reportNo` và không tự sinh quy tắc đánh số.
- Planning Size lấy từ `DANH_MUC_SIZE`; không fallback âm thầm sang `pipe.size`.
- Quy tắc export tối đa 40 dòng ống, mapping chính và output XLSX nhiều sheet được giữ nguyên.

## Kiến trúc và route đã khóa

- Production route:
  - `/exec`
  - `/exec?view=ke-hoach`
  - `/exec?view=xuat-bao-cao`
- Export là module riêng, không nằm trong Dashboard.
- Output export là một file XLSX nhiều sheet; mỗi sheet ứng với một Mã bó và copy nguyên sheet mẫu.
- Form thành phẩm dùng sheet `177`; form ống hỏng dùng sheet `71H`.
- Export XLSX dùng spreadsheet export endpoint, không dùng `getAs(XLSX)`.

## Production Readiness

- Production Readiness Review cho Sprint 16: **COMPLETED**.
- Kết luận: **READY FOR PRODUCTION**.
- Source Sprint 16 chưa được push/deploy lên Apps Script Production trong phạm vi handover này.
- Trước khi deploy phải xác minh lại Apps Script version/deployment hiện hành và thực hiện theo quy trình PM approval.
- Không commit, push, `clasp push`, tạo version hoặc deploy nếu chưa có yêu cầu/phê duyệt riêng của PM.

## Backlog Sprint 17

- Trạng thái: **NOT OPENED / AWAITING PM PRIORITIZATION**.
- Chưa có hạng mục Sprint 17 nào được PM phê duyệt trong repository.
- Không tự động đưa future-refactor backlog, PDF/ZIP hoặc mở rộng chức năng vào Sprint 17.
- Khi PM chốt backlog: phân tích root cause, xác định phạm vi nhỏ nhất, review ảnh hưởng tới Business Rules/API contract và chờ approval trước khi sửa code.

## Nguyên tắc thay đổi

- Root Cause First.
- Stability First.
- Smallest possible diff; không refactor ngoài phạm vi.
- Giữ backward compatibility.
- Dashboard và Dashboard Design chỉ thay đổi khi có yêu cầu/bug được PM phê duyệt.
- Mọi thay đổi phải theo luồng: Analyze -> Review -> Smallest Fix -> PM Approval -> Commit -> GitHub -> `clasp push` -> Deploy.
