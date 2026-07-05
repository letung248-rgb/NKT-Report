# NKT Management System - Release Checklist

## Purpose

Use this checklist after E2E and acceptance verification pass, before any deployment or production release action.

Do not push, run `clasp push`, or deploy until release approval is explicit.

## A. Git

| Item | Done | Notes |
|---|---|---|
| □ `git status` is clean or contains only approved release changes. | □ | |
| □ Commits are scoped correctly. | □ | |
| □ No debug-only files remain in the release set. | □ | |

## B. Documentation

| Item | Done | Notes |
|---|---|---|
| □ Documentation is updated. | □ | |
| □ `REPORT.md` is updated if needed. | □ | |
| □ E2E and acceptance evidence are available. | □ | |

## C. Source

| Item | Done | Notes |
|---|---|---|
| □ No important TODO remains for this release. | □ | |
| □ No legacy file/function remains that must be removed before release. | □ | |
| □ No source change outside release scope is included. | □ | |

## D. Testing

| Item | Done | Notes |
|---|---|---|
| □ Acceptance Checklist is PASS. | □ | |
| □ E2E Matrix is PASS. | □ | |
| □ No blocker remains open. | □ | |

## E. Deployment

| Item | Done | Notes |
|---|---|---|
| □ Backup completed if needed. | □ | |
| □ Deploy action approved. | □ | |
| □ Deploy completed. | □ | |
| □ Smoke Test completed. | □ | |
| □ Dashboard operation confirmed. | □ | |
| □ Worker operation confirmed. | □ | |

## F. Rollback

| Item | Done | Notes |
|---|---|---|
| □ Rollback commit or rollback procedure is available. | □ | |
| □ Commit/tag/version to roll back to is known. | □ | |
| □ Rollback owner is identified. | □ | |
