# PostgreSQL version upgrades

An upgrade moves every database of a PostgreSQL server to a **new server
running a newer major version**, with logical replication. The old server keeps
serving reads and writes the whole time, and you decide when to switch over.

```
        private network (provider network, custom network, else WireGuard)
 Old server (17) ──────────────────────────────────────── New server (18)
  publication FOR ALL TABLES per database  ──── copy ────► one subscription per database
  role vito_upgrade_… (REPLICATION, pg_read_all_data)      roles, schemas and rows of the old server
  pg_hba: hostssl all vito_upgrade_… <new IP>/32           pg_dump --schema-only over the private network
  ufw: 5432 open to the new server's private IP only
```

It is a different tool from a [replica](database-replication.md). A replica is a
byte-for-byte copy that must run the same major version; logical replication
copies rows, so the two servers may run different versions, different processor
architectures and different page layouts.

## Two ways the new server gets the data

**Copying every row** over the private network is the simple one: nothing is
required beyond the two servers, and it is fine up to tens of GB.

**Starting from the backup** is the one for a large database. Vito reserves the
old server's changes with a replication slot, restores its newest pgBackRest
backup onto the new server **up to exactly the position that slot starts at**,
upgrades that copy with `pg_upgradecluster --link`, and then replicates only
what happened after. The rows come out of the backup repository, so the old
server is never read for them, and the restore runs at the speed of the
repository rather than of logical replication. It needs a pgBackRest backup of
the old server — the Backups page — and enough disk on the new server for a
physical copy, indexes and all.

The position is what makes it exact: the slot is created first, the restore
stops at that position, and the subscription's replication origin is set to it.
Nothing between the backup and that position is replayed twice, and nothing
after it is missed.

## What it does and does not copy

Copied: every database (except `postgres` and the templates), all roles with
their passwords, schemas, table data, and — at the switch — the sequence values.

Not copied, because logical replication never sends it:

- rows of **unlogged** tables (the tables are created empty),
- **materialized views** (created empty; run `REFRESH MATERIALIZED VIEW` after
  the switch),
- **large objects**,
- **DDL**: tables created on the old server after the copy started are not
  created on the new one, and rows for them stop the subscription. Hold your
  migrations until the switch.

Tables **without a primary key** need care: while a publication includes them,
`UPDATE` and `DELETE` on the old server fail with *cannot update table … because
it does not have a replica identity*. Vito lists them before you start and
offers to set `REPLICA IDENTITY FULL` on them, which keeps them working. That
setting only costs anything while `wal_level` is `logical`, and you can reset it
with `ALTER TABLE … REPLICA IDENTITY DEFAULT`.

## Requirements

- PostgreSQL installed by Vito on the old server, which must not be a standby.
- A server provider connection: Vito creates the new server, with the same
  operating system and the PostgreSQL version you pick. Any plan works as long
  as its disk fits the databases; the processor architecture does not matter.
- `wal_level = logical` and a free replication slot and WAL sender per database.
  When the old server does not have them, Vito writes them to
  `conf.d/zz-vito-upgrade.conf` and **restarts PostgreSQL once**, which you
  confirm before the upgrade starts. Open connections are dropped at that moment.
- A firewall service (ufw) is optional. When the old server has one, Vito opens
  5432 there only to the new server's private address.
- Room for the WAL the old server keeps while the copy runs. Until the new
  server has applied everything, the old one cannot recycle that WAL, and a copy
  of a large database runs for hours. Vito caps it — a quarter of the free disk
  by default, and yours to set — so a copy that falls too far behind **stops the
  upgrade** instead of filling the disk of the server you are migrating away
  from. Nothing on the old server is changed when that happens; cancel and start
  again with a larger allowance, or at a quieter time.

## How Vito runs it

1. **Creates the server** at your provider and installs PostgreSQL and the
   monitoring agent.
2. **Connects both servers privately**: an existing provider network (including
   the one of a cluster the old server belongs to), else a Hetzner-style network
   Vito asks the provider for, else a WireGuard network it creates for the
   upgrade and removes afterwards. The rows never travel over the internet.
