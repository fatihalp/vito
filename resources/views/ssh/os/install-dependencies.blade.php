export NEEDRESTART_MODE=l
export DEBIAN_FRONTEND=noninteractive
sudo apt-get install -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" software-properties-common curl zip unzip git gcc openssl ufw cron
git config --global user.email "{{ $email }}"
git config --global user.name "{{ $name }}"

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get update
sudo apt-get install nodejs -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
