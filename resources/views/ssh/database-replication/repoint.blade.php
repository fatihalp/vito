CONF_DIR={!! escapeshellarg($confDirectory) !!}

sudo sed -i '/^[[:space:]]*primary_conninfo[[:space:]]*=/d; /^[[:space:]]*primary_slot_name[[:space:]]*=/d' "$CONF_DIR/zz-vito-replica.conf"
printf "primary_conninfo = '%s'\nprimary_slot_name = '%s'\n" {!! escapeshellarg($conninfo) !!} {!! escapeshellarg($slot) !!} | sudo tee -a "$CONF_DIR/zz-vito-replica.conf" > /dev/null
sudo -u postgres psql -XtAc 'SELECT pg_reload_conf()' > /dev/null
