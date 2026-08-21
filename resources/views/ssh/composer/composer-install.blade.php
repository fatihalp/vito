if ! cd "{{ $path }}"; then
    echo 'VITO_SSH_ERROR' && exit 1
fi

if ! {{ $command }}; then
    echo 'VITO_SSH_ERROR' && exit 1
fi
