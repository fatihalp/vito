# Project Guidelines

## Core Rules (High Priority)

- **Server Management Safety**: This software manages real servers and production data. Treat unintended changes, data loss, and operations on the wrong resource as unacceptable. Validate parameters, resource identity, project boundaries, and current state before every mutation; different inputs must never cause an operation to affect unintended resources.
- **Stop on Unsafe or Unrequested Operations**: If an operation would exceed the user's request, has an ambiguous target, or could modify or delete unintended data, warn the user and stop before making changes. Never continue by guessing. Enforce safeguards in the application to prevent accidental harmful actions even when the user makes a mistake.
- **Architectural Principles**: Refactor existing code and implement new features throughout the project using **MVC, SOLID, KISS, DRY, and YAGNI** with self-documenting code.
- **Zero Dead Code & Zero Tests**: Delete dead, unused, or obsolete code immediately. Do not build speculative abstractions or unused features (YAGNI). Zero tests are maintained in this project — never create `tests/` directories or test files.
- **Self-Documenting Code & Zero Comments**: Write self-documenting code with descriptive names and single-responsibility functions. No inline comments and no docblocks. Code must explain itself.
- **English-Only Codebase**: All code identifiers, UI strings, flash messages, validation texts, documentation, and localization keys must be in English. No non-English localization files or translations (`lang/en.json` only).
- **Simplicity Over Defensive Over-Engineering**: Avoid convoluted type-check chains, multi-step fallback ladders, and speculative branches. Keep logic linear, predictable, and clear.
- **Write LESS code**: Reuse existing code. No redundant code or duplications.
- **Analyse codebase first**: Check sibling files and established conventions before adding new code.
- **Never run `npm build/dev` or `artisan serve`** — the user runs them.
- **Don't run formatters (pint/prettier)** — the user runs them later.

## Stack

Laravel 13 (L10 structure), PHP 8.4, Inertia v2, React 19, Tailwind v4

## Laravel Boost MCP Tools

- `search-docs`: Use FIRST for Laravel ecosystem docs (version-aware). Pass multiple broad queries.
- `list-artisan-commands`: Check before running artisan commands.
- `tinker`: Debug PHP/Eloquent. `database-query`: Read-only DB queries.
- `database-schema`: Inspect tables/columns before writing migrations or queries.
- `get-absolute-url`: For sharing project URLs.
- `browser-logs`: Recent browser errors/exceptions.

## PHP

- Curly braces always. Constructor property promotion. Explicit return types on all methods.
- Self-documenting code only — zero comments, zero inline comments, zero unnecessary docblocks.
- Use array shapes in PHPDoc only when strictly necessary for static analysis.
- Avoid `DB::`, prefer `Model::query()`. Eager load to prevent N+1.
- Use `config()` not `env()` outside config files.

## Laravel — Architecture

Vito has a specific architecture. Match these patterns exactly:

