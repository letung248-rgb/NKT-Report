# Sprint 2 Context

## Kien truc hien tai

- Ung dung la Google Apps Script Web App, phuc vu 2 man hinh chinh tu `doGet()`:
  - `Index.html`: Worker UI nhap bao cao san xuat.
  - `Dashboard.html`: Dashboard quan ly/tong quan.
- Backend chinh:
  - `Code.js`: cau hinh spreadsheet, routing Web App, legacy submit helpers.
  - `SubmitReport.js`: submit report, fast ack, queue-first write, process queue, queue status/sync.
  - `DashboardServer.js`: build Pipe Engine, gom KPI/tien do/ke hoach cho Dashboard.
  - `Utils.js`: doc Google Sheet `Data`, doc sheet `Ke hoach`, normalize/validate du lieu.
  - `BundleLookup.js`: lookup ma bo/metadata.
- Dashboard hien tai chi load tong quan qua `google.script.run.getDashboardData()`. Queue status la RPC rieng qua `getSubmitQueueStatus()`.

## Module da hoan thanh

- Worker submit flow:
  - Nhap report tu Worker UI.
  - Ho tro queue/fast ack/fallback ghi truc tiep.
  - Background queue processor `processSubmitQueue()`.
- Dashboard tong quan:
  - KPI tong so ong, thanh pham, cho sua, hong/loai, dang xu ly.
  - Tien do san xuat theo nguyen cong.
  - Ke hoach theo ngay/thang/loai ong.
  - Recent transactions.
  - Drilldown danh sach ong va ho so ong.
  - Queue status va nut dong bo queue.
- Sprint 2.1 Commit 1:
  - Menu `Bao cao ngay` da active.
  - Co view rieng `view-daily-report`.
  - View moi chi hien placeholder `Dang phat trien`.
  - Chua co thong ke, chua co backend rieng.

## Commit moi nhat

- `0c3edcc feat(dashboard): add daily report placeholder`
- Thay doi duy nhat: `Dashboard.html`.
- Khong push, khong deploy.

## Business rules quan trong

- Pipe Engine doc lich su transaction theo tung `pipeNo`, gom theo lan nhap xuong/entry, sap xep theo ngay, thoi gian nhan, ID.
- Business status chinh:
  - `THANH_PHAM`
  - `LOAI`
  - `CHO_SUA`
  - `DANG_XU_LY`
- KPI Thanh pham khong chi dua vao `currentBusinessStatus`; hien dang dung helper `isThanhPhamKpiPipe(pipe)`.
- Thanh pham KPI tinh khi:
  - Co giao dich `ep thuy luc` voi status normalized la `ok`; hoac
  - Note co cum `ong rua lai khong ep`.
- Loi/hong/cho sua phu thuoc vao `classifyBusinessStatus()` va cac rule ve xi pin, xi box, hong ren, hong coupling, loai NDT, v.v.
- Queue submit co do tre: Worker co the bao thanh cong truoc khi row xuat hien trong sheet `Data`; Dashboard chi dung sau khi queue da flush.

## Sprint 3 Dashboard Review Status

- Dashboard Overview architecture: PASS
- Daily Report: PASS
- KPI Thanh pham:
  - Source of truth = `docs/02_BUSINESS_RULES.md`.
  - Dung chung `isThanhPhamKpiPipe()`.
  - `planStats.actual` dung helper.
- Commit:
  - `0e28ae7`
  - `3529b69`
- Outstanding issues:
  - None

## Sprint hien tai

- Sprint 2: Module `Bao cao ngay`.
- Muc tieu gan nhat: xay view bao cao ngay theo tung ngay ma khong lam nang hoac pha Dashboard tong quan.
- Task tiep theo: **Sprint 2.1 Commit 2**.

## Sprint 2.1 Commit 2 - goi y pham vi

- Them UI toi thieu cho view `Bao cao ngay`:
  - Bo chon ngay.
  - Nut/trigger tai du lieu ngay.
  - Khu vuc hien thi trang thai rong/loading/error.
- Neu can backend, them RPC rieng, vi du `getDailyReportData(dateText)`.
- Chua can chart nang; uu tien bang/KPI nho va du lieu gon.
- Khong dua du lieu bao cao ngay vao payload `getDashboardData()`.

## Nguyen tac phai giu

- Khong sua luong Dashboard tong quan neu khong bat buoc.
- Khong refactor trong Sprint 2.1.
- Moi commit nho, mot muc dich ro rang.
- Khong push, khong deploy neu chua duoc yeu cau.
- Khong lam `getDashboardData()` nang them.
- RPC moi phai co failure handler phia client.
- View moi phai tu an/hien doc lap, khong lam hong `view-dashboard`, `view-pipe-list`, `view-pipe-passport`, `view-about`.
- Tiep tuc ton trong queue delay: khong ket luan so lieu moi neu queue chua flush.

## File chinh can sua cho Commit 2

- `Dashboard.html`
  - Mo rong `view-daily-report`.
  - Them ham render/load rieng cho bao cao ngay.
  - Giu nguyen `renderDashboard()` neu co the.
- `DashboardServer.js`
  - Neu can du lieu tu server: them ham rieng cho bao cao ngay.
  - Nen dung `getRawTransactions()` va filter theo ngay.
- `Utils.js`
  - Chi sua neu can helper normalize/parse ngay dung chung.
- Khong du kien sua:
  - `SubmitReport.js`
  - `Code.js`
  - `BundleLookup.js`
