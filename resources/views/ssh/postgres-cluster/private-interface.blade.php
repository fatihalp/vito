ADDRESS={!! escapeshellarg($address) !!}

has_address() {
    ip -o -4 addr show | awk '{print $4}' | cut -d/ -f1 | grep -qxF "$ADDRESS"
}

if has_address; then
    echo "VITO_PRIVATE_ADDRESS=present"
    exit 0
fi

CONFIGURED=""

for DEVICE in /sys/class/net/*; do
    NAME=$(basename "$DEVICE")

    if [ ! -e "$DEVICE/device" ] || ip -o -4 addr show dev "$NAME" | grep -q ' inet '; then
        continue
    fi

    sudo tee "/etc/systemd/network/60-vito-private-$NAME.network" > /dev/null <<VITO_NETWORK
[Match]
Name=$NAME

[Network]
DHCP=ipv4
LinkLocalAddressing=no

[DHCPv4]
UseDNS=false
UseGateway=false
UseHostname=false
VITO_NETWORK
    CONFIGURED="$CONFIGURED $NAME"
done

if [ -z "$CONFIGURED" ]; then
    ip -br addr
    echo "VITO_SSH_ERROR: no unconfigured network interface was found for the private address $ADDRESS. Restart the server so it applies the provider's network configuration, then retry."
    exit 1
fi

sudo networkctl reload

for NAME in $CONFIGURED; do
    sudo networkctl reconfigure "$NAME"
done

for ATTEMPT in $(seq 1 30); do
    if has_address; then
        echo "VITO_PRIVATE_ADDRESS=configured on$CONFIGURED"
        exit 0
    fi

    sleep 1
done

ip -br addr
echo "VITO_SSH_ERROR: the private address $ADDRESS did not come up on this server."
exit 1
