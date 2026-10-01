STATE={!! escapeshellarg($state) !!}

drop_subscription() {
    DB="$1"
    SUB="$2"

    sudo -u postgres psql -X -q -d "$DB" -v sub="$SUB" > /dev/null 2>&1 <<'VITO_SQL' || true
ALTER SUBSCRIPTION :"sub" DISABLE;
VITO_SQL

    if ! sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -v sub="$SUB" > /dev/null 2>&1 <<'VITO_SQL'
DROP SUBSCRIPTION :"sub";
VITO_SQL
    then
        sudo -u postgres psql -X -q -d "$DB" -v sub="$SUB" > /dev/null 2>&1 <<'VITO_SQL' || true
ALTER SUBSCRIPTION :"sub" SET (slot_name = NONE);
VITO_SQL
        sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -v sub="$SUB" > /dev/null <<'VITO_SQL'
DROP SUBSCRIPTION IF EXISTS :"sub";
VITO_SQL
    fi
}

@foreach ($databases as $database)
@if ($sequences)
{{-- Straight from one server into the other: /var/lib/vito belongs to root, and postgres cannot write a file there. --}}
sudo -u postgres psql -XtAq -v ON_ERROR_STOP=1 -d {!! escapeshellarg($database['conninfo']) !!} <<'VITO_SQL' | sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d {!! escapeshellarg($database['name']) !!} > /dev/null
SELECT format('SELECT pg_catalog.setval(%L, %s, true);', quote_ident(schemaname) || '.' || quote_ident(sequencename), last_value)
FROM pg_sequences WHERE last_value IS NOT NULL;
VITO_SQL
echo "Copied the sequence values of {{ $database['name'] }}"
@endif
drop_subscription {!! escapeshellarg($database['name']) !!} {!! escapeshellarg($database['subscription']) !!}
echo "Stopped replicating {{ $database['name'] }}"
@endforeach

sudo rm -rf "$STATE" {!! escapeshellarg($passfile) !!} {!! escapeshellarg($confDirectory.'/zz-vito-upgrade.conf') !!}
sudo -u postgres psql -XtAc 'SELECT pg_reload_conf()' > /dev/null
