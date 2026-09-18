# PostgreSQL clusters and replicas

A PostgreSQL cluster in Vito is a primary plus any number of read-only hot
standbys. Everything is built on pgBackRest:

- Replicas are restored from the cluster's pgBackRest backup, then stream WAL
  from the primary.
- Backups run on a healthy replica straight to S3, with no files staged on
  either server.
- Replication and backup traffic only travels over a private network, and
  PostgreSQL and pgBackRest only accept connections from cluster members.
- Health, lag and latency are checked every minute, with notifications and
  charts.
- Failover is one click and moves archiving, backups and the other replicas to
  the new primary. Vito never fails over by itself.

```
        private network (Hetzner or other provider network, custom network, else WireGuard)
 Primary ─────────────────────────────────────────────── Replica(s)
  postgres, listens on localhost + private IP             hot standby, restore_command = archive-get
  archive-push ──────────► S3 repository ◄──────────────── restore / archive-get / backup --backup-standby
  pgbackrest server (TLS :8432) ◄── client certificate ── pgbackrest (backups run here)
  ufw: 5432 and 8432 open to each replica's private IP only
```

## Requirements

- Servers in the same project, with PostgreSQL installed by Vito on the same
  major version.
- A firewall service (ufw) on the primary and every replica.
- The replica server has no databases or backups in Vito and is not in another
  cluster. **All PostgreSQL data on it is replaced.**
- An S3 or S3-compatible storage provider.
- `wal_level` of `replica` or `logical` (the default), and a free
  `max_wal_senders` and `max_replication_slots`. Setup stops with a message
  otherwise, because changing them needs a restart.

## Creating a replica

On the primary's **Databases → Replication** page, **Create replica** asks for:

- **Replica server.**
- **WAL kept for a disconnected replica (GB):** `max_slot_wal_keep_size` on the
  primary. When a replica falls this far behind, PostgreSQL drops its WAL
  instead of filling the primary's disk, and the replica needs a rebuild. With
  several replicas the largest value applies.
- **S3 storage and a backup strategy**, only when the primary has no pgBackRest
  backup yet. Vito creates the backup, and the replica waits in
  **waiting for backup** until the first full backup finishes.

The replica moves through **waiting for backup → pending → configuring →
seeding → ready**. If setup fails it becomes **failed**, with the reason on the
replica page and in the server logs, and **Rebuild** starts over.

### What setup does

Every step can be repeated safely. While a step waits for something, the job
checks again every 15 seconds, for up to 30 minutes.

1. **Private network.** Vito prefers the cloud provider's private network
   over WireGuard (`DATABASE_REPLICATION_NETWORK_TYPES`, default
   `provider,custom,wireguard`):
   - It uses an active network both servers are already members of, preferring
     provider, then custom, then WireGuard networks.
   - Otherwise, when both servers are Hetzner Cloud servers on the same
     Hetzner connection and network zone (for example nbg1 and fsn1, both
     `eu-central`), Vito asks Hetzner to attach both to one Cloud Network. It
     reuses a network one of them is already on, or creates
     `vito-postgres-<stanza>` on a free `10.x.0.0/16` range, then syncs it into
     Vito as a provider network.
   - Otherwise it creates a WireGuard network `postgres-<stanza>`, for example
     across Hetzner network zones or providers.

   For networks Vito creates, it removes the default "Allow all" rule, so
   members can't reach each other's other services. Replicas added later join
   the cluster's network. Setup waits until both memberships are active.

   A server attached to a Hetzner network while it runs gets a new network
   card that Hetzner's images do not configure. Vito brings it up with DHCP
   through `/etc/systemd/network/60-vito-private-<card>.network`. It only
   touches physical cards without an IPv4 address, never `eth0`, and ignores
   the DHCP gateway and DNS, so the default route and name resolution stay
   unchanged. Setup fails with the card list if the private IP doesn't appear
   within 30 seconds.

   A cluster on a WireGuard network that Vito created for it moves to the
   provider network the next time a replica is set up or rebuilt, as long as
   no other replica streams over the old network. Vito then removes the
   WireGuard network. The move changes the private IPs, so setup rewrites the
   hosts aliases, firewall rules, `pg_hba.conf` and `listen_addresses`, which
   restarts PostgreSQL on the primary once.
2. **Inspect the replica:** data directory, port and version.
3. **Names.** Every node gets a managed `/etc/hosts` block mapping
   `vito-pg-<server id>` to each node's private IP, plus
   `net.ipv4.ip_nonlocal_bind=1` so services can bind the private address
   before the tunnel is up after a reboot.
4. **Listen addresses.** PostgreSQL on the primary gets
   `listen_addresses = 'localhost,<private IP>'`. This goes through the existing
   networking setting, which **restarts PostgreSQL on the primary once**. The
   public `0.0.0.0` rule is only added if you turn networking on yourself.
5. **Firewall.** On the primary, ufw rules allow tcp 5432 and 8432 from each
   replica's private IP (/32) only. They are tagged `vito-pg:<cluster>:<server>:<port>`
   and removed when they no longer apply.
