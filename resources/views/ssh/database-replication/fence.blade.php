echo "Fencing the old primary: stopping PostgreSQL, WAL archiving and the pgBackRest TLS server"
printf "archive_mode = off\narchive_command = '/bin/true'\n" | sudo tee {!! escapeshellarg($confDirectory.'/zz-vito-pgbackrest.conf') !!} > /dev/null
sudo systemctl disable --now vito-pgbackrest-server > /dev/null 2>&1 || true
sudo systemctl stop postgresql
sudo systemctl mask {!! escapeshellarg('postgresql@'.$version.'-main') !!} > /dev/null
sudo systemctl disable postgresql > /dev/null 2>&1 || true
