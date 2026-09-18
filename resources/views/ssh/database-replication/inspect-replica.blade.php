if sudo -u postgres pg_isready -q; then
    echo "VITO_DATA_DIRECTORY=$(sudo -u postgres psql -XtAc 'SHOW data_directory')"
    echo "VITO_PORT=$(sudo -u postgres psql -XtAc 'SHOW port')"
    echo "VITO_VERSION_NUM=$(sudo -u postgres psql -XtAc 'SHOW server_version_num')"
else
    CLUSTER=$(pg_lsclusters -h 2>/dev/null | head -n 1)
    DATA_DIRECTORY=$(echo "$CLUSTER" | awk '{print $6}')
    if [ -z "$DATA_DIRECTORY" ]; then
        echo "VITO_SSH_ERROR: no PostgreSQL cluster was found on the replica server"
        exit 1
    fi
    echo "VITO_DATA_DIRECTORY=$DATA_DIRECTORY"
    echo "VITO_PORT=$(echo "$CLUSTER" | awk '{print $3}')"
    echo "VITO_VERSION_NUM=$(( $(echo "$CLUSTER" | awk '{print $1}' | cut -d. -f1) * 10000 ))"
fi
