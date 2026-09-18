# Storage Migration ("S3 Migrate" for Vito)

Move backup objects from one storage provider to another — across buckets,
accounts, regions or S3-compatible services — without losing backup history
and without re-running every backup from scratch.

This spec is Vito's port of the ideas proven out in the standalone
`s3migrate` project (a dedicated bucket-to-bucket mirror engine). It borrows
that project's hard-won invariants and landmines, but the design itself is
**not** a copy of its engine — see [Relationship to s3migrate](#relationship-to-s3migrate)
for why a much smaller design is correct here.

## Why

Vito already lets a project configure multiple `StorageProvider` records
(S3, Dropbox, FTP, SFTP, Local — `app/StorageProviders/`) and point a
`Backup` at one of them. Today, switching a backup's storage after the fact
means either losing the old backup files or leaving them stranded on the old
provider forever — there's no supported way to actually move the underlying
objects. That matters whenever a user:

- switches S3-compatible providers or regions for cost/compliance reasons,
- consolidates several ad-hoc `StorageProvider` rows into one,
- or needs to retire a provider (the `2024_12_22_134221_deprecate_wasabi_storage_provider.php`
  migration is precedent for exactly this kind of forced move — it rewrote
  `storage_id`/`credentials` in place but never touched the actual objects,
  because at the time nothing could).

Storage Migration is the feature that finally moves the objects, safely.

## Relationship to s3migrate

**Revision note:** the first version of this section argued Vito could skip
s3migrate's entire discovery engine because "every object that needs
migrating is already named by a `BackupFile` row." That was wrong, and it
shipped a real bug: the first live migration against a bucket with ~2TB of
real data reported `Completed` after copying **zero bytes**, because that
bucket's objects were never written through Vito's own backup flow — there
were no matching `BackupFile` rows for them, so the DB-only item list came
back empty. Vito's DB is authoritative over *its own* backups, but not over
what's actually sitting in a bucket a `StorageProvider` points at — someone
can (and did) have a storage provider whose bucket holds data from other
sources entirely. A migration tool that doesn't look at the actual bucket
isn't a migration tool. The design below reflects the fix, not the original
plan.

`s3migrate` is a general-purpose product: given *any* two S3-compatible
buckets, it has to **discover** what's in each one (it doesn't control what
wrote them) by partitioning the key space and listing both sides in
parallel, then diffing. Vito's Storage Migration now does the same core
thing — `ListObjectsV2` over the source bucket under the configured path —
but scoped down from s3migrate's general-purpose engine in ways that are
still correct simplifications for this product:

- **One-shot discovery with overlapping copies.** The scanner lists the source
  bucket once, in pages, and saves discovered objects immediately. A separate
  copy queue starts alongside it and processes those rows while discovery
  continues. An empty batch waits five seconds while `scan_completed_at` is
  null; it never starts verification or completes the migration early.
- **Separate scan and copy workers.** Scanning uses the
  `storage-migration-scan` connection and supervisor; copying uses
  `storage-migration`. Both supervisors must be running. One worker in each
  supervisor is enough to overlap the phases. Listing remains sequential,
  without s3migrate's partitioning layer.
- **Still DB-linked where it can be.** Listed objects that happen to match
  an existing `BackupFile`'s computed path get their `backup_file_id` set
  (via a lookup map built from the same `matchingBackups()` query used for
  the cutover step) — this is what keeps Invariant 2
  (`BackupFile::currentStorage()`/`currentPath()`) working correctly for
  Vito's own tracked backups. Everything else discovered by the listing
  still gets migrated, just with `backup_file_id = null`.

What's still carried over from s3migrate, unchanged from the original
reasoning:

