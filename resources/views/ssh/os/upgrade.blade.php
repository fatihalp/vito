set -o pipefail 2>/dev/null || true
export LC_ALL=C
UPGRADE_LOG=$(mktemp)
trap 'rm -f "$UPGRADE_LOG"' EXIT
sudo rm -f /etc/apt/keyrings/mise-archive-keyring.pub /etc/apt/sources.list.d/mise.list 2>/dev/null || true

echo "=== [1/4] Cleaning package cache ==="
sudo DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get clean

echo "=== [2/4] Updating package index ==="
sudo DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get update -o Acquire::AllowReleaseInfoChange::Label=true

echo "=== [3/4] Upgrading packages ==="
sudo DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get upgrade -y | tee "$UPGRADE_LOG"
sudo DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" upgrade -y

echo "=== [4/4] Removing obsolete packages ==="
sudo DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get autoremove -y

echo "=== Upgrade sequence finished ==="
echo "Packages upgraded:$(grep -oE '^[0-9]+ upgraded' "$UPGRADE_LOG" | grep -oE '^[0-9]+' | head -1 || echo 0)"
echo "Reboot required:$([ -f /var/run/reboot-required ] && echo 1 || echo 0)"
