HBA_FILE=$(sudo -u postgres psql -XtAc 'SHOW hba_file')
PG_CONF=$(sudo -u postgres psql -XtAc 'SHOW config_file')
CONF_DIR={!! escapeshellarg($confDirectory) !!}
HBA_TYPE=host
if [ "$(sudo -u postgres psql -XtAc 'SHOW ssl')" = "on" ]; then
    HBA_TYPE=hostssl
fi

sudo cp "$HBA_FILE" "$HBA_FILE.vito-replication.bak"
sudo sed -i '/^# BEGIN VITO REPLICATION$/,/^# END VITO REPLICATION$/d' "$HBA_FILE"
@if ($rules !== [])
[ -n "$(sudo tail -c1 "$HBA_FILE")" ] && printf '\n' | sudo tee -a "$HBA_FILE" > /dev/null || true
{
    echo '# BEGIN VITO REPLICATION'
@foreach ($rules as $rule)
    printf '%s replication %s %s scram-sha-256\n' "$HBA_TYPE" {!! escapeshellarg($rule['username']) !!} {!! escapeshellarg($rule['cidr']) !!}
@endforeach
    echo '# END VITO REPLICATION'
} | sudo tee -a "$HBA_FILE" > /dev/null
@endif

sudo grep -Eq '^[[:space:]]*include_dir[[:space:]]*=' "$PG_CONF" || printf "\ninclude_dir = 'conf.d'\n" | sudo tee -a "$PG_CONF" > /dev/null
sudo mkdir -p "$CONF_DIR"
@if ($walKeepSizeGb)
printf "max_slot_wal_keep_size = '%sGB'\n" {!! (int) $walKeepSizeGb !!} | sudo tee "$CONF_DIR/zz-vito-replication.conf" > /dev/null
@else
sudo rm -f "$CONF_DIR/zz-vito-replication.conf"
@endif

sudo -u postgres psql -XtAc 'SELECT pg_reload_conf()' > /dev/null
sleep 1

if [ "$(sudo -u postgres psql -XtAc 'SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL')" != "0" ]; then
    sudo cp "$HBA_FILE.vito-replication.bak" "$HBA_FILE"
    sudo -u postgres psql -XtAc 'SELECT pg_reload_conf()' > /dev/null
    echo "VITO_SSH_ERROR: pg_hba.conf had errors after the replication change, the previous file was restored"
    exit 1
fi
