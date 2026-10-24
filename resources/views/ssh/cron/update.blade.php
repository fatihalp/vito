if ! echo {!! escapeshellarg($cron) !!} | sudo -u {!! escapeshellarg($user) !!} crontab -; then
    echo 'VITO_SSH_ERROR' && exit 1
fi

if ! sudo -u {!! escapeshellarg($user) !!} crontab -l; then
    echo 'VITO_SSH_ERROR' && exit 1
fi

echo 'cron updated!'
