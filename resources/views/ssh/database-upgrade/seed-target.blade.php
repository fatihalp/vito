set -euo pipefail

OLD={{ (int) $oldVersion }}
NEW={{ (int) $newVersion }}
PGDATA="/var/lib/postgresql/$OLD/main"

echo "Installing PostgreSQL $OLD so the backup can be restored in its own format"
export DEBIAN_FRONTEND=noninteractive
apt-get install -y "postgresql-$OLD" > /dev/null

echo "Clearing the PostgreSQL $OLD cluster"
pg_ctlcluster "$OLD" main stop 2>/dev/null || true
if [ ! -d "$PGDATA" ]; then
    echo "ERROR: $PGDATA does not exist after installing postgresql-$OLD"
    exit 1
fi
find "$PGDATA" -mindepth 1 -delete

echo "Restoring the backup up to {!! $lsn !!}"
sudo -u postgres pgbackrest --stanza={!! escapeshellarg($stanza) !!} --pg1-path="$PGDATA" \
    --archive-mode=off --type=lsn --target={!! escapeshellarg($lsn) !!} --target-action=promote restore

{{-- Recovery stops at the target, so the copy holds exactly what the slot will continue from. --}}
echo "Starting PostgreSQL $OLD to finish recovery"
pg_ctlcluster "$OLD" main start
for ATTEMPT in $(seq 1 {{ (int) $attempts }}); do
    IN_RECOVERY=$(sudo -u postgres psql -p "$(pg_lsclusters -h | awk -v v="$OLD" '$1 == v {print $3}')" -XtAc 'SELECT pg_is_in_recovery()' 2>/dev/null || echo t)
    [ "$IN_RECOVERY" = "f" ] && break
    sleep 10
done

if [ "$IN_RECOVERY" != "f" ]; then
    echo "ERROR: PostgreSQL $OLD did not finish recovery at the target position"
    exit 1
fi

echo "The copy is at the position the slot continues from"
pg_ctlcluster "$OLD" main stop

echo "Upgrading the copy from $OLD to $NEW"
pg_dropcluster "$NEW" main --stop
pg_upgradecluster --method=upgrade --link "$OLD" main

echo "Starting PostgreSQL $NEW"
pg_ctlcluster "$NEW" main start 2>/dev/null || true
pg_isready -q || sleep 5

{{-- The old files are hard links into the new cluster now; starting that cluster again would corrupt both. --}}
pg_dropcluster "$OLD" main --stop
apt-get -y remove "postgresql-$OLD" > /dev/null || true

echo "Removing what belonged to the old server"
sudo -u postgres psql -X -q -c "ALTER SYSTEM RESET archive_command" > /dev/null
sudo -u postgres psql -X -q -c "ALTER SYSTEM RESET archive_mode" > /dev/null
sudo -u postgres psql -X -q -c "ALTER SYSTEM RESET default_transaction_read_only" > /dev/null
rm -f /etc/pgbackrest/pgbackrest.conf
@foreach ($databases as $database)
sudo -u postgres psql -X -q -d {!! escapeshellarg($database['name']) !!} -v pub={!! escapeshellarg($publication) !!} > /dev/null 2>&1 <<'VITO_SQL' || true
DROP PUBLICATION IF EXISTS :"pub";
VITO_SQL
@endforeach
systemctl restart "postgresql@$NEW-main"

echo "Collecting statistics for the planner"
sudo -u postgres vacuumdb --all --analyze-in-stages > /dev/null 2>&1 || true

echo "The copy is on PostgreSQL $NEW and ready to catch up"
