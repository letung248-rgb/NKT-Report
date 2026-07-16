# Changelog

## Production version 49 - Navigation Patch - 2026-07-16

- Production hien dang chay Apps Script version `49`.
- Fix Planning back navigation: them nut `Về Tổng quan` tro ve `?view=dashboard`.
- Production navigation: **PASS**; Export navigation khong bi anh huong.

## Sprint 11A Patch Rescue - CLOSED - 2026-07-16

- Fix Planning Size source bang `DANH_MUC_SIZE` va bo fallback am tham sang `pipe.size`.
- Fix Planning date parsing ve ISO `yyyy-MM-dd`.
- Fix Export Drive API/OAuth/createFile va XLSX export conversion.
- Metadata thieu van cho phep chon va xuat Excel.

## Sprint 11A - Export bien ban theo Ma bo - 2026-07-15

### Hoan thanh

- Them module rieng `?view=xuat-bao-cao` de xuat bien ban ong thanh pham va ong hong.
- Su dung Ma bo lam Business Key va so bien ban; khong tao `reportNo` hay quy tac danh so moi.
- Ho tro loc theo ngay/thang Dong goi, tim Ma bo/Size/LSX, chon checkbox va xuat batch mot file XLSX nhieu sheet.
- Moi sheet copy tu form mau tuong ung: `177` cho thanh pham va `71H` cho ong hong.
- Giu quy tac toi da 40 ong: an dong chua dung, chan Ma bo vuot qua 40 ong.
- Bo sung preflight all-or-nothing, xu ly ten sheet, template va xoa workbook tam khi loi.
- Thieu metadata chi hien canh bao `Thieu thong tin`; van cho phep xuat va de trong o mapping khong co du lieu.
- Loi nghiem trong hien badge `Khong the xuat` va khong cho chon export.

### Kiem thu

- PASS local: route, loc ngay/thang, tim Ma bo, batch export, 15/40/>40 ong, preflight va console.
- PASS local: Ma bo thieu metadata van chon va xuat duoc; Ma bo loi nghiem trong van bi chan.
