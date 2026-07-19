# NKT Management System - Acceptance Checklist

## Purpose

Use this checklist after E2E test execution and before release approval.

Each item must be marked `PASS`, `FAIL`, or `N/A`, with notes and evidence when applicable.

## A. Worker Acceptance

| Item | PASS | FAIL | N/A | Notes |
|---|---|---|---|---|
| Worker UI opens normally. | □ | □ | □ | |
| Worker UI validates required input fields. | □ | □ | □ | |
| Worker submit succeeds for valid input. | □ | □ | □ | |
| Queue works for queued submit results. | □ | □ | □ | |
| Duplicate submit behavior is accepted or documented. | □ | □ | □ | |
| Error messages are correct and actionable. | □ | □ | □ | |

## B. Google Sheet Acceptance

| Item | PASS | FAIL | N/A | Notes |
|---|---|---|---|---|
| Data is written to the correct columns in sheet `Data`. | □ | □ | □ | |
| No existing data is lost. | □ | □ | □ | |
| New records are not written to the wrong row or wrong sheet. | □ | □ | □ | |
| Timestamp / receive time is recorded correctly. | □ | □ | □ | |

## C. Dashboard Acceptance

| Item | PASS | FAIL | N/A | Notes |
|---|---|---|---|---|
| Dashboard opens normally. | □ | □ | □ | |
| Dashboard reads data successfully. | □ | □ | □ | |
| KPI values display correctly. | □ | □ | □ | |
| Pipe lists display the expected pipes. | □ | □ | □ | |
| Dashboard does not crash when relevant data is empty. | □ | □ | □ | |

## D. Business Rule Acceptance

| Item | PASS | FAIL | N/A | Notes |
|---|---|---|---|---|
| KPI Thanh pham counts pipe when Process = `Ép thủy lực` and Status normalized = `ok`. | □ | □ | □ | |
| KPI Thanh pham counts pipe when Notes contain `Ống rửa lại không ép`. | □ | □ | □ | |
| KPI Thanh pham helper uses `BusinessRules.gs` and does not overlap with current `CHO_SUA` / `LOAI`. | □ | □ | □ | |
| Business rule behavior matches `docs/02_BUSINESS_RULES.md`. | □ | □ | □ | |

## E. Regression Checklist

| Item | PASS | FAIL | N/A | Notes |
|---|---|---|---|---|
| Dashboard Flow has not changed. | □ | □ | □ | |
| Worker Flow has not changed. | □ | □ | □ | |
| Google Sheet structure has not changed. | □ | □ | □ | |
| Approved business rules have not changed. | □ | □ | □ | |

## F. Result

| Result Item | PASS | FAIL | N/A | Notes |
|---|---|---|---|---|
| Acceptance checklist is complete. | □ | □ | □ | |
| All required evidence is attached or linked. | □ | □ | □ | |
| Any FAIL item has a separate bug/task reference. | □ | □ | □ | |
| Release can proceed to Release Checklist review. | □ | □ | □ | |
