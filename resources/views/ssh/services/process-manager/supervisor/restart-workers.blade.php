if ! sudo supervisorctl reread; then
    echo 'VITO_SSH_ERROR' && exit 1
fi
@foreach ($ids as $id)
if ! sudo supervisorctl update {{ (int) $id }}; then
    echo 'VITO_SSH_ERROR' && exit 1
fi
sudo supervisorctl stop {{ (int) $id }}:* > /dev/null 2>&1 || true
echo -e "\n======================================================\n[$(date '+%Y-%m-%d %H:%M:%S')] >>> WORKER RESTARTED <<<\n======================================================\n" | sudo tee -a /home/*/.logs/workers/{{ (int) $id }}.log /root/.logs/workers/{{ (int) $id }}.log > /dev/null 2>&1 || true
@endforeach
if ! output=$(sudo supervisorctl start {{ collect($ids)->map(fn ($id) => (int) $id.':*')->implode(' ') }} 2>&1); then
    echo "$output"
    echo 'VITO_SSH_ERROR' && exit 1
fi
echo "$output"
if echo "$output" | grep ': ERROR' | grep -qvE 'already started|not running'; then
    echo 'VITO_SSH_ERROR' && exit 1
fi
