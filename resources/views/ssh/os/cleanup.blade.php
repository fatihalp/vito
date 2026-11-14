sudo DEBIAN_FRONTEND=noninteractive apt-get update -y

sudo DEBIAN_FRONTEND=noninteractive apt-get autoremove --purge -y

sudo DEBIAN_FRONTEND=noninteractive apt-get clean -y

sudo DEBIAN_FRONTEND=noninteractive apt-get purge -y $(dpkg -l | grep '^rc' | awk '{print $2}')

echo "Cleanup completed."
