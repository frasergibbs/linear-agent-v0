# Deployment Checklist

Quick reference for deploying V0 Linear Agent to rainworth-server.

## ✅ Pre-Deployment

- [ ] Cloudflare account access
- [ ] Linear workspace admin access
- [ ] V0 API key obtained
- [ ] GitHub PAT created
- [ ] Tailscale SSH access to rainworth-server

## 📋 Steps

### 1. Configure Cloudflare Tunnel
```bash
# SSH to rainworth-server
ssh fraser@rainworth-server

# Get tunnel ID
cloudflared tunnel list

# Edit tunnel config
sudo nano /etc/cloudflared/config.yml

# Add to ingress (before final http_status:404):
  - hostname: linear-agent.fraserandsam.com
    service: http://localhost:3324

# Add DNS record
cloudflared tunnel route dns <TUNNEL_ID> linear-agent.fraserandsam.com

# Restart tunnel
sudo systemctl restart cloudflared
```

### 2. Create Linear OAuth Application
**URL:** https://linear.app/settings/api/applications/new

| Field | Value |
|-------|-------|
| Name | `V0 UI Agent` |
| Callback URL | `https://linear-agent.fraserandsam.com/auth/callback` |
| Webhook URL | `https://linear-agent.fraserandsam.com/webhook/linear` |
| Enable webhooks | ✅ |
| Events | Agent session events, Issue events, Comment events |

**Save:**
- `LINEAR_CLIENT_ID`
- `LINEAR_CLIENT_SECRET`
- `LINEAR_WEBHOOK_SECRET`

### 3. Deploy to Server
```bash
# From local machine
cd /Users/frasergibbs/Repos/linear-agent-v0
./deployment/deploy.sh
```

### 4. Configure Environment
```bash
ssh fraser@rainworth-server
cd /home/fraser/services/linear-agent-v0
nano .env
```

Paste:
```bash
LINEAR_CLIENT_ID=<from Step 2>
LINEAR_CLIENT_SECRET=<from Step 2>
LINEAR_WEBHOOK_SECRET=<from Step 2>
V0_API_KEY=<your V0 key>
GITHUB_TOKEN=<your GitHub PAT>
PORT=3324
NODE_ENV=production
BASE_URL=https://linear-agent.fraserandsam.com

# Leave empty for now:
LINEAR_ACCESS_TOKEN=
LINEAR_V0_AGENT_USER_ID=
```

Restart:
```bash
sudo systemctl restart linear-agent-v0
sudo journalctl -u linear-agent-v0 -f
```

### 5. Install Agent via OAuth
Visit: `https://linear-agent.fraserandsam.com/auth/install`

1. Authorize in Linear
2. Copy `LINEAR_ACCESS_TOKEN` and `LINEAR_V0_AGENT_USER_ID` from success page
3. Add to `.env`:
   ```bash
   nano /home/fraser/services/linear-agent-v0/.env
   ```
4. Restart:
   ```bash
   sudo systemctl restart linear-agent-v0
   ```

### 6. Test
**Create issue in Linear:**
- Title: "Test: V0 Dashboard"  
- Assign to: "V0 UI Agent"
- Watch webhook logs:
  ```bash
  sudo journalctl -u linear-agent-v0 -f
  ```

## 🔍 Verification

- [ ] `https://linear-agent.fraserandsam.com/health` returns `{"status":"healthy"}`
- [ ] OAuth install completes successfully
- [ ] Assigning issue triggers webhook
- [ ] V0 session created and posted to issue
- [ ] Linear shows agent user in workspace

## 📚 Full Guide

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions and troubleshooting.