- **Models** extend `app/Models/AbstractModel.php`, NOT `Illuminate\Database\Eloquent\Model`. `AbstractModel` provides `jsonUpdate()`.
- **Enums** implement `app/Contracts/VitoEnum.php` — requires `getColor(): string` and `getText(): string`. Cast enum properties to their enum class on the model.
- **Actions** in `app/Actions/` hold ALL business logic. Methods named `create()` / `update()` / `handle()` / `run()` / `install()` etc. Validate inside the Action with `Validator::make()`; extract to a private `validate()` when rules are complex. Compose Actions instead of building monoliths.
- **Controllers** are thin: receive request → call Action → return response. Use `Spatie\RouteAttributes` (`#[Get]`, `#[Post]`, `#[Prefix]`, `#[Middleware]`) and ALWAYS name routes (`#[Get('/', name: 'servers.index')]`). Return `Inertia::render()` for pages and `JsonResource` for JSON endpoints. Call `$this->authorize()` for policy checks.
- **Policies** in `app/Policies/` use the `HasRolePolicies` trait — provides `hasReadAccess()`, `hasWriteAccess()`, `hasOwnerAccess()`. No inline permission checks anywhere.
- **Jobs** implement `ShouldQueue` with both `Queueable` AND `UniqueQueue` traits. Wrap work in `$this->run($key, callable)`. Implement `failed(Exception $e)` for status updates. Prefer queued jobs over long-running pollers.
- **Resources** in `app/Http/Resources/`. Explicitly whitelist fields — never `parent::toArray()`. ALWAYS call `->getText()` / `->getColor()` on enum properties — never return raw enum values.
- **Broadcasting** uses `SocketEvent::dispatch()` with a `SocketEventDTO` (`projectId`, `type` like `'server.updated'`, `data` typically a Resource).
- **Bootstrap context**: shared catalogue data (provider lists, site types, GitHub App install state, public key text) is served from `App\Actions\Bootstrap\GetBootstrap` via `/bootstrap` and cached client-side via `useConfigs()`. Add new catalogue values to `GetBootstrap::configs()`, NOT to `HandleInertiaRequests::share()`. **Any Action that mutates DB/runtime state reflected in `configs()` must call `GetBootstrap::forgetVersion()` after the mutation** — otherwise the cached `bootstrap_version` never changes and clients see stale data forever. Keep `resources/js/types/index.d.ts` `Configs` in sync.
- **Providers** (Server/DNS/Storage/SourceControl): Interface + AbstractProvider pattern. Extend the abstract (e.g. `AbstractServerProvider`), implement `static id(): string`. Register via plugin classes in `app/Plugins/`.
- **Services** (database/webserver/PHP/etc.): extend `AbstractService`, implement `ServiceInterface`. Implement `static id()` and `static type()`. SSH scripts live in `resources/views/ssh/services/[service-name]/`.

## Laravel — Workflow

- Use `php artisan make:*` with `--no-interaction` for new files.
- **Don't use FormRequests.** All validation lives in Actions via `Validator::make()`.
- Return **422 (validation exception) for invalid input** — never 400.
- Wrap multi-step mutations in `DB::transaction()`. Critical for delete-then-recreate flows (e.g. DNS record sync).
- Null-check nullable relationships — `nullOnDelete()` foreign keys can be null at runtime.
- Let provider/service errors **bubble up**; don't silently swallow exceptions.
- Use `'encrypted:json'` cast for credentials and secrets on models.
- Enforce the project boundary in queries and policies.

## Migrations

- Schema changes and data transforms only. **Never** dispatch jobs, run SSH, make HTTP calls, or broadcast events from migrations.
- Combine related schema changes into a single migration file per feature.
- Never run `migrate:fresh` or other destructive DB commands.

## Frontend

- Inertia pages in `resources/js/pages/`. React components in `resources/js/components/`. Functional components + hooks.
- Forms: use the `useForm` helper, follow existing patterns. Navigation: `<Link>` or `router.visit()` — never raw `<a>` for internal routes.
- **Dialogs**: all modals/sheets use the centralized registry (`resources/js/components/dialogs/registry.ts`) opened via `useDialog()` — `dialog.<key>.open(props)`, or `dialog.confirm.open({...})` for simple confirms. Never nest `<Dialog>`/`<DialogTrigger>` inside a `DropdownMenuItem`. **Read the "Dialogs" section of `.github/instructions/frontend.instructions.md` before adding or changing any dialog.**
- Tailwind v4: `@import "tailwindcss"`, `@theme` for config, **`gap-*` over margins** for sibling spacing.
- Use Shadcn components and semantic tokens (`text-foreground`, `bg-background`, `text-muted-foreground`). Avoid hard-coded colors and custom CSS.
- **Compact UI / UX**: avoid unnecessary horizontal scrollbars on tables and cards. Constrain flexible content columns (`max-w-0`, `truncate`, `min-w-0`), specify widths on fixed columns, and use `table-fixed` layouts when column widths are defined.
- **React hooks**: include ALL dependencies in `useEffect` / `useMemo` / `useCallback` arrays. Return cleanup for timers/subscriptions. Stale closures from missing deps are a recurring bug here.
- **Dynamic forms**: backend ships `DynamicField` / `DynamicForm` DTOs (types: text, password, password-with-toggle, textarea, select, checkbox, alert, component). Render based on `field.type`. Don't hardcode provider-specific fields. Respect the field's value type — don't force everything to string.
- **Accessibility**: `<button>` for clickable elements, not `<span onClick>`. Add ARIA attributes when semantic HTML isn't enough.
- **TypeScript types**: keep `resources/js/types/*.d.ts` in sync with backend Resources. Enum status fields arrive as `{ status: string, status_color: string }`.
- Handle promise rejections from browser APIs (`navigator.clipboard.writeText`, etc.) and show error feedback.

