# NKT Management System - Business Rules

## Source Of Truth

Business rules are centralized in `BusinessRules.gs`.

Other modules must call BusinessRules helpers or compatibility wrappers such as:

- `classifyBusinessStatus(transaction, previousStatus, currentPipeState)`
- `isThanhPhamKpiPipe(pipe)`
- `getPipeDashboardStatusKey_(pipe)`
- `getPipeExportBusinessState_(pipe)`

Do not copy defect lists or state-transition rules into Dashboard, Export, Planning, or validation modules.

## Business Object

The business object is one `PipeID` / `pipeNo`.

KPI and current-state grouping are calculated per unique pipe, not per transaction, event, defect, or sheet row.

Examples:

- One pipe with `Hỏng ren`, then `Xì pin`, is still one checked pipe.
- When one pipe moves from `CHO_SUA` to `THANH_PHAM`, `CHO_SUA` decreases by 1 and `THANH_PHAM` increases by 1; the same pipe must not appear in both buckets.

## Business States

There are exactly three current business states:

- `THANH_PHAM`
- `CHO_SUA`
- `LOAI`

`DANG_XU_LY` is a process state only. It is exposed as `currentProcessState` / dashboard group `dxl` when a pipe has no current business state.

## Defect Groups

Repairable defects map to `CHO_SUA`, including:

- `Xì pin`
- `Xì box`
- `Xì cả 2 đầu`
- `Hỏng ren`
- `Hỏng coupling`
- `Hỏng ren và coupling`
- legacy accepted repairable reasons such as `Không lắp được coupling` and `Khác`

Scrap defects map to `LOAI`, including:

- `Rỗ thân, ăn mòn`
- `Tắc paraffin`
- `Không đủ chiều dày`
- `Tắc ống`
- `Khuyết tật ngang`
- `Khuyết tật dọc`
- legacy accepted scrap reasons such as `Loại NDT`, `Tiện lại không đạt`, and `Thiếu chiều dày`

## State Transition

- New pipe + hydraulic pressure test passed -> `THANH_PHAM`
- Pipe + repairable defect -> `CHO_SUA`
- `CHO_SUA` + repair completed + hydraulic pressure test passed -> `THANH_PHAM`
- Pipe + scrap defect -> `LOAI`
- `LOAI` is terminal and cannot return to `THANH_PHAM`

Non-business production steps do not create a fourth business state. They keep the previous current business state, or use `currentProcessState = DANG_XU_LY` when no business state exists.

## KPI Helper

`isThanhPhamKpiPipe(pipe)` remains the KPI helper for Thành phẩm, but its implementation is delegated to `BusinessRules.gs`.

The helper is current-state aware:

- If a pipe has current business state `LOAI` or `CHO_SUA`, it is not counted as Thành phẩm.
- If a pipe has current business state `THANH_PHAM`, it is counted as Thành phẩm.
- The legacy note rule `Ống rửa lại không ép` remains centralized in BusinessRules for backward compatibility.

## Current State And History

History is preserved in `pipe.history`.

Dashboard, Export, Planning, and reports must use current-state helpers instead of replaying historical defects locally.
