echo "=== [1/4] Cleaning package cache ==="
sudo DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get clean

echo "=== [2/4] Updating package index ==="
sudo DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get update -o Acquire::AllowReleaseInfoChange::Label=true

echo "=== [3/4] Performing distribution & kernel upgrade ==="
sudo DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" dist-upgrade -y

echo "=== [4/4] Removing obsolete packages ==="
sudo DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get autoremove -y

echo "=== Kernel upgrade completed. Server will restart shortly. ==="
