# NKT Management System - Future Refactor Backlog

## Purpose

This document records technical debt and possible future refactor directions.

These items are not approved implementation tasks. They are backlog notes only.

Do not implement any item here without a separate approved task, updated docs, and focused verification.

## Utils.js Decomposition

`Utils.js` currently owns spreadsheet access, data column mapping, transaction reads, plan reads, parsing helpers, normalization helpers, and validation helpers.

Future direction:

- split spreadsheet access from parsing helpers
- separate dashboard read repository from validation utilities
- keep compatibility with current Apps Script global scope

## Shared Constants

Shared constants currently live mainly in `Code.js`.

Future direction:

- centralize sheet names, column counts, queue settings, and feature flags
- avoid duplicate literals for sheet names and column positions
- keep constants compatible with Apps Script load order

## Repository Layer

Dashboard reads and submit writes currently access Google Sheet through helper functions and service-specific logic.

Future direction:

- define narrow repository-style helpers for `Data`, `Kế hoạch`, and `SL nhận từ KH`
- isolate sheet access from business rule calculation
- keep read path and write path separate

## Logging

Logging currently uses `Logger.log()` in selected server functions.

Future direction:

- define consistent log shape for submit, queue, dashboard, lookup, and validation
- include operation name, timing, mode, and error context
- avoid logging sensitive production data unnecessarily

## Error Handling

Error handling currently returns mixed response shapes across server functions.

Future direction:

- standardize success/error response contracts
- separate user-facing messages from developer diagnostics
- keep Apps Script client compatibility with `google.script.run`

## Caching

Bundle lookup currently uses `CacheService`.

Future direction:

- document cache keys, invalidation behavior, and fallback path
- evaluate whether dashboard read caches are needed
- ensure cache never becomes the only source of truth

## Enum And Configuration

Business statuses, process names, and sheet headers are represented as strings.

Future direction:

- define approved enums/config maps for statuses, process groups, sheet names, and headers
- keep Vietnamese display text separate from normalized comparison values
- avoid changing finalized business rules during enum extraction

## Testing Strategy

The project currently relies mainly on focused manual checks and Apps Script runtime behavior.

Future direction:

- add fixture-based tests for normalization, pipe list parsing, status classification, and KPI helpers
- add dashboard read smoke checks using sample transaction data
- add submit row-building tests that do not write to Google Sheet
- document manual Web App verification steps for Worker Flow and Dashboard Flow

## Refactor Constraints

Any future refactor must:

- preserve current Worker Flow and Dashboard Flow unless separately approved
- preserve finalized business rules
- avoid Google Sheet structure changes unless approved
- be rollbackable
- be split into small reviewable steps
