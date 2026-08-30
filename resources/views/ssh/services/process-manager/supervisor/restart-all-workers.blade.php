if ! sudo supervisorctl update; then
    echo 'VITO_SSH_ERROR' && exit 1
fi

sudo supervisorctl clear all > /dev/null 2>&1 || true

if ! sudo supervisorctl restart all; then
    echo 'VITO_SSH_ERROR' && exit 1
fi

echo "All workers restarted successfully."
