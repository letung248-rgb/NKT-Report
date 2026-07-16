# Handover

## Trang thai hien tai

- Sprint 11A Patch Rescue: **CLOSED**. DEV review dung `/dev`; Production dung `/exec`.
- Production hien dang chay Apps Script version `49`.
- Production navigation: **PASS**.
- Sprint 10A Dashboard: **PASS va da khoa**.
- Sprint 11A Export bien ban theo Ma bo: **PASS**.
- Module export: `?view=xuat-bao-cao`.
- Git source da bao gom dieu chinh preflight cuoi: metadata thieu la canh bao, khong phai loi chan xuat.
- Planning Size source la `DANH_MUC_SIZE`; khong fallback am tham sang `pipe.size`.
- Neu doi Drive scope/API, chay `authorizeDriveForExport` trong Apps Script Editor.
- Export XLSX dung spreadsheet export endpoint, khong dung `getAs(XLSX)`.

## Route chinh Production

- `/exec`
- `/exec?view=ke-hoach`
- `/exec?view=xuat-bao-cao`

## Kien truc da khoa

- Ma bo la Business Key, dong thoi la so bien ban.
- Ma bo duoc sinh tai nguyen cong Dong goi; khong dung `reportNo` va khong tu sinh quy tac danh so.
- Export la module rieng, khong nam trong Dashboard.
- Output giai doan 1 la mot file XLSX nhieu sheet; moi sheet ung voi mot Ma bo va copy nguyen Sheet mau.
- Form thanh pham dung Sheet `177`; form ong hong dung Sheet `71H`.
- Toi da 40 dong ong. Neu it hon 40 thi an dong du; neu vuot 40 thi chan export.
- `buildPipeEngine()` va `currentBusinessStatus` la nguon su that cho du lieu/trang thai export.

## Preflight

- Chan export khi thieu Ma bo, khong co danh sach ong, vuot 40 ong, khong xac dinh duoc loai bien ban, khong tim thay template, hoac loi tao workbook/sheet.
- Metadata thieu (LSX, khach hang, lo, nguon goc, do day, phieu nhan, ngay nhan) chi hien canh bao `Thieu thong tin`; checkbox va export van hoat dong.
- Cac o mapping thieu du lieu de trong theo form mau; khong tu suy dien du lieu.

## Khong duoc thay doi

- Dashboard va Dashboard Design, tru khi co bug duoc phe duyet.
- Route hien co, Planning CRUD, Export Sprint 9, Business Key Ma bo.
- `buildPipeEngine`, `currentBusinessStatus`, Apps Script data flow va Google Sheet schema.
- Quy tac 40 dong, mapping chinh, output XLSX nhieu sheet.
- Khong mo Sprint 12, khong them PDF/ZIP hay mo rong chuc nang trong handover nay.
