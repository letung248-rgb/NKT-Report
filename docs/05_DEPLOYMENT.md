# NKT Management System - Deployment

## Deployment Policy

Do not deploy automatically.

Push, `clasp push`, and Web App deployment must only be done when explicitly requested.

## Current Deployment Stack

- Source control: Git
- Apps Script sync: CLASP
- Runtime: Google Apps Script V8
- UI delivery: Apps Script Web App
- Database: Google Sheet

## Standard Deployment Checklist

### 1. Git Status

Check working tree before any release action.

```text
git status --short
```

### 2. Review Changes

Review changed files and staged diff before committing.

### 3. Commit

Commit only reviewed changes.

### 4. Push

Push only when requested.

### 5. CLASP Push

Run CLASP push only when requested.

### 6. Deploy Web App

Deploy Web App only when requested.

## OAuth Note

OAuth has already been verified as not being the cause of the previously investigated error.

Do not assume OAuth is the root cause for future issues without new evidence.

## Open Items

Detailed deployment commands should be documented only after the exact release workflow is confirmed.
