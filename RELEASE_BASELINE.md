# NKT Report 2026 — Release Baseline

## Deployment

- Current Web App URL (last known): https://script.google.com/macros/s/AKfycbyYIPl-YJj4Oftxf7G_XV1Bl6sC4D1AEiQ0NTOVpzwyqKfnk0PD7TJ7_n5tA6fRUTwA/exec
- Script ID: `1sQcjAqVdq4eETueFfRzr_BaRFD65-zPyraKULz1jWf6kszyyt6RdG_ge`
- No deployment was performed for this baseline.

## Source control

- Git commit hash (current `main` ref): `db49893f7ac3dab5d1e88903bdb721c40c12eb10`
- GitHub repository: https://github.com/letung248-rgb/NKT-Report
- Repository root: `NKT Report_2026/NKT-Report`
- Working tree status: **NOT CLEAN**. The approved seven-worker change in `Index.html` is pending, and this new baseline file is not committed. Git status could not be executed because the `git` executable is unavailable in the current environment.

## Current business rules

- `Ép thủy lực` + `Đạt` counts as Thành phẩm KPI.
- `Tình trạng ống` contains only `Đạt` or `Loại`.
- `Nguyên nhân loại` contains the specific reject reason, such as `Không đủ chiều dày`, `Xì box`, or `Xì cả 2 đầu`.
- New worker submissions write only the newly built rows directly to spreadsheet ID `18UgAbhjXvi0Vi2Jo-ePs7dXMZA7rCtcmeleWGWbtQUY`, tab `Data`, using batch `setValues()`.
- Data mapping: column G = `Tình trạng ống`, H = `Nguyên nhân loại`, T = `Tình trạng`.
- Existing queue functions remain available for backlog/manual processing; new worker submissions do not flush the old queue backlog.

## Known stable features

- Worker login and report-entry form are served from `Index.html`.
- `submitReport(payload)` supports synchronous batch writing with `fast_append` and spreadsheet fallback timing modes.
- Append/write errors are returned as real errors instead of false success responses.
- Dashboard data cache is invalidated after successful writes.
- Existing data and sheet formatting are not modified by the worker submit path.

## Remaining roadmap

- Error Analysis
- Top Rig
- History
