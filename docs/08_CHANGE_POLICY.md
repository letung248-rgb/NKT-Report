# NKT Management System - Change Policy

## Purpose

This policy governs how changes are proposed, reviewed, approved, implemented, and rolled back.

The project uses Google Apps Script and Google Sheet as production data infrastructure, so small and traceable changes are required.

## Root Cause First

Find the root cause before changing code or documentation.

Do not patch symptoms without understanding the source behavior, affected flow, and data impact.

## Stability First

Prefer the smallest stable change that preserves current behavior.

Avoid broad refactor, rewrites, or structural changes unless the task explicitly approves them.

## Business Rule Approval

Do not add, remove, broaden, or reinterpret business rules without approval.

Business rule changes must be documented in `02_BUSINESS_RULES.md` before code changes are made.

## Flow Protection

Do not change Dashboard Flow unless the new flow is reviewed and approved.

Current Dashboard Flow:

```text
Dashboard.html
    -> getDashboardData()
    -> DashboardServer.js
    -> Utils.js
    -> Google Sheet: Data / Kế hoạch
```

Do not change Worker Flow unless the new flow is reviewed and approved.

Current Worker Flow:

```text
Index.html
    -> submitReport()
    -> SubmitReport.js
    -> Google Sheet: Data
```

## Google Sheet Protection

Do not rename Google Sheets, change sheet structure, change column meaning, or alter production data unless approved.

Any proposed data structure change must document:

- affected sheet name
- affected columns
- migration or compatibility plan
- rollback plan
- verification plan

## Architecture Documentation First

Any architecture-impacting change must update `docs/` before source code changes.

Architecture-impacting changes include:

- changing file responsibilities
- moving business logic between files
- changing Dashboard Flow or Worker Flow
- changing data access responsibilities
- changing deployment behavior
- changing queue or fallback behavior

## Rollbackable Changes

Every change must be easy to inspect and rollback.

Avoid mixing unrelated fixes in one task.

Avoid hidden behavior changes inside cleanup or formatting work.

## Minimal Scope

Each task must change the smallest safe scope.

If a task reveals unrelated issues, record them as follow-up items instead of fixing them immediately.

## Review And Approval

Before implementation:

1. Check `git status --short`.
2. Review relevant current diff.
3. Confirm the intended change scope.
4. Update docs first for architecture or business rule changes.
5. Get approval for changed architecture, business rules, flows, or data structure.

After implementation:

1. Run focused verification.
2. Review final diff.
3. Report changed files and verification result.
4. Commit only when requested or approved by the project workflow.

## Push And Deploy

Do not push, run `clasp push`, or deploy the Web App unless explicitly requested.