| Borrowed from s3migrate | Why it still applies here |
|---|---|
| Verified copy: hash-as-you-stream, explicit `Content-MD5`, never trust "it uploaded" without a checksum match | Silent corruption risk is identical whether you found the object via a scan or a `SELECT` |
| Manual multipart upload with a fixed part size (bypass Flysystem's `ObjectUploader`) for large files | Same aws-sdk-php landmine applies (see [Landmines](#landmines)) |
| Conditional status transitions (`pending`→`processing`→settled) | Same need to make retries/re-runs idempotent, just over `storage_migration_items` instead of `s3_migration_objects` |
| Skip-if-already-correct rule (size/checksum match on target ⇒ don't re-copy) | Makes retries and resumed runs cheap, same as there |
| A settled run summarizing into `Completed` / `Partial` / `Failed` / `Cancelled`, not just "done" | Permanent per-item failures should be visible, not hidden by a blanket success |
| Never auto-delete source data | Same "destructive step must be explicit" posture s3migrate documents for its own bucket mirroring |

What's **not** carried over, and why:

- **No plan/run split, no cron scheduling.** s3migrate's plans re-run on a
  schedule because a source bucket keeps changing underneath it. A Vito
  storage migration lists the bucket once and copies what it found —
  modeled as a single `storage_migrations` row that *is* the run.
- **No key-space partitioning.** s3migrate splits the source into N
  concurrently-scanned ranges for throughput. Vito lists the bucket as one
  linear paginated sequence (self-chained page by page within
  `PrepareStorageMigration`, not farmed out to parallel scan workers).
  Slower for a single very large bucket, much less coordination code.
- **Still no reconciliation-by-rescanning.** s3migrate's reconcile pass
  exists because objects it *skipped* during a partitioned scan never get a
  row at all, so it has to re-list to find out if a skip was wrong. Vito's
  listing gives every discovered object a row unconditionally — skip
  decisions happen later, per-row, during copy (see
  [End-to-end flow](#end-to-end-flow)) — so there's nothing invisible to
  reconcile. The verification pass that exists (re-`HeadObject`ing `copied`
  items) is checking for post-copy drift, not scan blind spots.
- **No independent `StorageTarget` model / no new provider type.** Vito's
  `StorageProvider` + `App\StorageProviders\S3` already hold everything
  needed (credentials, bucket, region, endpoint). Migration reads two
  existing `StorageProvider` rows (source, target); it does not introduce a
  parallel credentials model the way s3migrate's `StorageTarget` does.
- **No Filament-style dedicated admin surface.** This lives inside Vito's
  existing Inertia/React frontend, under the storage-providers area.

## Non-goals

- **Correction (see revision note above): this used to say a migration only
  moves backups Vito already knows about — that was the bug.** A migration
  copies *everything* under the source `StorageProvider`'s configured path,
  regardless of whether Vito has a `BackupFile` row for it, and always
  flips every tracked `Backup` on that source provider to the target (the
  cutover step) — there is no per-server or per-backup scoping. An earlier
  draft had an optional server/backup filter on the create form; it was
  removed (not just documented differently) once it became clear the
  filter only ever affected the cutover, never what got scanned/copied —
  bucket objects don't carry server/backup metadata for a filter to act on
  — and having a prominent "Server (optional)" field that looked like it
  scoped the data transfer, but didn't, was actively misleading. See
  [Key architecture decision](#key-architecture-decision-cutover-first) and
  [End-to-end flow](#end-to-end-flow).
- Not a live/ongoing mirror. Once a migration reaches a terminal state, it's
  done; a second migration is a new row, not a resumed schedule.
- Does not delete anything on the source provider. Cleanup is a manual,
  separate, explicit action a user takes later — never automatic, and never
  part of this feature's job graph.
- Does not attempt cross-provider-type migration (e.g. S3 → Dropbox). Both
  source and target must be `S3` provider rows (they may be different
  accounts, regions, buckets, or S3-compatible endpoints — that's the whole
  point — but the transport on both ends is the S3 API). Non-S3 providers
  are out of scope for v1; extending later just means the copy engine needs
  a per-provider-pair strategy instead of one S3↔S3 path.

## Terminology

- **Source / target** — two existing `StorageProvider` rows the migration
  copies objects between. Never servers, never databases.
- **Migration** — one `StorageMigration` row: a source, a target, a filter
  (which backups are in scope), and its own progress/status. Combines what
  s3migrate calls a "plan" and a "run" into one thing, per the reasoning
  above.
- **Item** — one `StorageMigrationItem` row: one `BackupFile`'s object,
  tracked independently through pending → processing → copied/skipped/failed.

## Key architecture decision: cutover-first

**A migration flips every affected `Backup.storage_id` to the target
immediately when the migration starts — before a single object has been
copied.** The background job then works through the backlog of
already-existing `BackupFile` objects, copying each one into the target
bucket.

This means:

- Any backup that runs *while* a migration is in progress lands directly on
  the target provider. There is no window where a new backup could still be
  written to the old, soon-to-be-abandoned storage.
- A `BackupFile` created before the migration started still resolves its
  object location through `BackupFile::path()`, which is driven by
  `$this->backup->storage` — i.e. once `storage_id` flips, `path()` for
  *pre-existing* files would resolve against the *new* provider, which is
  wrong until that specific file has actually been copied there. Migration
  items must therefore be resolved by their own frozen `source_key` /
  `target_key` columns (captured at item-creation time from the *old*
  storage), not by re-deriving `BackupFile::path()` after the cutover. This
  is the reason `StorageMigrationItem` freezes both keys explicitly instead
  of recomputing them from the live `Backup`/`BackupFile` relationship.
- Restoring a `BackupFile` that hasn't been migrated yet still works exactly
  as it does today, **as long as restore keeps resolving the object through
  the file's migration item (if one exists and isn't `copied` yet) instead
  of blindly trusting `Backup.storage`.** This is a real, load-bearing
  change to `BackupFile::path()`/restore call sites — see
  [Open questions](#open-questions--decisions-needed-before-implementation).

The alternative — leave `storage_id` pointing at source until 100% of
objects are copied, then flip — was rejected: it requires either freezing
new backups for the entire migration window (bad UX for a migration that
could take a while) or accepting that any backup taken mid-migration lands
on a provider you're trying to leave, which then needs its *own* follow-up
migration. Cutover-first accepts a small amount of extra bookkeeping
(resolve pre-migration files through their item row) in exchange for a
strictly simpler mental model: once you start a migration, the target is
authoritative for everything new, full stop.

## Data model

### `storage_migrations`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint pk | |
| `project_id` | unsignedBigInteger | matches `StorageProvider.project_id` scoping |
| `source_storage_id` | unsignedBigInteger | FK `storage_providers.id` |
| `target_storage_id` | unsignedBigInteger | FK `storage_providers.id`; must differ from source |
| `overwrite` | boolean default false | if a target object already exists with a mismatching size/checksum, overwrite it instead of failing the item |
| `status` | string | `pending, scanning, running, paused, verifying, completed, partial, failed, cancelled` |
| `items_total` | integer default 0 | |
| `items_copied` | integer default 0 | |
| `items_skipped` | integer default 0 | already correct on target, not re-copied |
| `items_failed` | integer default 0 | permanently failed (exhausted retries) |
| `bytes_total` | bigint default 0 | |
| `bytes_copied` | bigint default 0 | |
| `database_id` | unsignedBigInteger nullable | `databases.id` of the scan database holding this migration's items — see [Scan database](#scan-database) |
| `database_user_id` | unsignedBigInteger nullable | `database_users.id` of the dedicated user Vito created for this migration |
| `firewall_rule_id` | unsignedBigInteger nullable | allow rule for the Vito server on the database port, when the scan database is on another server with a firewall |
| `source_fingerprint` | string nullable | hash of source credentials at start — mirrors s3migrate's drift detection |
| `target_fingerprint` | string nullable | same, for target |
| `error` | text nullable | set when `status = failed` |
| `started_at` / `finished_at` | timestamp nullable | |
| `timestamps`, `softDeletes` | | |

### `storage_migration_items_{id}`

One table per migration, created in the migration's scan database (not Vito's
own database) — see [Scan database](#scan-database).

| Column | Type | Notes |
|---|---|---|
| `id` | bigint pk | |
| `backup_file_id` | unsignedBigInteger nullable, indexed | `backup_files.id`; **null for objects discovered by the bucket listing that don't match a known `BackupFile`** — most objects, for a bucket that wasn't populated entirely through Vito's own backup flow |
| `source_key` | string(1024) | object key on the source bucket, frozen at item-creation time |
| `source_key_hash` | char(40) unique | sha1 of `source_key`; S3 keys can be 1,024 bytes, too long for a MySQL unique index |
| `target_key` | string(1024) | object key on the target bucket |
| `size` | bigint nullable | expected size, from the source `HeadObject` |
| `copied_bytes` | bigint nullable | actual bytes written — kept distinct from `size` on purpose (a s3migrate invariant: never conflate expected vs. actual) |
| `checksum` | string nullable | ETag/MD5 used for the skip-rule and post-copy verification |
| `status` | string | `pending, processing, copied, skipped, failed` |
| `attempts` | integer default 0 | |
| `error` | text nullable | |
| `worker_slot` | unsignedSmallInteger nullable | transfer worker that claimed the item |
| `timestamps` | | |
| index | `(status, id)` | claims, verification chunks and processing counts read one status in id order |

Deduplication is on `source_key_hash`, not `backup_file_id` — most rows have a
null `backup_file_id`, and NULLs don't collide under a unique index, so that
would never have deduplicated bulk-discovered rows on a re-scan.

## End-to-end flow

1. **Create.** User picks a source `StorageProvider` and a target
   `StorageProvider` (must differ, must both be `provider = 's3'` for v1).
   No further scoping — a migration always covers everything on the
   source. `ManageStorageMigration::create()` validates (source ≠ target,
   both resolve to `App\StorageProviders\S3`, both owned by the requesting
   user, source read-access and target write-access verified via
   `canRead()`/`connect()` — see [Connection testing](#connection-testing)),
   sets up access to the selected scan database
   (`ManageStorageMigrationDatabase::connect()` — see [Scan database](#scan-database)),
   creates the `StorageMigration` row (`status = pending`), and dispatches
   `PrepareStorageMigration`. The job waits until the scan database accepts
   connections, then creates the migration's items table.

2. **Cutover.** `PrepareStorageMigration::handle()` first resolves every
   `Backup` row in the project pointed at the source storage
   (`matchingBackups()`) and flips each `storage_id` to the target inside a
   `DB::transaction()` — this is the cutover described above. This runs
   before any listing, so new backups start landing on the target
   immediately regardless of how long the scan below takes.

3. **Target listing, then scan.** Status flips to `scanning`. The job first
   lists the target under its configured path into a per-migration table,
   `storage_migration_targets_{id}` (`key_hash` → `size`), saving
   `target_cursor` after every page so a pause or restart resumes the listing,
   and records `target_scan_completed_at` when it finishes. Copy workers wait
   for this listing. With it they never send a request per object to the
   target: providers such as Backblaze B2 bill and cap `HeadObject` as Class B
   transactions, and one request per object used up the account's daily cap,
   which also broke pgBackRest archiving to the same account. A
   `ListObjectsV2` page covers 1,000 objects in one request. Migrations whose
   scan finished before this listing existed fall back to `HeadObject`.

   Then the job lists the *entire* source bucket under the source `StorageProvider`'s configured path
   (`ListObjectsV2`, paginated via `S3ObjectCopier::listPage()`,
   `list_page_size` keys per page, default 1,000), looping page by page
   within this one job execution (see [Jobs & queues](#jobs--queues) for
   why this is sequential rather than self-chained/partitioned). For every
   listed object:
   - Computes `target_key` by re-rooting the object's path from the
     source's prefix onto the target's prefix (`targetKeyFor()`) — plain
     relative-path remapping, not s3migrate's full `source_prefix`/
     `target_prefix` plan configuration, since Vito reuses each
     `StorageProvider`'s own `credentials['path']` for this instead of
     introducing new fields.
   - Looks up whether this exact key matches a `BackupFile::path()` for one
     of the backups resolved in step 2 (a map built once, before the scan
     starts) — if so, the item's `backup_file_id` is set, preserving
     Invariant 2 for Vito's own tracked backups. Otherwise `backup_file_id`
     is `null`.
   - `insertOrIgnore`s a batch of `storage_migration_items` rows per page
     (idempotent against a re-scan, via the `(storage_migration_id,
     source_key)` unique index), and updates `items_total`/`bytes_total` +
     broadcasts after every page.
   - Checks the migration's live status before fetching each page and
     stops cleanly (without overwriting a user's choice) if it's been
     paused or cancelled mid-scan.

   The first copy job is dispatched as scanning starts. It consumes committed
   pages immediately and waits between pages if it catches up. Once listing
   finishes, the scanner records `scan_completed_at` and switches to `running`.
   The copy worker starts verification only after discovery is complete and
   no pending or processing items remain, including for an empty bucket.

4. **Copy.** `CopyStorageMigrationItems` — one job per migration,
   guaranteed single-flight by `UniqueQueue` (see [Jobs & queues](#jobs--queues)
   for why no multi-worker claim locking is needed), but **not** one
   long-lived process for the whole migration: each invocation claims and
   processes exactly one batch of `pending` items, then re-dispatches a
   fresh instance of itself if more are left (see
   [Jobs & queues](#jobs--queues) for why). For each item in a batch:
   - Looks the target key up in the target listing from step 3. If it
     already exists with the same size, mark `skipped` — no bytes move. The
     source size comes from the scan, so the source isn't asked either.
   - If it exists but mismatches and `overwrite` is false, mark `failed`
     with a clear "target already occupied" error (does not retry — this is
     a configuration problem, not a transient one).
   - Otherwise stream `GetObject` (source) → `PutObject`/multipart (target)
     through a hashing buffer, verify the checksum, mark `copied`, record
     `copied_bytes`.
   - Transient errors (timeouts, throttling, 5xx) go back to `pending` and
     are retried within the same job, up to `max_attempts`; permanent
     errors (403, 404 on source, checksum mismatch after a full write) mark
     `failed` immediately, no retry. **v1 does not implement s3migrate's
     timed backoff schedule (`[30, 120, 600]`)** — a retried item is simply
     eligible for the next batch claim, with per-item network latency as
     the only informal spacing. `max_attempts` still bounds how many times
     a flaky item is retried before it's marked permanently `failed`. A
     real delay (e.g. a `retry_after` column, or re-dispatching the job
     with `->delay()`) is a reasonable v2 addition if a target endpoint
     turns out to need real backoff under sustained throttling — not added
     now since it's unverified need, not a known problem.
   - After each batch settles, the job updates the parent
     `StorageMigration` counters and broadcasts.

5. **Reconcile.** Once a `CopyStorageMigrationItems` invocation claims an
   empty batch (no `pending` items left), it starts a verification pass:
   status flips to `verifying`, and — again self-chained rather than one
   long loop, this time in chunks of `batch_size × 40` ordered by `id` with
   the cursor and running repaired-count passed through the job's own
   constructor args from one dispatch to the next — lists the target again
   (up to 50 pages per job, the continuation token passed to the next job) and
   compares every `copied` item's target key and size with that listing, to
   catch anything that silently vanished or changed between copy and now
   (bucket lifecycle rule, concurrent deletion, etc.). Anything that fails
   this check flips back to `pending`, status returns to `running`, and
   copying resumes for just those rows. Capped like s3migrate at a small
   fixed number of passes (`max_verify_passes`).

6. **Settle.** `items_failed = 0` and everything accounted for ⇒
   `completed`. Any permanent failures remain ⇒ `partial` — the migration
   stops driving retries automatically, but the user can re-trigger a retry
   action that requeues just the `failed` items (an `upsert`, not
   `insertOrIgnore`, per the same reasoning s3migrate documents for its own
   verification pass). A hard failure before any items were built (e.g. bad
   target credentials caught at start) ⇒ `failed`. User-triggered abort ⇒
   `cancelled`; in-flight claimed-but-unfinished items are released back to
   `pending` so a cancel never leaves an item stuck in `processing`.

Source objects are **never** deleted by any of the above. A completed
migration just means the target is now a verified, complete copy and is
what `Backup.storage_id` already points at.

## Copy engine

A single-purpose class, deliberately kept free of any DB/queue knowledge so
it's independently testable — same separation of concerns s3migrate uses
for `S3MigrationService`:

```php
namespace App\Support;

class S3ObjectCopier
{
    public function head(S3Client $client, string $bucket, string $key): ?array;
    public function copy(S3Client $source, string $sourceBucket, string $sourceKey, S3Client $target, string $targetBucket, string $targetKey): StorageMigrationCopyResult;
}
```

- `S3Client` instances are built via the config `App\StorageProviders\S3`
  already assembles in `buildClientConfig()`/`getClient()`. No change to
  that class is needed: its constructor already takes any `StorageProvider`
  instance (`AbstractStorageProvider::__construct(StorageProvider $storageProvider)`),
  so the copier just instantiates one handler per side —
  `(new S3($sourceProvider))->buildClientConfig()->getClient()` and the same
  for the target — exactly how `StorageProvider::provider()` already does it
  for a single provider.
- Threshold-based routing mirrors s3migrate's config:
  `multipart_threshold` (objects at or above this size use `copyLarge`),
  `part_size` (fixed, so the composite ETag stays predictable).
- No SSH, no remote server involved at all. This is a deliberate departure
  from how *new* backups are produced (which must run on the managed server
  because that's where `mysqldump`/`tar` generate the bytes). Migrating an
  object that already exists in S3 has no reason to hop through any
  particular managed server's disk or network — Vito's own queue worker
  talks to both S3 endpoints directly, exactly like s3migrate does.

## Connection testing

s3migrate's `StorageTarget::probe()` does a real write+read+delete
healthcheck against the bucket — not just "can I list buckets," which is
all Vito's `App\StorageProviders\S3::connect()` checked before this
feature (a plain `listBuckets()` call). That's a meaningfully weaker test:
it requires `s3:ListAllMyBuckets`, a permission a properly-scoped,
single-bucket IAM policy often doesn't grant at all — so the old check
could reject perfectly valid, correctly-scoped credentials, and would
never catch a bucket that's listable but not actually writable.

`S3::connect()` now does the same thing s3migrate does: `PutObject` a
small `.vito-connection-test-<random>` object under the provider's
configured path, `GetObject` it back and verify the bytes round-tripped,
then `DeleteObject` it in a `finally` block (best-effort — a delete
failure doesn't mask the real put/get result). This is a **global**
change to the `S3` storage provider handler, not something scoped to
migrations: it's what runs whenever any S3 `StorageProvider` is connected
or edited (`CreateStorageProvider`, `EditStorageProvider`), so Backups and
anything else that resolves an S3 storage get the stronger guarantee too,
not just Storage Migration.

**`GetObject`-specific `AccessDenied`/`AllAccessDisabled` after a
successful `PutObject` does not fail the probe.** This was found live,
against a real Hetzner Object Storage credential: `PutObject` succeeded,
the immediate `GetObject` on that same key came back `AccessDenied`. A
credential that can write but not read back is a legitimate, common,
deliberately-scoped setup for backup destinations (least-privilege:
an agent that can only upload can't be used to exfiltrate or delete
existing backups if compromised) — rejecting it outright would be a
regression versus the old `listBuckets()`-only check for anyone actually
using that pattern. So the rule is: `PutObject` failing is always a hard
failure (can't write at all → broken); `DeleteObject` failing is
swallowed (best-effort cleanup only); `GetObject` failing is a hard
failure *unless* the AWS error code is specifically `AccessDenied` or
`AllAccessDisabled`, in which case the credential is accepted as
write-verified but read-unverified. Any other `GetObject` error (wrong
bucket, `NoSuchKey`, etc.) still fails the probe — only the
permission-scoping case is forgiven.

**Follow-up, also found live, against the same real bucket:** the
predicted false-rejection-in-reverse happened almost immediately.
`ManageStorageMigration::create()` originally ran the full write-capable
`connect()` probe against *both* source and target — but a migration
source is only ever read from (`GetObject`/`ListObjectsV2`); it never
needs to write anything. Against a real Hetzner bucket where the
credential's write access was scoped to specific per-camera prefixes
(`s3_cam_10/...`) rather than the bucket root, the source failed
`connect()`'s write-probe (couldn't `PutObject` a test key at the
configured root path) even though `ListObjectsV2`/`GetObject` against
that exact bucket worked fine — a source that would have migrated
correctly was rejected before it ever got the chance.

Fixed by splitting the check: `App\StorageProviders\S3::canRead(array $credentials): bool`
does a `ListObjectsV2` with `MaxKeys: 1` under the configured prefix — no
write attempted at all — and `ManageStorageMigration::validate()` now
uses `canRead()` for the **source** and the full write-capable `connect()`
only for the **target**. This matches the actual mechanical requirement
(read from source, write to target) instead of demanding symmetric
read+write capability neither direction actually needs.

Three places consume this:

1. **`ManageStorageMigration::create()`** calls `canRead()` on the source
   and `connect()` on the target before creating the migration row — i.e.
   before the cutover-first flip touches a single `Backup.storage_id`.
   This is the actual motivation: catching a target that *looks* connected
   (was validated once, when it was first added) but has since lost write
   access, or was never actually tested against this specific bucket/path,
   before committing backups to it — without rejecting a perfectly usable,
   narrowly-scoped source in the process.
2. **A user-triggered "Test connection" action**, mirroring s3migrate's
   testability from its admin panel: `POST /settings/storage-providers/{storageProvider}/test`
   (`StorageProviderController::test()`, optional `?mode=read` query param
   to run `canRead()` instead of `connect()`) returns `{connected: bool}`
   and is wired into the Storage Providers list (`TestConnection` dropdown
   item, always write-mode — that page has no source/target concept) and
   the Storage Migration create form (a "Test connection" button next to
   each picker, `mode="read"` for source and `mode="write"` for target,
   disabled until a provider is selected).
3. **The jobs themselves never need more than this either.**
   `PrepareStorageMigration`'s scan only calls `ListObjectsV2` against the
   source; `CopyStorageMigrationItems` calls `GetObject` against the source
   and `HeadObject`/`PutObject`/multipart against the target. The
   asymmetric validation checks exactly the capability each side actually
   exercises, not a stricter or looser bar than reality.

## Jobs & queues

**Two** Horizon queues, not one — split after the discovery fix because the
scan and copy phases have very different runtime profiles and need
different `retry_after`/timeout values on their own dedicated queue
connections (`config/queue.php`), each with its own supervisor block in
`config/horizon.php`. Both are kept separate from `ssh` because neither
touches a managed server and shouldn't compete with backup/SSH work for
worker slots.

- **`storage-migration-scan`** — `PrepareStorageMigration` only.
  `ShouldQueue`, `use Queueable, UniqueQueue;`, lock key
  `"storage-migration-{id}"`. This job can legitimately run for a long time
  (listing a bucket with millions of objects, one page at a time, entirely
  synchronously within a single execution — see
  [Relationship to s3migrate](#relationship-to-s3migrate) for why this is
  sequential rather than self-chained). `scan_timeout` defaults to 21,600s
  (6h); the queue connection's `retry_after` is `scan_timeout + 60` so a
  still-running scan is never treated as lost and re-delivered to a second
  worker. **A genuinely stuck/crashed scan won't be retried for up to 6
  hours** — that's the accepted trade-off for a single-pass, single-job
  design; there's no cursor persistence or watchdog to resume a scan that
  died partway (unlike s3migrate's `continueActive()`). Revisit if this
  turns out to matter in practice.
- **`storage-migration`** — `CopyStorageMigrationItems`, both its copy and
  verify phases. Same trait, lock key `"storage-migration-copy-{id}"`.
  **Deliberately not a multi-worker batch pool with `FOR UPDATE SKIP
  LOCKED` claiming**, unlike s3migrate's `CopyS3MigrationObjects`.
  s3migrate needs that because many independent workers race over one
  shared queue of objects; Vito doesn't have that problem —
  `UniqueQueue`'s `Cache::lock()` (the same mechanism `RunJob` uses
  per-backup) already guarantees only one `CopyStorageMigrationItems` job
  runs for a given migration at a time.

  **This job is self-chaining, not an internal loop** — a real change from
  the first version, made for the same 2TB-scale incident that forced the
  discovery fix: a single job holding a worker slot for the entire
  duration of a multi-hour, multi-terabyte transfer is fragile (one crash
  loses all progress in that process, `job_timeout` has to be sized for
  the *whole migration* rather than one batch, no incremental recovery).
  Each invocation now does exactly **one unit of work** — one batch of
  `pending` items copied, or one chunk of `copied` items re-verified — then
  either dispatches `new self($this->storageMigration, ...)` with whatever
  cursor/pass state the next invocation needs (passed through the job's
  own constructor args, not persisted to a DB column — same self-chaining
  shape s3migrate uses for `ScanS3MigrationPartition`, and subject to the
  same landmine: the *cursor itself* is what makes each dispatch a distinct
  unit of work, since this job doesn't use `ShouldBeUnique` at all — dedup
  is handled entirely by `UniqueQueue`'s fixed lock key, which is safe here
  specifically because dispatches are sequential, never concurrent), or
  calls `settle()` once there's truly nothing left to do. `job_timeout`
  only has to cover one batch/chunk (default 1,800s), not the whole
  migration.

Both jobs follow the existing `failed()` handler convention: flip the
owning row's status appropriately and notify via `Notifier::send()`.
Per-item errors are **not** sent through `ServerLog::log()` — that helper
requires a `Server`, and a migration can span backups belonging to several
servers in a project. Errors live on `storage_migration_items.error` /
`storage_migrations.error` instead; this is a deliberate divergence from
the backup feature's per-server logging.

## API surface

Vito never puts the current project in the URL — every project-scoped
controller reads it off the session via the `user()` helper's
`currentProject` (see `BackupController::index()`: `user()->currentProject`,
no `{project}` route parameter anywhere in the codebase). Storage Migration
follows that exactly, not the `projects/{project}/...` shape an earlier
draft of this doc assumed:

`#[Prefix('storage-migrations')]`, `#[Middleware(['auth', 'has-project'])]`:

- `GET /storage-migrations` (name `storage-migrations`) — list, Inertia
  page, `StorageMigrationTable::make(user()->currentProject->storageMigrations())`.
- `POST /storage-migrations` (name `storage-migrations.store`) — create +
  start, `ManageStorageMigration::create(user()->currentProject, user(), $request->all())`.
- `GET /storage-migrations/{storageMigration}` (name `storage-migrations.show`)
  — JSON progress (polled or realtime), including a paginated `items`
  collection for the per-file table.
- `POST /storage-migrations/{storageMigration}/pause` / `/resume` / `/cancel` / `/retry-failed`.
- `GET /storage-migrations/{storageMigration}/items/{item}/preview?side=source|target`
  (name `storage-migrations.items.preview`) — **admin-only**
  (`abort_unless(user()->isAdmin(), 403)`, the global `is_admin` flag, not
  a project role), returns `{url}`: a 15-minute presigned `GetObject` URL
  (`App\StorageProviders\S3::presignedUrl()`) for that item's source or
  target key. Added so an admin can actually open/view a file to spot-check
  a migration, rather than trusting the key string alone — plain object
  keys aren't openable URLs, and most buckets aren't public, so a real
  preview needs a signed link, not just the full `https://endpoint/bucket/key`
  path pasted together.
- `DELETE /storage-migrations/{storageMigration}` — only once terminal;
  does not touch backups or objects, just the migration's own bookkeeping
  rows.

Every `{storageMigration}`-scoped route must `abort_unless($storageMigration->project_id === user()->currentProject->id, 404)` before authorizing, matching the `abort_unless($backup->server_id === $server->id, 404)` guard every backup route uses — route-model-binding alone doesn't confirm the resource belongs to the caller's current project. The preview route looks the item up inside the migration's own items table (`$storageMigration->items()->findOrFail($item)`), so an item id from another migration cannot resolve.

`StorageMigrationPolicy` (`HasRolePolicies` trait, same as `BackupPolicy`):
`viewAny`/`view` via project read access; `create`/`update`/`delete` via
`hasWriteAccess($user, $project)`. Storage-provider ownership (source and
target must belong to the requesting user) is checked inside
`ManageStorageMigration`'s own validation, mirroring how
`RestoreBackup::validate()` checks cross-project/compatibility rules that
go beyond the coarse-grained policy gate.

## Realtime

Same convention as backups: `SocketEventDTO(projectId, 'storage-migration.updated', StorageMigrationResource)`
dispatched after each batch settles (not per item — avoids flooding the
socket the way a thousand-item migration would if it broadcast per row).
The migration summary itself (counts, status, bytes) updates live via the
existing `useRealtimeRecord` hook, same as `backups/files.tsx` does for a
single `Backup` — no extra endpoint needed.

Individual `storage_migration_items` are **not** broadcast at all (that's
the whole reason for batching the parent broadcast in the first place).
The item table on the progress page therefore can't use `useRealtime`'s
created/updated/deleted socket handling the way `backups/files.tsx` does
for `BackupFile` rows — there's nothing to listen for at the item level.
Instead, the same `storage-migration.updated` event that refreshes the
summary also triggers `router.reload({ only: ['items', 'storageMigration'] })`
— an ordinary Inertia partial reload, not a new polling endpoint. This
fires once per batch (every `batch_size` items, i.e. a handful of times
over a migration's lifetime), which is cheap enough not to need a
dedicated JSON endpoint the way the `Logs` component's 5-second poll does
for a continuously-changing log stream.

## Frontend

- `resources/js/pages/storage-migrations/index.tsx` — list, `VitoTable`,
  `+ Migrate` button opening a `Sheet` (`create-storage-migration.tsx`)
  reusing `StorageProviderSelect` twice — source, and target filtered to
  exclude whatever source is currently selected — plus a "Test connection"
  button per picker (`mode="read"` for source, `mode="write"` for target)
  and an overwrite checkbox. No scope picker — see
  [Decisions confirmed](#decisions-confirmed) #2.
- `resources/js/pages/storage-migrations/show.tsx` — progress view: counts
  (`items_copied` / `items_total`, bytes, a simple progress bar), an
  `item-columns.tsx` table of `StorageMigrationItem`s with status badges,
  per-row admin-only "Source"/"Target" preview buttons (fetch a presigned
  URL from `storage-migrations.items.preview`, open in a new tab — hidden
  entirely for non-admins via `usePage().props.auth.user.is_admin`), and a
  "retry failed" action, driven by `useRealtimeRecord`.
- Reuses `TableSkeleton`, `DataTable`, `CopyableBadge` and the existing
  dropdown-action pattern (`components/backup-actions.tsx`) for
  pause/resume/cancel/retry.

## Invariants

Numbered the way s3migrate's `ai-context.md` does — break these and either
data goes missing or a migration silently corrupts backup restore paths:

1. `StorageMigrationItem.source_key`/`target_key` are frozen at item-creation
   time, computed against the pre-cutover storage. Never re-derive an
   item's object location from the live `Backup`/`BackupFile` relationship
   after the cutover has happened — `Backup.storage_id` no longer points at
   where that specific object actually lives until its item is `copied`.
2. `BackupFile::path()` / any restore code path must consult an in-flight
   migration item for that file (if one exists and isn't `copied`) before
   falling back to the live `Backup.storage`. Skipping this makes restoring
   a not-yet-migrated backup silently try to fetch from the wrong bucket.
3. `CopyStorageMigrationItems` must keep going through `UniqueQueue`'s
   `Cache::lock()` (never dispatched or run bypassing it). That lock is the
   only thing standing in for s3migrate's `FOR UPDATE SKIP LOCKED` batch
   claiming — it's sufficient only because it guarantees single-flight
   execution per migration; if this job is ever changed to run multiple
   workers per migration in parallel, proper row-level claim locking
   becomes necessary again.
4. `markCopied`/`markSkipped`/`markFailed` must be conditional on
   `status = processing`, same as s3migrate's `S3MigrationObject` — this is
   what makes double-claims harmless instead of double-counted.
5. Retrying a `failed` item is an `upsert`/explicit status reset, never
   `insertOrIgnore` — the row already exists and settled once.
6. `size` (expected, from the source `HeadObject`) and `copied_bytes`
   (actual bytes written) stay separate columns; never overwrite one with
   the other.
7. Source objects are never deleted by any job in this feature, under any
   status, ever. Deletion is a separate, explicit, manual action outside
   this feature's scope.

## Landmines

Carried forward from `s3migrate`'s `docs/ai-context.md`, all of which apply
identically here because the copy engine is the same aws-sdk-php surface:

- **`add_content_md5` deprecated path** — don't set that S3Client option;
  set `ContentMD5` on the `PutObject`/`UploadPart` request directly, or some
  non-AWS S3-compatible endpoints will reject the CRC32 fallback it
  silently switches to.
- **`Aws\HashingStream` completion-callback timing** — hash the buffered
  bytes yourself rather than trusting the stream's completion callback for
  anything about to be asserted on.
- **Flysystem's `ObjectUploader` won't give a verifiable multipart upload**
  (it picks its own part size) — drive `S3Client` directly for anything
  routed through `copyLarge()`.
- **A settings/config value with no matching default silently disables a
  path** (`(int) null === 0`, so a `size < threshold` check fails closed).
  Every new tunable here (`multipart_threshold`, `part_size`, backoff
  schedule) needs an explicit default in `config/storage-migration.php`,
  not just a nullable DB override.

Vito-specific landmines new to this feature (not present in s3migrate):

- **`ServerLog::log()` requires a `Server`.** A migration is project-scoped
  and can span multiple servers — don't try to force migration errors
  through it; use the columns on `storage_migrations`/`storage_migration_items`.
- **`StorageProvider` can be global (`project_id = null`) or project-scoped.**
  Source and target don't have to share the same scope — a migration from a
  global provider to a project-scoped one (or vice versa) is valid and must
  not be rejected by an overly strict "same project" check.
- **Cutover happens before any bytes move.** Anything that reads
  `Backup.storage` to decide where a *specific existing* file lives (not
  just "where do new backups go") is a latent bug unless it accounts for
  in-flight migration items — see Invariant 2.

## Decisions confirmed

1. **Cutover-first.** Confirmed. `Backup.storage_id` flips to the target the
   moment a migration starts; `BackupFile::path()` and restore call sites
   must consult an in-flight migration item before falling back to the live
   `Backup.storage` (Invariant 2).
2. **Scope.** Revised twice. Originally: every backup on the source
   `StorageProvider`, narrowable to one server or one backup. Revised after
   the 2TB incident (see [Relationship to s3migrate](#relationship-to-s3migrate)):
   scope became the whole bucket under the source's path, with the
   server/backup filter left in place but only affecting the cutover step.
   Revised again immediately after, once a user pointed out a "Server
   (optional)" field that visually looked like it scoped the data transfer
   — but didn't — was actively misleading: the filter was removed outright,
   not just reworded. `server_id`/`backup_id` are gone from the schema,
   the model, the action, and the create form. A migration now always
   flips every tracked `Backup` on the source provider and always copies
   everything found under its path — no scoping control at all.
3. **Source cleanup.** Confirmed out of scope for v1 — no delete action of
   any kind ships with this feature. Source objects are left in place
   indefinitely; cleanup is a manual, separate concern outside this feature.
4. **Non-S3 providers.** Out of scope for v1. The create form's source and
   target `StorageProviderSelect`s filter to `provider === 's3'` client-side
   (via that component's new `filter` prop) rather than only catching it at
   server-side validation time. Filtering the option out is simpler than
   disabling-with-tooltip and was chosen over it for v1; revisit if users
   need to *see* why a provider is unavailable rather than just not seeing
   it.

## Implementation phases

1. **Schema + models** — `storage_migrations`/`storage_migration_items`
   migration (combined, per convention), `StorageMigration` and
   `StorageMigrationItem` models, `StorageMigrationPolicy`.
2. **Copy engine** — `App\Support\StorageMigration\S3ObjectCopier`, the
   small extension to `App\StorageProviders\S3` needed to build a client for
   an arbitrary `StorageProvider` instance, `config/storage-migration.php`.
3. **Orchestration** — `ManageStorageMigration` action,
   `PrepareStorageMigration`/`CopyStorageMigrationItems` jobs, Horizon queue
   + supervisor wiring, retry/backoff, status transitions, the
   `BackupFile::path()`/restore-path change for Invariant 2.
4. **API** — `StorageMigrationController`, routes, `StorageMigrationResource`,
   `BroadcastStorageMigrationUpdate` (mirrors `BroadcastBackupUpdate`).
5. **Frontend** — list + create sheet + progress/show page, reusing
   `StorageProviderSelect`, `DataTable`, `useRealtimeRecord`.
6. **Verification** — no automated test suite exists in this repo today;
   verify manually against two real (or MinIO-hosted) S3-compatible buckets
   covering: small file, large/multipart file, already-correct target
   (skip path), pause/resume, cancel mid-copy, permanent failure + retry,
   restoring a `BackupFile` mid-migration (before its item is `copied`).

## Overlap regression check

Run `php tests/Feature/StorageMigrationOverlapTest.php`. This standalone check
uses an in-memory SQLite database, a fake queue, and AWS mock responses. It
verifies copying before discovery completes, waiting on empty discovery,
separate queue connections, and preserving pause/cancel states. It also checks
that scanning waits for scan database access, that a failed firewall rule fails
the migration, the scan database connection settings, restore path resolution
(including backup files the scan has not listed yet), skipping pgBackRest
repositories, stopping superseded transfer workers, blocked deletes, retrying a
failed scan
through a migration item, and that deleting a migration drops its items table.
Migrations without a scan database keep their items table on the default
connection, which is what the check uses. It does not contact real S3 buckets,
database servers or Horizon.

## Independent phase controls

The actions menu provides **Pause scanning / Resume scanning** and **Pause
transfers / Resume transfers**. Scanning controls disappear once discovery is
complete. Scan and transfer pause flags are independent: pausing discovery
leaves already-discovered items available for copying, and pausing transfers
lets discovery keep populating the item list. Verification follows the transfer
pause state. Pauses take effect after the current listing page or object.

Each listing page commits its discovered rows, counters and next continuation
token in one transaction. Resuming discovery starts at that saved token. Legacy
runs without a token re-list idempotently; existing rows do not inflate totals.
The token is internal and is not returned by the resource. The existing pause
and resume routes accept `phase=scan`, `phase=transfer`, or `phase=all` (default
for older clients). Finished phases return a validation error.

Apply the phase-controls migration and restart queue workers when deploying.
The standalone regression check covers independent controls and a pause/resume
between two listing pages using mock responses.

## Per-migration transfer workers

Each migration detail page has a **Transfer workers for this migration** setting
(default 1, maximum 10). Saving dispatches the requested worker slots without
restarting Horizon. Increasing the limit starts additional slots; lowering it
lets in-flight objects finish and releases unstarted files. Shared Horizon copy
worker capacity still caps total concurrency across migrations. Raise and apply
the global copy worker capacity in queue settings if that ceiling is too low.
Discovery remains sequential within each migration.

Workers hold separate slot locks and claim files under a short shared claim
lock. Claims retain their slot, so one worker cannot reset or settle another
worker's work. Object status and progress counters update together, once per
file, without rescanning millions of rows after every batch. Verification waits
for discovery and all pending/processing files to settle and is driven by slot
zero.

The detail page polls every five seconds as a fallback to socket updates, shows
assigned files and waiting states, and displays sub-0.01% progress instead of
rounding it to zero. Byte counters reflect finished objects, not bytes currently
in flight. Apply the worker-count migration and restart Horizon on deployment.

## Scan database

Scan data no longer lives in Vito's own database. Vito defaults to SQLite, and
a single migration can discover millions of objects while one scan worker and
up to ten transfer workers write to the item list at the same time. Every
migration now keeps its items in a database on a server Vito already manages.

The **Migrate storage** sheet asks for a scan database server from the current
project and a database on it. The database picker has the usual create button,
so a new database can be made in place. MySQL, MariaDB and PostgreSQL are
supported. The Vito server needs the matching `pdo_mysql` or `pdo_pgsql` PHP
extension; the create form rejects the server otherwise.

`ManageStorageMigrationDatabase::connect()` then:

1. Creates a database user named `vito_migration_<random>` with a random
   password and admin permission on the selected database only.
2. For a server other than the Vito server itself, asks the server over SSH
   which address Vito connects from (the first field of `$SSH_CLIENT`). That
   address is what the database server will see, even when Vito runs behind
   NAT or a proxy, so it becomes the user's host and the firewall source. Vito
   then enables remote access on the database service when it is off (this
   restarts the service) and allows that address on the database port unless a
   matching allow rule already exists. If the address can't be determined, the
   form shows a validation error.
3. Stores `database_id`, `database_user_id` and `firewall_rule_id` on the
   migration. If enabling access fails, the new database user is removed.

Both jobs call `ManageStorageMigrationDatabase::ready()` before touching items.
While remote access or the firewall rule is still being applied, the job
dispatches itself again after `scan_wait_delay` seconds. A failed database
service, networking change or firewall rule fails the migration. Once access is
live, the job creates `storage_migration_items_{id}` under a cache lock.

`StorageMigration::items()` returns a query bound to that connection and table,
so every item read and write goes through it. Writes that touch both the items
table and the `storage_migrations` counters are no longer one transaction.
`settle()` recounts totals, copied bytes and failures from the items table,
which corrects any drift left by a worker that stopped between the two writes.

The show page lists items only after scanning has started and while the scan
database is reachable, and shows a notice otherwise. Scan database connections
use a five-second connect timeout, so an unreachable server fails fast instead
of holding the page or a worker. Deleting a migration drops its items table and its database
user. Remote access and the firewall rule stay in place because other
migrations or sites may use them.

The `2026_09_16_235000_add_scan_database_to_storage_migrations_table` migration
drops the old shared `storage_migration_items` table and soft-deletes
migrations created before this change, since their items cannot be recovered.
Start those migrations again with a scan database.

## Names, progress and sync state

Every migration has a name. The **Migrate storage** sheet requires one, and the
**Rename** action in the actions menu changes it later
(`PATCH /storage-migrations/{storageMigration}`, `ManageStorageMigration::update()`,
write access). The list links each name to its progress page, and the page uses
the name as its heading with source → target underneath.

The list shows progress as a bar with a percentage: copied, skipped and failed
objects over `items_total`, from `StorageMigration::progress()`. While
discovery is still running the total grows, so the percentage can drop. The
progress page shows the same value.

The **Sync** badge answers "is this migration making progress right now", not
just "is its status active". `StorageMigration::isSyncing()` is true only when
the status is pending, scanning, running or verifying **and** `last_activity_at`
is within `activity_window` seconds (default 120,
`STORAGE_MIGRATION_ACTIVITY_WINDOW`). Workers write `last_activity_at` as they
go:

- the scanner on every listing page, together with the page's counters;
- transfer workers when they start each object, after each multipart part, and
  for each verified object, throttled to one write every 30 seconds per worker.

A running migration shows **not syncing** when Horizon isn't processing its
queues, when it is still waiting for scan database access, or when a transfer has
stalled. Paused, completed, partial, failed and cancelled migrations are never
syncing. The list polls every five seconds, so the badge also turns off when
activity stops rather than waiting for a socket event.

## Backup files during a migration

- Before the cutover, every available `BackupFile` of the backups being moved
  gets an item (size unknown until listing reaches it, or until a worker reads
  it from the source). Restores and deletes use the source object right away,
  not only after the scan has listed that key. `started_at` is set before
  these items are written.
- pgBackRest backups are skipped when mapping keys. Their live repository
  (`<source path>/pgbackrest/<stanza>/`) is left out of the scan, and after
  the cutover setup runs again on the target. See `docs/pgbackrest.md`.
- Database backups whose database no longer exists are not mapped; their
  objects are copied as plain objects.
- If a migration's scan database is unavailable, backup files created after
  the migration started skip it. Older files still raise the error because
  their location can't be determined.
- A migration can't be deleted while one of its items for an existing backup
  file isn't `copied` or `skipped`. Deleting it would drop the only record
  that the file still lives on the source.
- **Retry failed** clears both pause flags. If discovery never finished, it
  restarts the scan from the saved cursor instead of waiting for transfers
  that can never settle.
- Every call to `dispatchTransfers()` bumps `transfer_generation`. Copy jobs
  carry the generation they were started with and stop when it's stale, so
  resuming or changing the worker count never leaves two job chains on the
  same slot. Verify jobs don't check it.
