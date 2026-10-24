# Add Caddy's GPG key and repository
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg

curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \

sudo tee /etc/apt/sources.list.d/caddy-stable.list

# Install required packages
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    debian-keyring debian-archive-keyring apt-transport-https curl

# Update package list
sudo DEBIAN_FRONTEND=noninteractive apt-get update -y

# Install Caddy and Certbot
sudo DEBIAN_FRONTEND=noninteractive apt-get install caddy certbot -y

sudo mkdir -p /etc/caddy/sites-available

sudo mkdir -p /etc/caddy/sites-enabled