## API

- Vito has no public API. Do not add API endpoints, API keys or API documentation. Machine endpoints (agent metrics, git and GitHub App webhooks) live in `app/Http/Controllers/Webhook/`.

## Security

- Every endpoint must be protected by appropriate middleware AND a Policy.
- Never log secrets, tokens, or credentials at any log level. Redact or hash if debugging.
- Never expose internal filesystem paths (CSR/private key paths, etc.) in responses.
- When editing credentials, merge updates server-side. Never round-trip existing secrets through the frontend.

## SSH

- All SSH goes through `app/Helpers/SSH.php` and the `SSH` facade. **No `exec()`, `shell_exec()`, `system()`, `passthru()`, or `Symfony\Component\Process\Process`.**
- SSH scripts for remote servers are Blade templates in `resources/views/ssh/`.
- Validate and sanitize any user input that lands in an SSH command or template.
- When running as a different user, `cd`/`sudo` must run as the target user, not the login user.

## Feature Notes

Short summaries of the former `docs/` files. Read the code for details.

### Queue Workers

- Horizon queues: `ssh` (2 workers, operations), `ssh-checks` (1 worker, lower priority; replica health, APP_DEBUG, PHP scans, service refreshes), `default` (1), and one each for certbot and the two storage-migration queues. Seven workers maximum.
- Env: `HORIZON_DEFAULT_MAX_PROCESSES=1`, `HORIZON_SSH_MAX_PROCESSES=2`, `HORIZON_SSH_CHECKS_MAX_PROCESSES=1`.
- SSH jobs on the same server are serialized by `UniqueQueue` locks. Lock lifetime and queue `retry_after` must exceed every job timeout, or a running job gets delivered twice.
- After changing queue config, run `php artisan config:cache` and `php artisan horizon:terminate`. Never clear the queues.

### Daily Health Reports

- `reports:health` runs hourly and stores snapshots, kept for 32 days. The 09:00 run (`config('app.timezone')`), or `reports:health --send`, queues one email per project owner/admin covering the last 24 hours. Regular members get none.
- Snapshots cover pending updates, disconnected servers, failed/stopped services and workers, failed site installs/resources, stale monitoring, and RAM/disk above 90%.
- A unique constraint and an atomic state change allow one delivery per user per day. Failed sends are not retried that day.

### pgBackRest Backups

- Physical PostgreSQL cluster backups written straight to S3: zstd, AES-256, continuous WAL archiving, point-in-time recovery. One per server. Needs an S3 storage provider and `wal_level` of `replica` or `logical`.
- Setup writes `/etc/pgbackrest/pgbackrest.conf` (S3 keys and passphrase) and `conf.d/zz-vito-pgbackrest.conf`. It restarts PostgreSQL once if archiving was off, then runs `stanza-create` and `check`. Changing storage credentials re-runs setup.
- Standard strategy: full on Sunday 02:00, differential Mon–Sat 02:00, incremental hourly, `retention-full=4`, `retention-diff=7`, verify Saturday 04:00, check daily 03:30. Custom strategy is hidden unless `PGBACKREST_STRATEGIES=standard,custom`.
- `backups:run` starts the most complete due type and catches up missed runs once. Runs are transient systemd units (`vito-pgbackrest-<file id>`) watched by `MonitorPgBackRestJob`. When a healthy, caught-up replica exists, the backup runs there with `--backup-standby=y`.
- `archive-push-queue-max` drops WAL instead of filling the disk. `backups:check-archiving` (every 15 minutes) raises alerts for failed archiving or dropped WAL.
- `CheckBackupHealth` alerts for all backup types: setup failed, last run failed, overdue (60-minute grace), archiving failing, WAL dropped, check/verify failed or missed. A reminder is sent every 24 hours and a "recovered" message when cleared.
- Restore to a new server: sized from backup info, same OS, PostgreSQL version and CPU architecture. Restores with `--archive-mode=off`, raises `max_*` settings to the source's values, and deletes the S3 credentials afterwards.
- Deleting the backup stops archiving (`archive_command='/bin/true'`) and keeps the S3 repository. The encryption passphrase can be revealed by admins and is required to restore.