6. **Primary.**
   - Creates the role `vito_replica_<random>` (`REPLICATION LOGIN`, generated
     password) and a permanent physical slot with the same name. The SQL goes
     through a temporary file readable only by `postgres`, so the password
     never appears in a command or server log.
   - Writes a `# BEGIN VITO REPLICATION` block into `pg_hba.conf`: one
     `hostssl` rule per replica (`host` when SSL is off), from its private IP,
     `scram-sha-256`.
   - Writes `conf.d/zz-vito-replication.conf` with `max_slot_wal_keep_size`.
   - Reloads, and restores the previous `pg_hba.conf` if PostgreSQL reports
     rule errors.
7. **TLS and pgBackRest.**
   - Vito is a small certificate authority per cluster: EC P-256, created in PHP
     with phpseclib and stored encrypted.
   - Each node gets a certificate for `vito-pg-<server id>`, valid for serving
     and for connecting, in `/etc/pgbackrest/tls` (owner `postgres`).
   - The primary's pgBackRest config gets `tls-server-*` settings and one
     `tls-server-auth=vito-pg-<replica id>=<stanza>` per replica, and runs
     `vito-pgbackrest-server.service` (`pgbackrest server`) on its private IP.
   - Each replica's config has the local standby as `pg1` and the primary as
     `pg2` over TLS.
8. **Restore.** A transient unit `vito-replica-seed-<id>` on the replica:
   - tests the replication connection (`IDENTIFY_SYSTEM`) and the repository;
   - stops PostgreSQL, empties the data directory, and runs
     `pgbackrest --type=standby restore`;
   - writes `conf.d/zz-vito-replica.conf`: `hot_standby = on`,
     `hot_standby_feedback = off`, `max_standby_streaming_delay = '30s'`,
     `default_transaction_read_only = on`, `primary_conninfo`
     (`host=vito-pg-<primary id>`, `sslmode=require`, passfile) and
     `primary_slot_name`, plus the primary's `max_connections`,
     `max_worker_processes`, `max_wal_senders`, `max_prepared_transactions` and
     `max_locks_per_transaction`, because a standby refuses to start when these
     are lower than on the primary;
   - writes `zz-vito-pgbackrest.conf` with `archive_mode = on`. A standby does
     not archive, but a promoted replica starts archiving to the same stanza
     immediately, without a restart;
   - sets the private listen address, and starts PostgreSQL as a standby. It
     replays archived WAL from S3 until it catches up, then streams from the
     slot.

`MonitorDatabaseReplicaSeedJob` checks the unit every 30 seconds and marks the
replica ready when it finishes.

## Health and metrics

`database-replicas:check` runs every minute. Each check runs one query on each
server and stores a `database_replica_metrics` row:

| Metric | Source |
|---|---|
| Lag (bytes) | `pg_current_wal_lsn() - replay_lsn` in `pg_stat_replication` |
| Write, flush and replay latency (ms) | `write_lag`, `flush_lag` and `replay_lag`. These are zero while the primary is idle. |
| Replay delay (s) | `now() - pg_last_xact_replay_timestamp()` on the replica, counted only while WAL is still waiting to be applied, so an idle primary is not a false alarm |
| Slot WAL retained (bytes) and WAL status | `pg_replication_slots` |

Health is the worst of these findings:

| Critical | Warning |
|---|---|
| Primary or replica unreachable over SSH | Connected but not `streaming` (for example `catchup`) |
| Slot missing, `lost` or `unreserved` | Slot `extended` |
| Replica not connected (slot inactive) | Lag ≥ 256 MB |
| PostgreSQL down on the replica | Replay latency ≥ 30 s |
| Replica no longer in recovery | Replay delay ≥ 300 s |
| WAL receiver not streaming | Slot holds ≥ 50% of `max_slot_wal_keep_size` |
| Lag ≥ 2 GB, replay latency ≥ 300 s | |

- Thresholds and the history retention (30 days) are in
  `config/database-replication.php` and can be set through
  `DATABASE_REPLICATION_*` environment variables.
- A notification is sent when health becomes warning or critical, and when it
  recovers.
- The replica page charts lag, replay and flush latency, and retained WAL, for 1
  hour to 30 days, keeping the worst value in each bucket.
- Healthy replicas are what backups run on. See [pgbackrest.md](pgbackrest.md).

## Failover

**Failover is turned off by default.** The menu item is hidden, and the API refuses to start one. Set
`DATABASE_REPLICATION_FAILOVER_ENABLED=true` to enable it. A failover that was already started can
still be continued, so a cluster is never left stuck in **failing over**. When enabled, the admin must
type the replica server name to confirm.

**Fail over to this replica** (ready replicas only) makes it the new primary.
Vito never fails over by itself, because a two-node setup cannot tell a dead
primary from a broken network, and promoting then would cause split brain.

The dialog shows the replica's lag. If the replica is critical or ≥ 2 GB behind,
or the old primary can't be reached, you must confirm. While it runs the cluster
shows **failing over**, and no other replica or backup operation starts.

1. **Fence the old primary:** stop PostgreSQL and mask its unit, turn WAL
   archiving off, stop the pgBackRest TLS server. If it can't be reached and you
   did not confirm, the failover stops without changing anything.
