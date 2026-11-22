sudo supervisorctl stop {{ $id }}:* || true

if ! sudo rm -f {!! escapeshellarg($logFile) !!}; then
    echo 'VITO_SSH_ERROR' && exit 1
fi

if ! sudo rm -rf /etc/supervisor/conf.d/{{ $id }}.conf; then
    echo 'VITO_SSH_ERROR' && exit 1
fi

if sudo supervisorctl pid > /dev/null 2>&1; then
    if sudo supervisorctl reread; then
        sudo supervisorctl update {{ $id }} || sudo supervisorctl remove {{ $id }} || true
    else
        sudo supervisorctl remove {{ $id }} || true
    fi
fi
