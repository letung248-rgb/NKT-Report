# NKT Management System - Project Overview

## Purpose

NKT Management System is a Google Apps Script Web App used to record worker production reports and view dashboard status for pipe processing operations.

The system has two primary flows:

- Worker Flow: workers submit operation reports from the mobile/worker UI.
- Dashboard Flow: supervisors view production status, KPI, queue, plan, and pipe details from the dashboard UI.

## Primary Users

- Workers who submit pipe operation reports.
- Supervisors and administrators who monitor dashboard KPI and production status.
- Project maintainers who update Apps Script source code and documentation.

## Core Architecture

Google Sheet is the main database.

Google Apps Script is the Web App backend. It serves HTML UI files, receives client calls through `google.script.run`, reads and writes Google Sheet data, and manages background queue processing.

## Worker Flow

```text
Index.html
    -> submitReport()
    -> SubmitReport.js
    -> Google Sheet: Data
```

## Dashboard Flow

```text
Dashboard.html
    -> getDashboardData()
    -> DashboardServer.js
    -> Utils.js
    -> Google Sheet: Data / Kế hoạch
```

## Current Source Shape

The project uses Apps Script global scope. JavaScript files are loaded into the same Apps Script project and share global functions/constants rather than explicit imports.
