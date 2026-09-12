if ! sudo -u postgres psql <<'EOSQL'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{{ $username }}') THEN
        CREATE ROLE "{{ $username }}" WITH LOGIN PASSWORD '{{ $password }}';
    ELSE
        ALTER ROLE "{{ $username }}" WITH LOGIN PASSWORD '{{ $password }}';
    END IF;
END $$;
EOSQL
then
    echo 'VITO_SSH_ERROR' && exit 1
fi

echo "User {{ $username }} created"
