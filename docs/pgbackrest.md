# pgBackRest backups

Physical backups of a whole PostgreSQL cluster, written straight to S3 by
[pgBackRest](https://pgbackrest.org). Nothing is staged on the database
server's disk, uploads run in parallel, backups are compressed (zstd) and
encrypted (AES-256), and continuously archived WAL allows point-in-time
recovery. Meant for databases too large for the regular `pg_dump` backups.

## Requirements

- A PostgreSQL service installed through Vito (PGDG packages) on the server.
- An S3 or S3-compatible storage provider.
- `wal_level` of `replica` or `logical` (the default). Setup stops if it is `minimal`.
- pgBackRest 2.46 or newer. Setup installs the latest from the PGDG repository.
- One pgBackRest backup per server. It always covers every database in the cluster.

## Creating

**Create backup → PostgreSQL cluster (pgBackRest)** is offered for servers
whose database service is PostgreSQL.

| Field | Meaning |
|---|---|
| Storage | S3 storage provider. The repository lives at `<provider path>/pgbackrest/<stanza>` in its bucket. |
| Backup strategy | **Standard** or **Custom**. See [Backup strategy](#backup-strategy). |
| Parallel processes | `process-max` for compression and upload. Keep it below the CPU count. |
| WAL queue limit (GiB) | `archive-push-queue-max`. See [WAL safety](#wal-safety). |

The backup shows **installing** while `SetupPgBackRestJob` runs, then takes
its first full backup. If setup fails the status is **failed**, the output is
in the server logs, and saving the backup again from **Edit** retries setup.

## What Vito changes on the server

1. Installs `pgbackrest` and creates `/var/log/pgbackrest`, `/var/lib/pgbackrest`
   and `/var/spool/pgbackrest` owned by `postgres`.
2. Writes `/etc/pgbackrest/pgbackrest.conf` (`postgres`, mode 640) over SFTP.
   It contains the S3 credentials and the encryption passphrase.
3. Writes `/etc/postgresql/<version>/main/conf.d/zz-vito-pgbackrest.conf` with
   `archive_mode = on` and `archive_command = 'pgbackrest --stanza=<stanza> archive-push %p'`.
   **If archiving was off, PostgreSQL is restarted once**; otherwise the
   configuration is reloaded.
4. Runs `stanza-create` and `check`, which confirms WAL reaches S3.

The config file is rewritten before every backup and when the backup is
edited. Saving new credentials on the storage provider re-runs setup for every
pgBackRest backup that uses it (status **installing**), which writes the new
config and runs `pgbackrest check` right away, so archiving never keeps using
old keys and wrong keys show up as a failed setup. Re-running setup only takes
a backup when none exist yet.

Changing the provider's bucket or path points pgBackRest at a new, empty
repository: the next backup is a full backup there, and backups in the old
location are no longer listed in Vito (they stay in S3).

## Backup strategy

Only the **Standard** strategy is offered for now. The Custom strategy is hidden in the UI and refused by
the server unless `PGBACKREST_STRATEGIES=standard,custom` is set.

Every pgBackRest backup belongs to a PostgreSQL cluster (`postgres_clusters`),
which owns the stanza, the primary, the replicas, the private network and the
TLS certificates. The strategy decides the backup types, retention and checks.

| | Standard | Custom |
|---|---|---|
| Full backup | Sunday 02:00 (`0 2 * * 0`) | your cron |
| Differential backup | Monday to Saturday 02:00 (`0 2 * * 1-6`) | your cron, or none |
| Incremental backup | every hour (`0 * * * *`) | your cron, or none |
| `repo1-retention-full` | 4 | your value |
| `repo1-retention-diff` | 7 | your value, or unset |
| `pgbackrest verify` | Saturday 04:00 | Saturday 04:00 |
| `pgbackrest check` | daily 03:30 | daily 03:30 |

Times use the application timezone. WAL is archived continuously and kept back
to the oldest full backup, so the Standard strategy allows point-in-time recovery
to any moment of the last four weeks. The worst-case restore replays at most a day
of WAL on top of a differential, or an hour on top of an incremental.

- `backups:run` checks every minute which schedules came due since the last run
  that covers them (a full covers every schedule, a differential covers the
  differential and incremental ones) and starts the most complete one (full,
  then differential, then incremental), so the Sunday full is not taken as an
  incremental.
- Runs missed while Vito was down or asleep start once Vito is back, as one run
  of the most complete missed type: waking up on Monday at 09:00 after missing
  the Sunday full starts one full backup, not every missed incremental. `verify`
  and `check` catch up the same way. A run that started and failed is not
  retried until its next scheduled time; it raises an alert instead.
- If a run is still going, the due type waits in `queued_type`, upgraded to the
  most complete one that came due, and starts as soon as the running backup
  finishes or fails.
- If there is no full backup yet, pgBackRest turns a differential or
  incremental into a full backup by itself.
- **verify** runs as a transient unit `vito-pgbackrest-verify-<backup id>` on the
  same host as backups and checks every file in the repository against its
  checksum. A failure raises a backup alert (see [Alerts](#alerts)).
- **check** runs on the primary and confirms WAL reaches S3. A failure raises a
  backup alert.
- The last verify and check results are shown on the backup files page.

## Runs

`backups:run` starts due backups; **Run backup** on the backups page starts an
incremental backup now. A run never starts while another one for the same
cluster is still running.

**Where a run executes.** When the cluster has a replica that is ready, healthy,
checked in the last 3 minutes and less than the lag warning threshold behind,
the backup runs on the most caught-up one with `--backup-standby=y`. pgBackRest
then copies data files from the replica straight to S3 and only asks the
primary, over the TLS server, to start and stop the backup and for the few files
that are not replicated. Otherwise it runs on the primary. The host is stored
on the backup file and shown next to it. Nothing is staged on either server's
disk.

Each run is a transient systemd unit, `vito-pgbackrest-<file id>`, running
`pgbackrest --type=full|diff|incr backup` as `postgres`, so it keeps going if
the SSH connection drops or Vito restarts. `MonitorPgBackRestJob` checks the
unit every minute:

- **running**: records progress from the backup lock in `pgbackrest info`
  (`size-cplt` / `size`), shown next to the status on the backups page.
  pgBackRest versions that don't report progress just show the status.
- **finished**: reads `pgbackrest info --output=json`, stores the backup label
  (for example `20260917-010000F` or `..._20260918-010000I`) and the size it
  added to the repository, and removes backups pgBackRest has expired.
- **failed**: stores the last lines of the unit's journal and notifies.
- **gone** (for example after a server reboot) with no new backup in the
  repository: fails with an explanation.

## WAL safety

PostgreSQL archives WAL on its own, independently of Vito's schedule, so a
missed scheduled run does not lose data; recovery just replays more WAL.

Archiving is asynchronous with `archive-push-queue-max` set to the WAL queue
limit. If S3 is unreachable long enough for unarchived WAL to exceed it,
pgBackRest drops WAL instead of letting the disk fill and stop PostgreSQL.
Point-in-time recovery then has a gap until the next backup.

Every 15 minutes (`backups:check-archiving`) and after every finished backup,
Vito checks `pg_stat_archiver` and the archive-push logs on each ready server.
Archiving that fails (it failed more recently than it succeeded) and new
`dropped WAL file` warnings raise backup alerts. Problems found at the end of a
backup are also noted on that backup.

## Alerts

Every backup type (file, database and pgBackRest) has a health state in
`backups.health`, checked by `CheckBackupHealth` after every run, archiving
check, `pgbackrest check` and verify, and every 15 minutes by
`backups:check-health`. A backup needs attention when:

| Problem | Clears when |
| --- | --- |
| Setup failed | setup succeeds |
| The last run failed (with its error) | a run succeeds |
| Overdue: no run started at the last scheduled time, 60 minutes after it (`BACKUP_OVERDUE_GRACE_MINUTES`), and none is running. This catches a stopped scheduler or queue, a cluster stuck failing over, or a backup that never starts | a run succeeds |
| WAL archiving is failing | archiving succeeds again |
| WAL was dropped, so point-in-time recovery has a gap | a backup that started after the drop succeeds |
| The last backup reported errors such as page checksum failures | a backup without errors succeeds |
| `pgbackrest check` failed | the next check passes |
| `pgbackrest verify` failed | the next verify passes |
| `pgbackrest check` or `verify` did not run at its scheduled time, after the same grace period | it runs |

Alerts go to every notification channel:

- **Needs attention** when a new problem starts, listing all current problems;
- a **reminder** every 24 hours while problems last (`BACKUP_ALERT_REMINDER_HOURS`), so
  a backup that fails every hour alerts once, not every hour;
- **Recovered** once every problem has cleared.

Disabling a backup clears its alerts without a message. The server shows a
banner and the server list a warning while any of its backups needs attention.
The backups pages list each problem, and warn when no notification channel
exists, because then no alert reaches anyone. Vito cannot alert while Vito
itself is down; an overdue backup is reported once it is running again.

## Encryption passphrase

Vito generates a 64-character passphrase and stores it encrypted. Admins can
reveal it from the backup's menu (**Encryption passphrase**). Store it outside
Vito and the server: without it, the backups in S3 cannot be restored.

## Restoring

### To a new server

**Restore to a new server** (on the backup files page, or per backup) creates a
server at a cloud provider and restores the backup onto it, for disaster
recovery or to inspect data without touching production.

Before you choose a plan, the dialog shows what the server needs:

| | Where it comes from |
| --- | --- |
| **Storage** | The largest database the backups hold (pgBackRest's `info.size`, stored for each backup since 2026-09-18 and filled in for older ones at the next run) × 1.2 for growth, plus 12 GB for WAL replay and the operating system. Until a backup reports its size, the disk the source server uses (latest metric) × 1.2 + 5 GB stands in. |
| **vCPU and memory** | The source server's plan, else its latest metrics. Fewer vCPU or less memory is allowed with a warning: fine for checking data, not for replacing the source. |
| **Processor architecture** | The source plan's (for Hetzner, `arm` for CAX, `x86` for the others). PostgreSQL data files are not safe across architectures, so other plans are refused. |
| **OS and PostgreSQL** | Always the source's, so collations and the data format match. |

Plans with too little disk or another architecture can't be selected, and the
server refuses them too. The restore point is the latest state (the last backup
plus all archived WAL), a chosen backup as it was when it finished, or a point
in time after the oldest backup.

Vito then:

1. Creates the server with the source's OS, PostgreSQL version and monitoring
   (status **waiting for the server**), and waits up to two hours for the
   installation. A firewall isn't installed; PostgreSQL on the new server listens
   on localhost only.
2. Installs pgBackRest and writes a config for the new server's data directory.
3. Runs the restore as the transient unit `vito-pgbackrest-restore-<id>`
   (status **restoring**, with the latest output line). It clears the new
   server's data directory, and restores with `--archive-mode=off` so the copy
   never archives WAL into this repository. Then it starts PostgreSQL and waits
   until WAL replay reaches the restore point and PostgreSQL is promoted. If
   PostgreSQL stops during replay, for example because the point in time is
   after the last archived WAL, the unit fails with the PostgreSQL log.
4. Resets the recovery settings and `archive_mode` in `postgresql.auto.conf`,
   and deletes `/etc/pgbackrest/pgbackrest.conf` and the spool directory, so the
   new server keeps neither the S3 credentials nor the encryption passphrase.
   The credentials are also deleted when a restore fails.
5. Imports the restored databases and users into Vito, and notifies every
   channel that the restore completed or failed.

The files page lists the last ten restores with their status. Only admins who
can create servers can start one, because the new server receives all the data
and, during the restore, the repository credentials. The copy is independent: it
doesn't connect to the source and takes no backups until you add them.

### Commands

**Restore commands** (on the backups page, or per backup) shows the exact
commands to restore by hand, optionally for a point in time.

On the same server, this replaces all data in the cluster:

```
sudo systemctl stop postgresql
sudo -u postgres pgbackrest --stanza=<stanza> --delta --set=<label> --type=immediate --target-action=promote restore
sudo systemctl start postgresql
```

- Without `--set`/`--type`, the latest backup is restored and all archived WAL is replayed.
- For a point in time use `--type=time "--target=2026-09-17 14:30:00+00" --target-action=promote`.

On another server: same PostgreSQL major version, pgBackRest installed, a copy
of `/etc/pgbackrest/pgbackrest.conf` with `pg1-path` pointing at that server's
data directory, and `--archive-mode=off` added so the copy does not archive
WAL into this repository.

## Storage migrations

A storage migration away from the backup's S3 provider moves the backup to the
target provider and re-runs setup there (status **installing**), so pgBackRest
starts a new repository on the target and the next run is a full backup. The
old repository is not copied, because pgBackRest keeps writing to it until
setup finishes. It stays in the source bucket, and its backups can still be
restored with the saved passphrase and the previous config. Keep the source
bucket until the new repository covers your retention.

## Deleting

Deleting the backup in Vito stops any running backup unit and turns archiving
off: the drop-in is changed to `archive_mode = off` (effective at the next
PostgreSQL restart) and `archive_command = '/bin/true'` (effective
immediately, so WAL cannot pile up). The repository in S3 and
`/etc/pgbackrest/pgbackrest.conf` are left in place, so existing backups stay
restorable with the saved passphrase.

## Regression check

`php tests/Feature/PgBackRestBackupTest.php` runs against an in-memory
database with a fake SSH connection. It covers validation, setup commands and
config contents, full and incremental runs, monitoring (running with progress,
finished, failed, lost), retention sync, backup alerts (failure, archiving,
WAL gap, verify, check, overdue, reminders, recovery and deduplication), the
periodic checks, restoring to a new server (requirements, refused plans,
the restore script for each restore point, progress, completion and failure),
re-applying setup after a storage change,
editing, setup retry, the restore and download guards, the scheduler and
reconciliation, and deletion. It does not contact servers or S3.

Deploying needs `php artisan migrate` (a `configuration` column on `backups`
and a `progress` column on `backup_files`) and a Horizon restart.
