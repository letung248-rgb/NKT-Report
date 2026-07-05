# NKT Management System - AI Guidelines

## Working Principles

### Root Cause First

Find the root cause before changing code. Do not patch symptoms without understanding the source of the issue.

### Stability First

Prefer small, stable, reversible changes. Avoid broad edits unless a task explicitly asks for architecture-level refactor.

### Do Not Guess

Base analysis and changes on source code, command output, and confirmed requirements.

### Do Not Expand Business Rules Without Approval

Do not add or broaden business rules unless the rule has been explicitly confirmed.

### Do Not Modify Google Sheet Unless Requested

Google Sheet is the production data store. Do not edit it unless the task explicitly requires it.

### No Out-of-Scope Refactor

Do not refactor outside the task scope.

### Rollbackable Changes

Every change should be easy to inspect and rollback.

### Minimal Scope

Each task should change the smallest safe scope.

### Review Before Commit

Check `git status`, staged diff, and relevant source diff before committing.

### Review Before Editing

Before changing files, check `git status --short` and the relevant current diff.

### Push/Deploy Only When Requested

Do not push or deploy unless explicitly requested.

## Standard Prompt Types

### AUDIT

Purpose: inspect, analyze, and report.

Rules:

- Do not edit files.
- Do not commit.
- Do not push.
- Do not deploy.
- Report commands run, findings, root cause, and recommendation.

### IMPLEMENT

Purpose: make a small approved change.

Rules:

- Confirm scope.
- Change only the files required.
- Do not change business rules unless explicitly requested.
- Verify with focused checks.
- Report changed files and verification result.

### DOCUMENT

Purpose: create or update documentation.

Rules:

- Change documentation files only.
- Do not edit source code.
- Do not change Google Sheet.
- Check `git status --short` and relevant diff before editing.
- Report created/updated docs and final Git status.
