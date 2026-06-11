export NEEDRESTART_MODE=l
sudo DEBIAN_FRONTEND=noninteractive apt-get clean
sudo DEBIAN_FRONTEND=noninteractive apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
sudo DEBIAN_FRONTEND=noninteractive apt-get autoremove -y
