# NKT Documentation & Governance

## Purpose

This folder is the documentation and governance source for NKT Management System.

It records the current architecture, business rules, data flow, deployment policy, coding standards, architecture decisions, change policy, and future refactor backlog.

The goal is to keep project changes traceable, reviewable, and safe before source code is changed.

## Folder Structure

```text
docs/
|
+-- README.md                 <-- Entry point
+-- 00_PROJECT_OVERVIEW.md
+-- 01_SYSTEM_ARCHITECTURE.md
+-- 02_BUSINESS_RULES.md
+-- 03_DATA_FLOW.md
+-- 04_AI_GUIDELINES.md
+-- 05_DEPLOYMENT.md
+-- 06_CODING_STANDARD.md
+-- 07_ARCHITECTURE_DECISIONS.md
+-- 08_CHANGE_POLICY.md
+-- 09_FUTURE_REFACTOR.md
+-- 10_E2E_TEST_MATRIX.md
+-- 11_ACCEPTANCE_CHECKLIST.md
+-- 12_RELEASE_CHECKLIST.md
+-- 13_E2E_EXECUTION_PLAN.md
+-- REPORT.md
```

## Reading Order

For developers and AI assistants, read the documents in this order:

1. `00_PROJECT_OVERVIEW.md`
2. `01_SYSTEM_ARCHITECTURE.md`
3. `02_BUSINESS_RULES.md`
4. `03_DATA_FLOW.md`
5. `04_AI_GUIDELINES.md`
6. `05_DEPLOYMENT.md`
7. `06_CODING_STANDARD.md`
8. `07_ARCHITECTURE_DECISIONS.md`
9. `08_CHANGE_POLICY.md`
10. `09_FUTURE_REFACTOR.md`
11. `10_E2E_TEST_MATRIX.md`
12. `11_ACCEPTANCE_CHECKLIST.md`
13. `12_RELEASE_CHECKLIST.md`
14. `13_E2E_EXECUTION_PLAN.md`
15. `REPORT.md`

## Document Authority

- Architecture source of truth: `01_SYSTEM_ARCHITECTURE.md` and `07_ARCHITECTURE_DECISIONS.md`.
- Business rule implementation source of truth: `BusinessRules.gs`; documented in `02_BUSINESS_RULES.md`.
- Flow source of truth: `03_DATA_FLOW.md`.
- AI/development workflow source of truth: `04_AI_GUIDELINES.md` and `08_CHANGE_POLICY.md`.
- Coding convention source of truth: `06_CODING_STANDARD.md`.
- Deployment policy source of truth: `05_DEPLOYMENT.md`.
- Future refactor backlog: `09_FUTURE_REFACTOR.md`.
- E2E verification plan: `10_E2E_TEST_MATRIX.md`.
- Acceptance checklist: `11_ACCEPTANCE_CHECKLIST.md`.
- Release checklist: `12_RELEASE_CHECKLIST.md`.
- E2E execution guide: `13_E2E_EXECUTION_PLAN.md`.

`docs/` is the official documentation set for the project.

Source code is the current implementation state.

If source code and documentation disagree:

1. Do not automatically assume either side is correct.
2. Analyze the root cause of the discrepancy.
3. Verify with the reviewer or Technical Lead.
4. After agreement, update either documentation or source code as approved.

Do not expand Business Rules based only on documentation wording.

All architecture or Business Rule changes must be reviewed and approved before implementation.

## Testing & Release Documents

- `10_E2E_TEST_MATRIX.md`: Defines Phase 5A end-to-end test cases for Worker submit, queue/process, Google Sheet writes, Dashboard reads/renders, KPI Thanh pham, and related pipe lists.
- `11_ACCEPTANCE_CHECKLIST.md`: Provides PASS/FAIL/N/A acceptance gates for Worker, Google Sheet, Dashboard, Business Rule, and regression readiness.
- `12_RELEASE_CHECKLIST.md`: Provides pre-release gates for Git, documentation, source scope, testing, deployment, and rollback readiness.

## Execution Documents

- `13_E2E_EXECUTION_PLAN.md`: Guides how to run the E2E test matrix, collect evidence, record PASS/FAIL, and handle FAIL cases. This is a test execution guide, not a test result document.

## Governance Rule

Any architecture or business rule change must update `docs/` first, then receive review/approval, then code may be changed.

Do not silently change:

- Dashboard Flow
- Worker Flow
- KPI rules
- `classifyBusinessStatus()` behavior
- Google Sheet names
- Google Sheet data layout
- Apps Script deployment behavior

## Review To Commit Workflow

1. Review current `git status --short` and relevant diff.
2. Update documentation for the intended change.
3. Review documentation diff.
4. Approve the intended architecture/business rule/flow decision.
5. Implement code only after approval, if code changes are required.
6. Run focused verification.
7. Review final diff.
8. Commit only reviewed and approved changes.
9. Push/deploy only when explicitly requested.

Documentation-only changes may be committed separately after review.