3. **Prepares the old server**: `wal_level`, slots and senders, the role
   `vito_upgrade_…` (`REPLICATION`, `pg_read_all_data`, password in a file, never
   on a command line), a `hostssl` rule for the new server's address only, and
   one `CREATE PUBLICATION … FOR ALL TABLES` per database.
4. **Prepares the new server**: enough background workers, the roles of the old
   server with their password hashes, one database per source database with the
   same owner, encoding, locale, grants and per-database settings, and the schema
   through `pg_dump --schema-only` run by the *new* server's `pg_dump` over the
   private network.
5. **Subscribes** once per database and follows the first copy table by table.
   The page shows the progress; you get a notification when everything is copied
   and the new server keeps up.
6. **Waits for you.** Check the data on the new server for as long as you like.

## Finishing (the switch)

Pressing **Finish** is the moment the old server stops serving writes:

1. `default_transaction_read_only = on` on the old server, and its application
   connections are terminated (Vito's own `postgres` sessions stay).
2. Vito notes the current WAL position and waits, up to ten minutes, until every
   subscription confirmed it applied everything up to that point.
3. Sequence values are read from the old server and set on the new one.
4. The subscriptions are dropped, which also drops the slots on the old server.
5. The publications, the role, the `pg_hba` rule, the firewall rule and a
   WireGuard network Vito created are removed, and Vito imports the databases and
   users of the new server.

If step 2 does not finish in time nothing else has happened yet: the upgrade goes
back to waiting with the reason, and you can press Finish again.

**Pointing applications at the new server is yours to do.** The old server stays
read-only on purpose, so nothing writes to the old database by accident; run
`ALTER SYSTEM RESET default_transaction_read_only` there (and reload) if you ever
need it back.

## Cancelling

Cancel stops the copy at any point before the switch, and after a failure. Vito
drops the subscriptions on the new server, removes the publications, the role,
the `pg_hba` rule and the settings file from the old server, and lets it take
writes again. The new server is kept — delete it yourself when you no longer
need it.

## How long it takes

The copy is the part that costs time, and the time it costs decides everything
else: the old server cannot recycle the WAL the new one has not applied yet, so
a long copy is also a large pile of WAL on the server you are migrating away
from.

Vito copies the rows into tables that carry only their primary key, unique and
exclusion indexes, and builds the rest afterwards, concurrently. Measured on two
Hetzner cax11 servers (2 vCPU, 3 GB, ARM) with 12 million rows, 3.1 GB of heap
and 1.4 GB of indexes:

| | copy | indexes | total |
|---|---|---|---|
| indexes already on the table | 243 s (45 GB/h) | — | 243 s |
| indexes built afterwards | **81 s (135 GB/h)** | 96 s | 177 s |

Building them concurrently costs almost nothing — on the same hardware, a btree
over 5 million rows took 4 seconds either way and a GIN index 22 against 26 —
and it lets the new server keep applying changes while it builds, so the old
server keeps releasing WAL throughout.

Take those rates as a floor for your own hardware, and multiply: a database of
a few hundred GB is an overnight copy. Past roughly that, weigh this against
`pg_upgrade`, whose downtime does not grow with the size of the database.

## What it has been proven against

One full 17 → 18 migration of a 0.3 GB database under continuous writes
(~5 transactions a second, including updates and deletes on a table with no
primary key), with row counts, a money sum and every sequence verified identical
afterwards. That is one run at small scale: rehearse on a copy of your own
database, at its real size, before trusting it with the original. What that
rehearsal tells you — how long the copy takes and how much WAL piles up while it
does — is exactly what decides whether the real one is safe.

## Troubleshooting

- **The copy reports replication errors.** The page shows the count; the cause is
  in the PostgreSQL log of the new server (`/var/log/postgresql`). The most
  common ones are an extension that is not installed there and a table created on
  the old server after the schema was copied. Logical replication retries by
  itself once the cause is gone.
- **A slot disappeared, or the old server dropped WAL the copy still needed.**
  Vito stops the upgrade rather than let the new server fall behind silently.
  Neither server is changed by this; cancel and start again, with a larger WAL
  allowance if that was the cause.
- **The old server is read-only and you want to go back.** Nothing was removed
  from it, so cancel the upgrade (or run the `ALTER SYSTEM RESET` above) and
  point your applications back.
