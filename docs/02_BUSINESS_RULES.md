# NKT Management System - Business Rules

## Scope

This document records business rules already present in source code and rules that have been explicitly finalized for the current architecture.

Do not add new business rules here unless they have been confirmed.

## Dashboard Business Rule Location

Dashboard business rules are located in `DashboardServer.js`.

Important functions:

- `classifyBusinessStatus(transaction, previousStatus, currentPipeState)`
- `isThanhPhamKpiPipe(pipe)`
- `buildPipeEngine()`
- `getDashboardData()`

## Current Pipe Status

`classifyBusinessStatus()` determines the current business status of a pipe transaction flow.

It classifies status values such as:

- `LOAI`
- `CHO_SUA`
- `THANH_PHAM`
- `DANG_XU_LY`

This function is for pipe current state classification.

## KPI Thanh Pham Rule

KPI "Thanh pham" does not use `currentBusinessStatus`.

KPI Thanh pham is calculated by `isThanhPhamKpiPipe(pipe)`.

A pipe is counted as KPI Thanh pham when either condition is true:

1. The pipe has a transaction where:

```text
normalizeString(Process) includes "ep thuy luc"
AND
normalizeString(Status) equals "ok"
```

2. The pipe has notes containing:

```text
Ong rua lai khong ep
```

## Rule Boundary

`classifyBusinessStatus()` determines the current status of a pipe.

`isThanhPhamKpiPipe(pipe)` is a separate helper for KPI Thanh pham.

Do not change `classifyBusinessStatus()` when changing only KPI Thanh pham behavior.

Top-level Dashboard KPI `kpi.tp` and `pipeLists.tp` use `isThanhPhamKpiPipe(pipe)`.

Other status-oriented summaries may still use `pipe.currentBusinessStatus`; do not treat those summaries as the KPI Thanh pham rule.

## Pipe Engine

`buildPipeEngine()` groups raw transactions into pipe objects.

It derives current pipe state from transaction history, entry number, process order, repair count, coupling change count, and pressure test count.

## KPI Calculation

`getDashboardData()` calculates dashboard KPI and summaries from pipe objects built by `buildPipeEngine()`.

KPI and summaries include:

- total pipe count
- Thanh pham count
- Hong/Loai count
- Cho sua count
- Dang xu ly count
- process stats
- queue stats
- size stats
- rig stats
- shift stats
- plan vs actual stats
