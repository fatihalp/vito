if command -v mise &> /dev/null; then
    echo "Mise is already installed"
    mise --version
    exit 0
fi

sudo apt update -y && sudo apt install -y curl gpg
sudo install -dm 755 /etc/apt/keyrings
curl -fsSL https://mise.jdx.dev/gpg-key.pub | gpg --dearmor | sudo tee /etc/apt/keyrings/mise-archive-keyring.gpg 1> /dev/null
ARCH=$(dpkg --print-architecture)
echo "deb [signed-by=/etc/apt/keyrings/mise-archive-keyring.gpg arch=${ARCH}] https://mise.jdx.dev/deb stable main" | sudo tee /etc/apt/sources.list.d/mise.list
sudo apt update
sudo apt install -y mise

mise --version
echo "Mise installed successfully"
