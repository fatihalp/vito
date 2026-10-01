STATE={!! escapeshellarg($state) !!}
sudo install -d -m 700 -o postgres -g postgres "$STATE"

drop_subscription() {
    DB="$1"
    SUB="$2"

    sudo -u postgres psql -X -q -d "$DB" -c "ALTER SUBSCRIPTION :\"sub\" DISABLE" -v sub="$SUB" > /dev/null 2>&1 || true

    if ! sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -c "DROP SUBSCRIPTION :\"sub\"" -v sub="$SUB" > /dev/null 2>&1; then
        sudo -u postgres psql -X -q -d "$DB" -c "ALTER SUBSCRIPTION :\"sub\" SET (slot_name = NONE)" -v sub="$SUB" > /dev/null 2>&1 || true
        sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -c "DROP SUBSCRIPTION IF EXISTS :\"sub\"" -v sub="$SUB" > /dev/null
    fi
}

@foreach ($databases as $database)
@if ($sequences)
sudo -u postgres psql -XtAq -v ON_ERROR_STOP=1 -d {!! escapeshellarg($database['conninfo']) !!} -c "
    SELECT format('SELECT pg_catalog.setval(%L, %s, true);', quote_ident(schemaname) || '.' || quote_ident(sequencename), last_value)
    FROM pg_sequences WHERE last_value IS NOT NULL" | sudo -u postgres tee "$STATE/sequences.sql" > /dev/null
sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d {!! escapeshellarg($database['name']) !!} -f "$STATE/sequences.sql" > /dev/null
echo "Copied the sequence values of {{ $database['name'] }}"
@endif
drop_subscription {!! escapeshellarg($database['name']) !!} {!! escapeshellarg($database['subscription']) !!}
echo "Stopped replicating {{ $database['name'] }}"
@endforeach

sudo rm -rf "$STATE" {!! escapeshellarg($passfile) !!} {!! escapeshellarg($confDirectory.'/zz-vito-upgrade.conf') !!}
sudo -u postgres psql -XtAc 'SELECT pg_reload_conf()' > /dev/null
