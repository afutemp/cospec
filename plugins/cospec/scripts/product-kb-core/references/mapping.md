# IPD Evidence Mapping

- Epic → product theme, strategic objective, value pillar and version theme.
- Feature → exactly one managed file under `03-功能规划/`; its body defines problem, goal and capability boundary.
- Story → main scenarios, user flows, observable outcomes and acceptance evidence.
- Tech → implementation constraints, dependencies, NFR/interface/data constraints and effort evidence. Never promote Tech into customer value.
- Status/priority/owner/version/sprint → backlog, scope matrix, roadmap and milestone state.
- Comments → supplemental background, decisions, risks and open questions. Comments never silently override explicit issue text.
- Attachments → download original files and parse supported content. `status=parsed` content may provide planning evidence and cites `IPD-<issueId>/ATTACHMENT-<attachmentId>`; empty/unsupported/failed attachments remain metadata/index evidence only and must surface warnings.
- Deliverables → metadata index unless a separate deliverable-content collector has parsed them.
- Lifecycle stages/activities/standards/reviews → milestones, collaboration dependencies, quality gates and review state.

Every major statement cites `IPD-<id>` or writes `[OPEN] IPD 未提供`. Missing evidence is never filled from generic product knowledge.