2. **Promote** the replica (`pg_promote`) and remove its standby settings. If
   `archive_mode` is off, it is reset and PostgreSQL restarts.
3. **Swap roles.** The cluster and its pgBackRest backup move to the new primary
   (same stanza). The old primary is added back as a replica in **needs
   rebuild**.
4. **Other replicas** get a slot and access on the new primary, and
   `primary_conninfo` pointing at it. They follow the new timeline through
   `recovery_target_timeline = latest`. A health check runs two minutes later.
5. **Backups.** The firewall rules, hosts entries, certificates, pgBackRest
   configs and TLS server follow the new primary. `stanza-create` and `check`
   confirm WAL reaches S3, and a full backup is queued.

Every step is saved as a checkpoint in `postgres_clusters.failover`. If fencing
fails because the old primary can't be reached and you did not confirm, nothing
has changed, so the cluster goes back to **active**. If a later step fails, the
cluster stays **failing over** with the error. **Continue failover** resumes from
the last finished step, without stopping the old primary or promoting the replica
a second time. Manual backups, scheduled backups, verification and replica
changes are blocked until it finishes.

A replica that can't be reached is not deleted silently. The first delete fails
and explains the risk; deleting it again removes it anyway.

Vito does not change your applications. Point them at the new primary.

**Fence on sight.** Every minute, Vito checks each needs-rebuild server. If a
former primary that was down during failover comes back and accepts writes,
Vito stops it again and notifies. Until then it may have pushed WAL for its old
timeline to S3; recovery on the new timeline is not affected.

## Rebuild

**Rebuild** (ready, failed or needs-rebuild replicas) runs setup again. It
restores from the latest backup, with `--delta` for a former primary so only
changed files are copied, and unmasks PostgreSQL. Use it when a slot is `lost`,
after a failed setup, or to bring a former primary back as a replica.

## Deleting a replica

**Delete**:

- turns off WAL archiving on the replica, so it can't write into the cluster's
  repository;
- promotes it into an independent writable server;
- removes its pgBackRest config and certificates, passfile and seed script;
- on the primary, drops its slot and role, and removes its `pg_hba.conf` rule,
  firewall rules and TLS access;
- removes it from a Vito-managed WireGuard network.

No data is deleted. If the replica or the primary can't be reached, the steps
that could not run are logged on that server.

The pgBackRest backup of a cluster that has replicas can't be deleted.

## Certificates

`postgres-clusters:rotate-certificates` runs daily at 03:15:

- Node certificates (valid 2 years) are renewed 30 days before they expire.
- The CA (valid 10 years) is renewed a year before it expires. The old CA stays
  trusted until every node has a new certificate.
- New files are written and the TLS server restarts.
- Failures are logged on the primary.

## Seeing the private network

The Replication page lists the cluster's private network with each node's
private IP. For WireGuard it also shows whether each node's tunnel is up:
**connected** means a handshake in the last five minutes. Handshakes are read
from every member with `wg show … latest-handshakes` every three minutes
(`networks:reconcile`). **Open network** leads to the network's Servers tab. It
shows the same status per server, and **Configuration** in a server's menu shows
the live `wg show` output and the WireGuard configuration Vito wrote. The
private key is replaced by a note and never leaves the server.

## Risks and limits

- Replication is asynchronous. If the primary dies, commits from the last
  seconds may be lost.
- A replica is not a backup: a mistaken `DELETE` reaches it within seconds.
  Restore from pgBackRest instead.
- Adding the first replica restarts PostgreSQL on the primary once. Creating the
  replica replaces all PostgreSQL data on the replica server.
- Every node, including replicas, holds the S3 credentials and the backup
  encryption passphrase in `/etc/pgbackrest/pgbackrest.conf`.
- Not supported: automatic failover, synchronous replication, cascading
  replicas, logical replication, and replicas in another project.

## Regression check

`php tests/Feature/DatabaseReplicationTest.php` runs against an in-memory
database with a fake SSH connection. It covers:

- validation, waiting for the first backup, and the WireGuard network without
  "Allow all";
- Hetzner networks: attaching both servers on a free range, bringing up the
  private card, falling back to WireGuard across network zones, and moving a
  cluster off its WireGuard network;
- WireGuard handshake status per server, and the configuration shown without
  the private key;
- the private listen address and its restart, hosts aliases, and firewall rules
  limited to the replica;
- `pg_hba.conf` without a logged password, the restore script, and pgBackRest
  config for each role;
- certificates signed by the cluster CA and encrypted storage;
- seeding, and health with notifications;
- backups from the replica, and falling back to the primary;
- metric downsampling and pruning;
- failover: refused without confirmation, fencing, promotion, the role swap,
  re-pointing a second replica, moving backups and firewall, and the full backup
  after failover;
- fence on sight, rebuilding the old primary with delta, deleting a replica, and
  the backup delete guard.

It does not contact servers.

Deploying needs `php artisan migrate` (`postgres_clusters`, `database_replicas`,
`database_replica_metrics`, and `backup_files.server_id`/`type`) and a Horizon
restart.
