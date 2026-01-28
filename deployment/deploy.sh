#!/bin/bash
set -e

echo "🚀 Deploying V0 Linear Agent to rainworth-server..."

# Configuration
SERVER="fraser@rainworth-server"
SERVICE_DIR="/home/fraser/services/linear-agent-v0"
SERVICE_NAME="linear-agent-v0"

# 1. Create service directory
echo "📁 Creating service directory..."
ssh $SERVER "mkdir -p $SERVICE_DIR"

# 2. Copy application files
echo "📦 Copying application files..."
rsync -av --exclude 'node_modules' --exclude '.git' --exclude '.env' \
  ./ $SERVER:$SERVICE_DIR/

# 3. Install dependencies
echo "📚 Installing dependencies..."
ssh $SERVER "cd $SERVICE_DIR && npm install --production"

# 4. Copy systemd service file
echo "⚙️  Installing systemd service..."
ssh $SERVER "sudo cp $SERVICE_DIR/deployment/linear-agent-v0.service /etc/systemd/system/"

# 5. Reload systemd
echo "🔄 Reloading systemd..."
ssh $SERVER "sudo systemctl daemon-reload"

# 6. Enable and restart service
echo "🔌 Enabling and starting service..."
ssh $SERVER "sudo systemctl enable $SERVICE_NAME"
ssh $SERVER "sudo systemctl restart $SERVICE_NAME"

# 7. Check status
echo "✅ Checking service status..."
ssh $SERVER "sudo systemctl status $SERVICE_NAME --no-pager"

echo ""
echo "🎉 Deployment complete!"
echo "📊 View logs: ssh $SERVER 'sudo journalctl -u $SERVICE_NAME -f'"
