@php
    $key = \phpseclib3\Crypt\PublicKeyLoader::loadPublicKey($key)->toString('OpenSSH');
@endphp
set -eu
umask 077
if [ -f "$HOME/.ssh/authorized_keys" ]; then
    exec 9>"$HOME/.ssh/.vito-authorized-keys.lock"
    flock -x 9
    VITO_KEYS_TEMP=$(mktemp "$HOME/.ssh/authorized_keys.XXXXXX")
    trap 'rm -f "$VITO_KEYS_TEMP"' EXIT
    awk -v key={!! escapeshellarg(explode(' ', trim($key))[1]) !!} '{ keep=1; for (i=1; i<=NF; i++) if ($i == key) keep=0; if (keep) print }' "$HOME/.ssh/authorized_keys" > "$VITO_KEYS_TEMP"
    chmod 600 "$VITO_KEYS_TEMP"
    mv "$VITO_KEYS_TEMP" "$HOME/.ssh/authorized_keys"
fi
