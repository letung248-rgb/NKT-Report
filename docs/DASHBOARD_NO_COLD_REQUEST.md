# Dashboard No-Cold-User-Request

## Root Cause

Dashboard bi cold cache khoang 140 giay vi `getDashboardData()` tung goi truc tiep cac ham build nang trong user request:

- `buildDashboardDataFresh_()`
- `buildPipeEngine()`
- `getPlanData()`
- `getSpreadsheet()`
- `openById`

Khi cache hit, Dashboard mo nhanh. Nhung khi cache miss, nguoi dung, bao gom lanh dao, phai cho cold build chay trong request mo Dashboard.

## Muc Tieu Kien Truc

- `getDashboardData()` la snapshot-only fast path.
- User request khong auto-build snapshot.
- `refreshDashboardSnapshot_()` la background builder de tao snapshot truoc.
- Drilldown data duoc lazy load qua endpoints rieng, khong nam trong initial Dashboard payload.

## Commit Da Lam

- `f136b57` `refactor(dashboard): prepare snapshot and drilldown endpoints`
- `5e2c284` `feat(dashboard): lazy load drilldown data`
- `b040784` `refactor(dashboard): serve dashboard from snapshot`

## Luong Hien Tai

- `buildDashboardDataFresh_()`: build du lieu nang, van con `openById`.
- `refreshDashboardSnapshot_()`: build snapshot nen bang `buildDashboardDataFresh_()` va ghi snapshot vao cache/durable storage.
- `getDashboardData()`: doc `readDashboardSnapshotCache_()`, miss thi doc `readDashboardSnapshot_()`, neu missing thi tra loi nhanh voi `success:false`.
- `getDashboardPipeList(statusKey)`: lazy load danh sach pipe theo KPI.
- `getDashboardProcessPipeList(processName)`: lazy load danh sach pipe theo queue/process.
- `getDashboardPassport(pipeNo)`: lazy load ho so pipe.

Luu y: cac lazy drilldown endpoints hien van co the cold vi con goi `buildDashboardDataFresh_()`. Phase nay chi tach initial Dashboard payload khoi du lieu nang.

## Runbook Truoc Deploy

1. Push code len Apps Script test/dev.
2. Chay `refreshDashboardSnapshot_()`.
3. Xac nhan `readDashboardSnapshot_()` co `success:true` va co `snapshotMeta`.
4. Mo Dashboard test.
5. Test KPI click.
6. Test Queue click.
7. Test Search/Passport.
8. Chi deploy production khi tat ca buoc tren PASS.

## Runtime Validation Test/Dev

- `clasp push`: PASS
- `adminRefreshDashboardSnapshot()`: PASS
- `builtAt`: `2026-07-09T20:51:46.682Z`
- `durationMs`: `43621`
- Snapshot payload: `1256` bytes
- Chunks: `1`
- `adminGetDashboardSnapshotStatus()`: `success=true`, `hasSnapshot=true`
- Initial Dashboard load: PASS ~2.1s
- KPI click "Đang xử lý": PASS ~114s
- Queue click "Đầu vào": PASS ~8.2s
- Passport pipe `1006`: PASS ~9.4s
- Search box: chua xac nhan end-to-end
- Production deploy: NO

## Pre-production Smoke Test Checklist

Checklist này chỉ dùng cho manual smoke test trên deployment. Chỉ ghi PASS/FAIL sau khi đã chạy kiểm thử thực tế.

| Hạng mục | Kết quả | Thời gian | Người thực hiện | Ghi chú |
|---|---|---|---|---|
| Mở Dashboard lần đầu |  |  |  |  |
| Refresh Snapshot |  |  |  |  |
| Worker submit/sync |  |  |  |  |
| Drilldown KPI |  |  |  |  |
| Drilldown Queue |  |  |  |  |
| Search |  |  |  |  |
| Passport |  |  |  |  |
| Refresh trình duyệt |  |  |  |  |
| Mở tab mới |  |  |  |  |

Ghi chu:

- Initial Dashboard no-cold-user-request da PASS test/dev.
- Drilldown van co the cold vi con goi `buildDashboardDataFresh_()`.

## Neu Snapshot Missing

Neu snapshot missing, Dashboard tra loi nhanh voi `success:false` va khong xoay lau.

Cach xu ly:

1. Chay `refreshDashboardSnapshot_()`.
2. Xac nhan lai `readDashboardSnapshot_()`.
3. Mo lai Dashboard.

## Rollback

- Neu Phase 3 loi: revert `b040784` de `getDashboardData()` quay lai build fresh.
- Neu lazy drilldown loi: revert `5e2c284`.
- Neu snapshot/drilldown infra loi: revert `f136b57`.

## Viec Con Lai

- Gan refresh sau submit/sync.
- Them trigger dinh ky du phong.
- Toi uu drilldown endpoints de khong cold.
