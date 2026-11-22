sudo DEBIAN_FRONTEND=noninteractive apt-get update -y || true

sudo DEBIAN_FRONTEND=noninteractive apt-get autoremove --purge -y || true

sudo DEBIAN_FRONTEND=noninteractive apt-get clean -y || true

RC_PACKAGES=$(dpkg -l | awk '/^rc/ {print $2}')
if [ -n "$RC_PACKAGES" ]; then
    sudo DEBIAN_FRONTEND=noninteractive apt-get purge -y $RC_PACKAGES || true
fi

echo "Cleanup completed."
