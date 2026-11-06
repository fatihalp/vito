@php
    $key = \phpseclib3\Crypt\PublicKeyLoader::loadPublicKey($key)->toString('OpenSSH');
@endphp
set -eu
umask 077
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
exec 9>"$HOME/.ssh/.vito-authorized-keys.lock"
flock -x 9
touch "$HOME/.ssh/authorized_keys"
if ! awk -v key={!! escapeshellarg(explode(' ', trim($key))[1]) !!} '{ for (i=1; i<=NF; i++) if ($i == key) found=1 } END { exit !found }' "$HOME/.ssh/authorized_keys"; then
    printf '%s\n' {!! escapeshellarg(trim($key)) !!} >> "$HOME/.ssh/authorized_keys"
fi
chmod 600 "$HOME/.ssh/authorized_keys"
