if ! sudo supervisorctl stop {{ $id }}:*; then
    echo 'VITO_SSH_ERROR' && exit 1
fi

if ! sudo rm -f {!! escapeshellarg($logFile) !!}; then
    echo 'VITO_SSH_ERROR' && exit 1
fi

if ! sudo rm -rf /etc/supervisor/conf.d/{{ $id }}.conf; then
    echo 'VITO_SSH_ERROR' && exit 1
fi

if ! sudo supervisorctl reread; then
    echo 'VITO_SSH_ERROR' && exit 1
fi

if ! sudo supervisorctl update; then
    echo 'VITO_SSH_ERROR' && exit 1
fi
