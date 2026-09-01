if ! output=$(sudo supervisorctl stop {{ $id }}:* 2>&1); then
    echo "$output"
    echo 'VITO_SSH_ERROR' && exit 1
fi
echo "$output"
if echo "$output" | grep ': ERROR' | grep -qvE 'not running'; then
    echo 'VITO_SSH_ERROR' && exit 1
fi
@if (!empty($logFile))
sudo mkdir -p "$(dirname "{{ $logFile }}")"
echo -e "\n======================================================\n[$(date '+%Y-%m-%d %H:%M:%S')] >>> WORKER STOPPED <<<\n======================================================\n" | sudo tee -a "{{ $logFile }}" > /dev/null 2>&1 || true
@if (!empty($user))
sudo chown -R {{ $user }}:{{ $user }} "$(dirname "{{ $logFile }}")" 2>/dev/null || true
sudo chmod 664 "{{ $logFile }}" 2>/dev/null || true
@endif
@endif


