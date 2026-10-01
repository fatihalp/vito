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

    # Grants and settings on the database itself are not part of a schema dump: without them an application can find
    # its tables there and still be refused at the door.
    echo "Copying the grants and settings of $DB"
    sudo -u postgres psql -XtAq -v ON_ERROR_STOP=1 -d "$CONN" <<'VITO_SQL' | sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$DB" > /dev/null
SELECT format('GRANT %s ON DATABASE %I TO %s;', a.privilege_type, d.datname,
    CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END)
FROM pg_database d, aclexplode(d.datacl) a
WHERE d.datname = current_database()
UNION ALL
SELECT CASE WHEN s.setrole = 0
    THEN format('ALTER DATABASE %I SET %s = %L;', d.datname, split_part(c, '=', 1), substr(c, strpos(c, '=') + 1))
    ELSE format('ALTER ROLE %I IN DATABASE %I SET %s = %L;', pg_get_userbyid(s.setrole), d.datname, split_part(c, '=', 1), substr(c, strpos(c, '=') + 1))
    END
FROM pg_db_role_setting s
JOIN pg_database d ON d.oid = s.setdatabase
CROSS JOIN unnest(s.setconfig) c
WHERE d.datname = current_database();
VITO_SQL

    echo "Copying the schema of $DB"
    sudo -u postgres "$PG_DUMP" -d "$CONN" --schema-only --no-publications --no-subscriptions --quote-all-identifiers \
        | sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$DB" > /dev/null
    touch "$STATE/$SUB.schema"

    # Every index the copy would have to maintain row by row is put aside and built once at the end instead. Primary
    # keys, unique and exclusion indexes stay: they carry meaning, and the apply worker uses them to find rows.
    INDEX_FILE="/var/lib/postgresql/$SUB-indexes.sql"
    sudo -u postgres psql -XtAq -v ON_ERROR_STOP=1 -d "$DB" > /tmp/$SUB-indexes.sql <<'VITO_SQL'
SELECT pg_get_indexdef(c.oid) || ';'
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_index i ON i.indexrelid = c.oid
WHERE c.relkind = 'i' AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND NOT i.indisprimary AND NOT i.indisunique
    AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = c.oid);
VITO_SQL
    sed -E 's/^CREATE INDEX /CREATE INDEX CONCURRENTLY IF NOT EXISTS /' /tmp/$SUB-indexes.sql | sudo -u postgres tee "$INDEX_FILE" > /dev/null
    rm -f /tmp/$SUB-indexes.sql

    sudo -u postgres psql -XtAq -v ON_ERROR_STOP=1 -d "$DB" <<'VITO_SQL' | sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$DB" > /dev/null
SELECT format('DROP INDEX %I.%I;', n.nspname, c.relname)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_index i ON i.indexrelid = c.oid
WHERE c.relkind = 'i' AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND NOT i.indisprimary AND NOT i.indisunique
    AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = c.oid);
VITO_SQL
    echo "Set $(grep -c 'CREATE INDEX' "$INDEX_FILE" || true) indexes of $DB aside until the rows are there"

    echo "Subscribing to the changes of $DB"
    sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -v sub="$SUB" -v conn="$CONN" -v pub="$PUB" > /dev/null <<'VITO_SQL'
CREATE SUBSCRIPTION :"sub" CONNECTION :'conn' PUBLICATION :"pub" WITH ({!! $options !!});
VITO_SQL
    touch "$STATE/$SUB.subscribed"

    echo "The first copy of $DB started"
}

wait_for_copy() {
    DB="$1"
    SUB="$2"

    echo "Waiting for the first copy of $DB"
    while true; do
        PENDING=$(sudo -u postgres psql -XtAq -d "$DB" -c "SELECT count(*) FROM pg_subscription_rel WHERE srsubstate <> 'r'")
        [ "$PENDING" = "0" ] && break
        echo "$DB: $PENDING tables still copying"
        sleep 15
    done
    echo "The first copy of $DB is done"
}

# Concurrently, because an ordinary index build locks the table against the rows still arriving, and everything the
# apply worker cannot write is WAL the old server has to keep. It costs two table scans instead of one; it buys an old
# server that keeps releasing WAL while the new one builds.
build_indexes() {
    DB="$1"
    SUB="$2"
    INDEX_FILE="/var/lib/postgresql/$SUB-indexes.sql"

    if [ -s "$INDEX_FILE" ]; then
        # A concurrent build that was interrupted leaves an index behind that is invalid and never used again.
        sudo -u postgres psql -XtAq -v ON_ERROR_STOP=1 -d "$DB" <<'VITO_SQL' | sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$DB" > /dev/null
SELECT format('DROP INDEX %I.%I;', n.nspname, c.relname)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_index i ON i.indexrelid = c.oid
WHERE c.relkind = 'i' AND NOT i.indisvalid AND n.nspname NOT IN ('pg_catalog', 'information_schema');
VITO_SQL

        echo "Building $(grep -c 'CREATE INDEX' "$INDEX_FILE" || true) indexes of $DB while the rows keep arriving"
        sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$INDEX_FILE" > /dev/null

        UNFINISHED=$(sudo -u postgres psql -XtAq -d "$DB" -c "SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE NOT i.indisvalid AND n.nspname NOT IN ('pg_catalog', 'information_schema')")
        if [ "$UNFINISHED" != "0" ]; then
            echo "ERROR: $UNFINISHED indexes of $DB could not be built; run this again once the cause is gone"
            exit 1
        fi
    fi

    sudo -u postgres psql -X -q -d "$DB" -c 'ANALYZE' > /dev/null
    sudo rm -f "$INDEX_FILE"
    echo "$DB is ready"
}

@foreach ($databases as $database)
prepare_database {!! escapeshellarg($database['name']) !!} {!! escapeshellarg($database['subscription']) !!} {!! escapeshellarg($database['conninfo']) !!}
@endforeach

echo "Every database is copying now"

@foreach ($databases as $database)
wait_for_copy {!! escapeshellarg($database['name']) !!} {!! escapeshellarg($database['subscription']) !!}
@endforeach

@foreach ($databases as $database)
build_indexes {!! escapeshellarg($database['name']) !!} {!! escapeshellarg($database['subscription']) !!}
@endforeach

echo "Every database is copied and indexed"
