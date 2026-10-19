DB_NAME='{{ $database }}'

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME';" | grep -q 1; then
    echo "Database $DB_NAME does not exist, skipping privilege sync."
    exit 0
fi

if ! sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" <<'EOSQL'
DO $$
DECLARE
    db text := current_database();
    major int := current_setting('server_version_num')::int / 10000;
    owner_role text;
    scrub_users text[] := ARRAY[@foreach ($scrubUsers as $scrubUser)'{{ $scrubUser }}'@if (! $loop->last), @endif @endforeach]::text[];
    revoke_creators text[] := ARRAY[@foreach ($revokeCreators as $revokeCreator)'{{ $revokeCreator }}'@if (! $loop->last), @endif @endforeach]::text[];
    grant_creators text[] := ARRAY[@foreach ($grantCreators as $grantCreator)'{{ $grantCreator }}'@if (! $loop->last), @endif @endforeach]::text[];
    grant_users text[] := ARRAY[@foreach ($users as $user)'{{ $user['username'] }}:{{ $user['permission'] }}'@if (! $loop->last), @endif @endforeach]::text[];
    scrub_user text;
    creator text;
    entry text;
    grantee text;
    permission text;
    table_privileges text;
    sequence_privileges text;
    function_privileges text;
    database_privileges text;
BEGIN
    SELECT pg_catalog.pg_get_userbyid(datdba) INTO owner_role FROM pg_catalog.pg_database WHERE datname = db;

    FOREACH scrub_user IN ARRAY scrub_users LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = scrub_user) THEN
            EXECUTE format('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM %I CASCADE', scrub_user);
            EXECUTE format('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM %I CASCADE', scrub_user);
            EXECUTE format('REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM %I CASCADE', scrub_user);
            EXECUTE format('REVOKE ALL PRIVILEGES ON DATABASE %I FROM %I CASCADE', db, scrub_user);
            EXECUTE format('REVOKE ALL ON SCHEMA public FROM %I CASCADE', scrub_user);

            FOREACH creator IN ARRAY revoke_creators LOOP
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = creator) THEN
                    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM %I', creator, scrub_user);
                    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', creator, scrub_user);
                    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', creator, scrub_user);
                END IF;
            END LOOP;

            IF owner_role IS NOT NULL AND owner_role <> '' THEN
                EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM %I', owner_role, scrub_user);
                EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', owner_role, scrub_user);
                EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', owner_role, scrub_user);
            END IF;
        END IF;
    END LOOP;

    FOREACH entry IN ARRAY grant_users LOOP
        grantee := split_part(entry, ':', 1);
        permission := split_part(entry, ':', 2);

        IF permission = 'read' THEN
            table_privileges := 'SELECT';
            sequence_privileges := 'SELECT';
            function_privileges := '';
            database_privileges := 'CONNECT';
        ELSIF permission = 'write' THEN
            table_privileges := 'SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER';
            sequence_privileges := 'USAGE, SELECT, UPDATE';
            function_privileges := 'EXECUTE';
            database_privileges := 'CONNECT';
        ELSE
            table_privileges := 'ALL PRIVILEGES';
            sequence_privileges := 'ALL PRIVILEGES';
            function_privileges := 'ALL PRIVILEGES';
            database_privileges := 'ALL PRIVILEGES';
        END IF;

        EXECUTE format('GRANT %s ON DATABASE %I TO %I', database_privileges, db, grantee);

        IF permission = 'read' THEN
            EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', grantee);
        ELSIF permission = 'write' THEN
            EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', grantee);
            IF major >= 15 THEN
                EXECUTE format('GRANT CREATE ON SCHEMA public TO %I', grantee);
            END IF;
        ELSIF major >= 15 THEN
            EXECUTE format('GRANT USAGE, CREATE ON SCHEMA public TO %I', grantee);
        END IF;

        EXECUTE format('GRANT %s ON ALL TABLES IN SCHEMA public TO %I', table_privileges, grantee);
        EXECUTE format('GRANT %s ON ALL SEQUENCES IN SCHEMA public TO %I', sequence_privileges, grantee);
        IF function_privileges <> '' THEN
            EXECUTE format('GRANT %s ON ALL FUNCTIONS IN SCHEMA public TO %I', function_privileges, grantee);
        END IF;

        FOREACH creator IN ARRAY grant_creators LOOP
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT %s ON TABLES TO %I', creator, table_privileges, grantee);
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT %s ON SEQUENCES TO %I', creator, sequence_privileges, grantee);
            IF function_privileges <> '' THEN
                EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT %s ON FUNCTIONS TO %I', creator, function_privileges, grantee);
            END IF;
        END LOOP;

        IF owner_role IS NOT NULL AND owner_role <> '' THEN
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT %s ON TABLES TO %I', owner_role, table_privileges, grantee);
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT %s ON SEQUENCES TO %I', owner_role, sequence_privileges, grantee);
            IF function_privileges <> '' THEN
                EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT %s ON FUNCTIONS TO %I', owner_role, function_privileges, grantee);
            END IF;
        END IF;
    END LOOP;
END $$;
EOSQL
then
    echo 'VITO_SSH_ERROR' && exit 1
fi

echo "Privileges synced for $DB_NAME"
