#!/bin/bash
# ===============================================================
# Budget Tool - server setup script
# Run this on a Linux host (Ubuntu/Debian) to install and run the server.
# ===============================================================

set -e

echo "=== Budget Tool Server Setup ==="

# 1. Install Node.js 20 LTS
echo "[1/5] Installing Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "  Node.js already installed: $(node --version)"
fi

# 2. Create app directory
APP_DIR="/opt/budget-tool"
echo "[2/5] Setting up $APP_DIR..."
mkdir -p "$APP_DIR/data"

# Copy files (assumes this script is run from the project folder)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cp "$SCRIPT_DIR/server.js" "$APP_DIR/"
cp "$SCRIPT_DIR/index.html" "$APP_DIR/"
cp "$SCRIPT_DIR/package.json" "$APP_DIR/"

# 3. Install dependencies
echo "[3/5] Installing npm dependencies..."
cd "$APP_DIR"
npm install --production

# 4. Create .env if it doesn't exist
if [ ! -f "$APP_DIR/.env" ]; then
  echo "[4/5] Creating .env file..."
  cp "$SCRIPT_DIR/.env.example" "$APP_DIR/.env"
  echo ""
  echo "  IMPORTANT: Edit /opt/budget-tool/.env and set your AKAHU_APP_TOKEN + AKAHU_USER_TOKEN"
  echo "     nano /opt/budget-tool/.env"
  echo ""
else
  echo "[4/5] .env already exists, skipping..."
fi

# 5. Create systemd service
echo "[5/5] Creating systemd service..."
cat > /etc/systemd/system/budget-tool.service << 'EOF'
[Unit]
Description=Budget Tool Akahu Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/budget-tool
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable budget-tool
systemctl start budget-tool

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Service status:"
systemctl status budget-tool --no-pager || true
echo ""
echo "Next steps:"
echo "  1. Edit /opt/budget-tool/.env - add your Akahu tokens"
echo "  2. Restart: systemctl restart budget-tool"
echo "  3. Access at: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "Useful commands:"
echo "  journalctl -u budget-tool -f    # view logs"
echo "  systemctl restart budget-tool   # restart after config changes"
echo "  curl -X POST http://localhost:3000/api/fetch  # manual fetch"
echo ""
