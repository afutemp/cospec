# Source Adapter Contract

A source adapter exposes `adapterId`, `adapterVersion`, and async methods:

- `describeSource(options)`
- `listIssues(options)` → `{items,total,nextCursor}`
- `getIssue(issueId, context)`
- `listChildren(issueId, context)`
- `listComments(issueId, context)`
- `listAttachments(issueId, context)`
- `downloadAttachment(attachmentId, destination)`
- `collectLifecycle(options)`

Adapters read source data only. `downloadAttachment` writes only to the destination path supplied by Core; Core validates the source directory, constructs safe relative paths, parses content, computes fingerprints and writes snapshot records. Recoverable list/download/parse failures become structured warnings. Invalid scope and page-level failures are fatal.
