CONF_DIR={!! escapeshellarg($confDirectory) !!}
PG_CONF=$(sudo -u postgres psql -XtAc 'SHOW config_file')

sudo grep -Eq '^[[:space:]]*include_dir[[:space:]]*=' "$PG_CONF" || printf "\ninclude_dir = 'conf.d'\n" | sudo tee -a "$PG_CONF" > /dev/null
sudo mkdir -p "$CONF_DIR"

{
    echo "max_worker_processes = {{ (int) $processes }}"
    echo "max_logical_replication_workers = {{ (int) $workers }}"
    echo "max_replication_slots = {{ (int) $slots }}"
    echo "max_sync_workers_per_subscription = 2"
} | sudo tee "$CONF_DIR/zz-vito-upgrade.conf" > /dev/null
sudo chmod 644 "$CONF_DIR/zz-vito-upgrade.conf"
sudo -u postgres psql -XtAc 'SELECT pg_reload_conf()' > /dev/null

echo "VITO_MAX_WORKER_PROCESSES=$(sudo -u postgres psql -XtAc 'SHOW max_worker_processes')"
echo "VITO_MAX_LOGICAL_REPLICATION_WORKERS=$(sudo -u postgres psql -XtAc 'SHOW max_logical_replication_workers')"
echo "VITO_MAX_REPLICATION_SLOTS=$(sudo -u postgres psql -XtAc 'SHOW max_replication_slots')"
