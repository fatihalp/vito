TARGET={!! escapeshellarg($path) !!}
if [ -z "$TARGET" ] || [ "${TARGET#/}" = "$TARGET" ]; then
    echo 'VITO_SSH_ERROR: An absolute deletion path is required' && exit 1
fi
RESOLVED=$(realpath -m -- "$TARGET") || { echo 'VITO_SSH_ERROR: Invalid deletion path'; exit 1; }
case "$RESOLVED" in
    /|/bin|/boot|/dev|/etc|/home|/lib|/lib64|/media|/mnt|/opt|/proc|/root|/run|/sbin|/srv|/sys|/tmp|/usr|/var|/var/lib|/var/log|/var/www|/boot/*|/dev/*|/proc/*|/sys/*|/usr/*|/var/lib/*)
        echo 'VITO_SSH_ERROR: Refusing to delete a protected system path' && exit 1
        ;;
esac
if ! rm -rf -- "$TARGET"; then
    echo 'VITO_SSH_ERROR: Failed to delete path' && exit 1
fi
