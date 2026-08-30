if ! sudo supervisorctl update; then
    echo 'VITO_SSH_ERROR' && exit 1
fi

sudo supervisorctl stop all > /dev/null 2>&1 || true
sudo truncate -s 0 /home/*/.logs/workers/*.log /root/.logs/workers/*.log 2>/dev/null || true

if ! sudo supervisorctl start all; then
    echo 'VITO_SSH_ERROR' && exit 1
fi

echo "All workers restarted successfully."
