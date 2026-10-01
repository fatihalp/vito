set -e
set -o pipefail

STATE={!! escapeshellarg($state) !!}
ROLES={!! escapeshellarg($rolesPath) !!}
PUB={!! escapeshellarg($publication) !!}
PG_DUMP=/usr/lib/postgresql/{{ (int) $version }}/bin/pg_dump
[ -x "$PG_DUMP" ] || PG_DUMP=pg_dump

sudo install -d -m 700 -o postgres -g postgres "$STATE"

echo "Copying the roles of the old server"
sudo -u postgres psql -X -q -f "$ROLES" 2>&1 | sed -E "s/PASSWORD '[^']*'/PASSWORD '<redacted>'/g" | grep -vi 'already exists' || true
sudo rm -f "$ROLES"

sudo -u postgres psql -XtAq -d {!! escapeshellarg($databases[0]['conninfo']) !!} -v user={!! escapeshellarg($username) !!} > "$STATE/roles.txt" <<'VITO_SQL'
SELECT rolname FROM pg_roles WHERE rolname NOT LIKE 'pg\_%' AND rolname <> :'user' ORDER BY rolname;
VITO_SQL
while IFS= read -r ROLE; do
    [ -z "$ROLE" ] && continue
    HAS_ROLE=$(sudo -u postgres psql -XtAq -v role="$ROLE" <<'VITO_SQL'
SELECT 1 FROM pg_roles WHERE rolname = :'role';
VITO_SQL
)
    if [ "$HAS_ROLE" != "1" ]; then
        echo "ERROR: the role $ROLE of the old server was not created on this server"
        exit 1
    fi
done < "$STATE/roles.txt"
rm -f "$STATE/roles.txt"

prepare_database() {
    DB="$1"
    SUB="$2"
    CONN="$3"

    if [ -f "$STATE/$SUB.subscribed" ]; then
        echo "The database $DB is already being copied"
        return 0
    fi

    EXISTS=$(sudo -u postgres psql -XtAq -v db="$DB" <<'VITO_SQL'
SELECT 1 FROM pg_database WHERE datname = :'db';
VITO_SQL
)

    if [ "$EXISTS" = "1" ] && [ ! -f "$STATE/$SUB.created" ]; then
        echo "ERROR: a database named $DB already exists on this server and was not created by this upgrade"
        exit 1
    fi

    if [ "$EXISTS" = "1" ]; then
        echo "Removing the unfinished copy of $DB"
        sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -v db="$DB" <<'VITO_SQL'
DROP DATABASE IF EXISTS :"db" WITH (FORCE);
VITO_SQL
        rm -f "$STATE/$SUB.created" "$STATE/$SUB.schema"
    fi

    echo "Creating the database $DB"
    DDL=$(sudo -u postgres psql -XtAq -v ON_ERROR_STOP=1 -d "$CONN" <<'VITO_SQL'
SELECT format('CREATE DATABASE %I WITH OWNER %I TEMPLATE template0 ENCODING %L LC_COLLATE %L LC_CTYPE %L%s',
    d.datname, pg_get_userbyid(d.datdba), pg_encoding_to_char(d.encoding), d.datcollate, d.datctype,
    CASE WHEN to_jsonb(d) ->> 'datlocprovider' = 'i'
        THEN format(' LOCALE_PROVIDER icu ICU_LOCALE %L', coalesce(to_jsonb(d) ->> 'datlocale', to_jsonb(d) ->> 'daticulocale'))
        ELSE '' END)
FROM pg_database d WHERE d.datname = current_database();
VITO_SQL
)
    sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -c "$DDL"
    touch "$STATE/$SUB.created"

    echo "Copying the schema of $DB"
    sudo -u postgres "$PG_DUMP" -d "$CONN" --schema-only --no-publications --no-subscriptions --quote-all-identifiers \
        | sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$DB" > /dev/null
    touch "$STATE/$SUB.schema"

    echo "Subscribing to the changes of $DB"
    sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -v sub="$SUB" -v conn="$CONN" -v pub="$PUB" > /dev/null <<'VITO_SQL'
CREATE SUBSCRIPTION :"sub" CONNECTION :'conn' PUBLICATION :"pub" WITH ({!! $options !!});
VITO_SQL
    touch "$STATE/$SUB.subscribed"

    echo "The first copy of $DB started"
}

@foreach ($databases as $database)
prepare_database {!! escapeshellarg($database['name']) !!} {!! escapeshellarg($database['subscription']) !!} {!! escapeshellarg($database['conninfo']) !!}
@endforeach

echo "Every database is copying now"