### PostgreSQL Clusters and Replicas

- A cluster is a primary plus async hot standbys, built on pgBackRest. Replicas restore from the backup, then stream WAL from a replication slot. Same major version only.
- Private network preference: an existing shared network, then a Hetzner Cloud Network (same zone), then a WireGuard network (`DATABASE_REPLICATION_NETWORK_TYPES`). The default "Allow all" rule is removed.
- Setup steps, all safe to repeat: `/etc/hosts` aliases `vito-pg-<id>`, private `listen_addresses` (one primary restart), ufw 5432/8432 only from replica IPs, replication role and slot, `pg_hba.conf` block, per-cluster TLS CA (pgBackRest TLS server on 8432), `pgbackrest --type=standby restore`.
- Replica states: waiting for backup → pending → configuring → seeding → ready, or failed. Rebuild re-runs setup.
- `database-replicas:check` runs every minute and stores lag, latency, replay delay and slot WAL. Thresholds live in `config/database-replication.php`. Notifications are sent on degradation and recovery.
- Failover is manual and off by default (`DATABASE_REPLICATION_FAILOVER_ENABLED`). Steps: fence the old primary, promote, swap roles, re-point other replicas, move backups. Each step is checkpointed in `postgres_clusters.failover` and can be continued. A former primary that comes back is fenced again.
- Deleting a replica promotes it to an independent server and removes its slot, role and access. No data is deleted. `postgres-clusters:rotate-certificates` runs daily at 03:15.

### PostgreSQL Version Upgrades

- Moves every database to a new server on a newer major version with logical replication. The old server keeps serving until you press Finish.
- Two ways: copy all rows, or, for large databases, restore the pgBackRest backup to the slot's exact LSN, run `pg_upgradecluster --link`, then replicate only later changes.
- Not copied: unlogged tables, materialized view data, large objects, and DDL made after the copy starts. Tables without a primary key need `REPLICA IDENTITY FULL`.
- Prepares the old server with `wal_level=logical` (one restart), a `vito_upgrade_…` role, a `hostssl` rule, ufw 5432 from the new server only, and one publication per database. A WAL allowance (default a quarter of free disk) stops the upgrade before the disk fills.
- Finish: make the old server read-only, wait up to 10 minutes for subscriptions to catch up, copy sequences, drop subscriptions, publications, role and rules, then import databases and users. Pointing applications at the new server is manual.
- Cancel reverts the old server and keeps the new one.

### Storage Migrations

- Moves every object under a source S3 provider's path to a target S3 provider. S3 to S3 only. Source objects are never deleted.
- Cutover first: every `Backup.storage_id` on the source flips to the target when the migration starts. Existing `BackupFile` objects resolve through their migration item until it is `copied`, so restore and download keep working.
- Items live in a per-migration table `storage_migration_items_{id}` in a user-chosen scan database (MySQL, MariaDB or PostgreSQL on a managed server), reached through a dedicated `vito_migration_*` user. Only the migration rows live in Vito's own database.
- Jobs: `PrepareStorageMigration` on the `storage-migration-scan` queue (lists the target, then the source, saving the cursor per page); `CopyStorageMigrationItems` on `storage-migration` (self-chaining batches, 1–10 worker slots, skips by target listing size, then a verify pass).
- Invariants: item keys are frozen at creation; `mark*` transitions require `status = processing`; `size` and `copied_bytes` are separate; a stale `transfer_generation` stops old job chains.
- pgBackRest repositories are not copied; setup re-runs on the target instead. A migration cannot be deleted while a tracked backup file still lives only on the source.
