set -euo pipefail

OLD={{ (int) $oldVersion }}
NEW={{ (int) $newVersion }}
PGDATA="/var/lib/postgresql/$OLD/main"

echo "Installing PostgreSQL $OLD so the backup can be restored in its own format"
export DEBIAN_FRONTEND=noninteractive
apt-get install -y "postgresql-$OLD" > /dev/null

cluster_exists() {
    pg_lsclusters -h | awk -v v="$1" '$1 == v && $2 == "main"' | grep -q .
}

{{-- The new version's cluster is empty — Vito has just installed it — and pg_upgradecluster creates it again from the
     restored one. Dropping it first also frees port 5432, so the old cluster is the only one answering there and every
     tool below talks to the copy rather than to an empty cluster. --}}
echo "Making room for the copy"
systemctl stop postgresql

if cluster_exists "$NEW"; then
    pg_dropcluster --stop "$NEW" main
fi

{{-- A cluster left behind by an attempt that stopped halfway holds the wrong port and an empty data directory. --}}
if cluster_exists "$OLD" && [ "$(pg_lsclusters -h | awk -v v="$OLD" '$1 == v {print $3}')" != "5432" ]; then
    pg_dropcluster --stop "$OLD" main
fi

if ! cluster_exists "$OLD"; then
    pg_createcluster --port 5432 "$OLD" main > /dev/null
fi

PORT=$(pg_lsclusters -h | awk -v v="$OLD" '$1 == v {print $3}')
if [ "$PORT" != "5432" ]; then
    echo "ERROR: the PostgreSQL $OLD cluster answers on $PORT instead of 5432"
    exit 1
fi

@include('ssh.pgbackrest.restore', [
    'dataDirectory' => '/var/lib/postgresql/'.((int) $oldVersion).'/main',
    'confDirectory' => '/etc/postgresql/'.((int) $oldVersion).'/main/conf.d',
    'version' => (int) $oldVersion,
    'stanza' => $stanza,
    'options' => '--type=lsn --target='.escapeshellarg($lsn).' --target-action=promote',
    'label' => 'the backup up to '.$lsn,
])

echo "Upgrading the copy from $OLD to $NEW"
pg_ctlcluster "$OLD" main stop
pg_upgradecluster --method=upgrade --link "$OLD" main

echo "Starting PostgreSQL $NEW"
pg_ctlcluster "$NEW" main start 2>/dev/null || true
for ATTEMPT in $(seq 1 30); do
    sudo -u postgres pg_isready -q && break
    sleep 2
done
sudo -u postgres pg_isready -q

{{-- The old files are hard links into the new cluster now; starting that cluster again would corrupt both. --}}
pg_dropcluster --stop "$OLD" main
apt-get -y remove "postgresql-$OLD" > /dev/null || true

echo "Removing what belonged to the old server"
sudo -u postgres psql -X -q -c "ALTER SYSTEM RESET default_transaction_read_only" > /dev/null
@foreach ($databases as $database)
sudo -u postgres psql -X -q -d {!! escapeshellarg($database['name']) !!} -v pub={!! escapeshellarg($publication) !!} > /dev/null 2>&1 <<'VITO_SQL' || true
DROP PUBLICATION IF EXISTS :"pub";
VITO_SQL
@endforeach
sudo -u postgres psql -XtAc 'SELECT pg_reload_conf()' > /dev/null

echo "Collecting statistics for the planner"
sudo -u postgres vacuumdb --all --analyze-in-stages > /dev/null 2>&1 || true

echo "The copy is on PostgreSQL $NEW and ready to catch up"
