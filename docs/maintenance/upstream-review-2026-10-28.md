# Upstream review — 2026-10-28

Base: fork `4.x` at a5a31e9d. Upstream `vitodeploy/vito:4.x` at 25798391 contains 13 commits beyond the common ancestor (the comparison is ancestry-based, so previously adapted fixes still appear).

| Commit | Decision |
| --- | --- |
| 312bc97c Proxmox | Defer new provider and setup UI; outside the requested bug-fix integration. |
| 0ee5ed10 key-generation failures | Fork already throws on missing keys and uses OpenSSH format. Adapt path-free error message; do not import upstream process-output logging. |
| 13fc31ff Ubuntu 26 / editable Proxmox | Ubuntu 26 and binary GPG keyrings already present in fork. Port MariaDB setup failure handling and skip MaxScale. Defer Proxmox credential editing and service-registration redesign. |
| 661e497c Lightsail | Defer new provider; no existing fork implementation requiring its follow-up fixes. |
| aadd9f92 Ziggy removal | Already independently implemented. Dashboard URL catalogue unused by fork navigation; no replacement of fork bootstrap/UI. |
| 277987ed project authorization | Selected protections already adapted in 5129de80 and subsequent fork policies/controllers. Preserve actor-owned source controls, server roles, token rules, disconnected reads and removed workflows. Add exclusion of soft-deleted source-control records to the existing validation. |
| 8a545bfa dependencies | Do not replace fork lockfiles and dependency choices with upstream versions. |
| fdc26951 contribution docs | Target document removed in fork; do not recreate upstream documentation tree. |
| 67fd6a70 modern deployment branch | Already implemented: UpdateBranch uses source checkout and named path arguments. |
| 8598e4dc SQL identifiers | Existing fork MySQL/MariaDB create, delete and grant templates already quote identifiers. |
| 22a08747 version 4.2.0 | Do not relabel the fork or import upstream built assets. |
| 11dcdd3c dependency refresh | Defer bulk lockfile/Vite updates; preserve fork dependencies. |
| 25798391 version 4.2.1 | Do not relabel the fork or import upstream built assets. |

## Fork fix branch

Port b89d7941 from `fix/backup-retention-and-logic-errors` with provenance:

- Apply retention after a successful backup status transition, count usable copies, and protect active backup/restore/delete jobs. Preserve pgBackRest handling. Additional guards handle a missing backup relation and invalid zero retention without deleting the last successful copy.
- Guard missing replica backup configuration.
- Prefer the most specific DNS zone and propagate provider failures.
- Bracket IPv6 addresses in verification resolution.
- Propagate DigitalOcean/Hetzner power-action HTTP 404 errors.
- Keep the generic challenge-staging error instead of exposing internal exception details.

Validation: PHP syntax on changed PHP files; isolated in-memory SQLite/Eloquent regression covering failed/incomplete backups, retention count, active jobs, metadata updates and missing backup relations. No real storage deletion, SSH or provider operations run during validation.
