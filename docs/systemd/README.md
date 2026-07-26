# CockpitAI - Systemd User Services for Cockpit Server

This directory contains systemd user service files to run CockpitAI as user services, making them visible and manageable from **Cockpit Server** dashboard.

## 📋 Overview

CockpitAI consists of three separate components:
- **Backend API** (`backend/server.js`) - Express REST API on port 3331
- **Engine** (`engine/runEngine.js`) - AI Agent dispatcher and polling engine on port 3332
- **Frontend** (`frontend/`) - React/Vite dashboard on port 3333

Each component runs as a separate systemd user service, allowing independent management through Cockpit Server.

## 🚀 Quick Install

Run the install script to set up all services:

```bash
# Navigate to the systemd docs directory
cd /home/ai_agent/projects/cockpitAI/docs/systemd

# Make scripts executable
chmod +x install.sh cockpitai-manage.sh

# Run the installer
./install.sh
```

The installer will:
1. Create necessary directories
2. Copy service files to `~/.config/systemd/user/`
3. Enable linger for your user (services persist after logout)
4. Set up XDG_RUNTIME_DIR if needed (for WSL compatibility)
5. Reload systemd and start all services

## 📁 Service Files

| Service | Description | Port | Path |
|---------|-------------|------|------|
| `cockpitai-backend.service` | Express API Server | 3331 | `~/.config/systemd/user/` |
| `cockpitai-engine.service` | AI Agent Dispatcher | 3332 | `~/.config/systemd/user/` |
| `cockpitai-frontend.service` | React/Vite Dashboard | 3333 | `~/.config/systemd/user/` |

## 🛠️ Manual Installation

If you prefer manual installation:

```bash
# 1. Create directories
mkdir -p ~/.config/systemd/user
mkdir -p /home/ai_agent/projects/cockpitAI/logs

# 2. Copy service files
cp /home/ai_agent/projects/cockpitAI/docs/systemd/cockpitai-*.service ~/.config/systemd/user/

# 3. Enable linger (so services persist after logout)
sudo loginctl enable-linger $(whoami)

# 4. Set XDG_RUNTIME_DIR for WSL users (add to ~/.bashrc)
echo 'export XDG_RUNTIME_DIR=/run/user/$(id -u)' >> ~/.bashrc
source ~/.bashrc

# 5. Reload and enable services
systemctl --user daemon-reload
systemctl --user enable cockpitai-backend.service
systemctl --user enable cockpitai-engine.service
systemctl --user enable cockpitai-frontend.service

# 6. Start services
systemctl --user start cockpitai-backend.service
systemctl --user start cockpitai-engine.service
systemctl --user start cockpitai-frontend.service
```

## 🔧 Management Commands

Use the management script for common operations:

```bash
# Show help
./cockpitai-manage.sh

# Start all services
./cockpitai-manage.sh start

# Stop all services
./cockpitai-manage.sh stop

# Restart all services
./cockpitai-manage.sh restart

# Show status of all services
./cockpitai-manage.sh status

# Enable services to start on boot
./cockpitai-manage.sh enable

# Disable services
./cockpitai-manage.sh disable

# View logs (follow)
./cockpitai-manage.sh logs

# View last 50 lines of logs
./cockpitai-manage.sh logs 50

# Update CockpitAI (stop, pull, install deps, restart)
./cockpitai-manage.sh update

# Install service files
./cockpitai-manage.sh install

# Uninstall service files
./cockpitai-manage.sh uninstall
```

## 📊 Direct systemctl Commands

```bash
# Check status of a specific service
systemctl --user status cockpitai-backend.service

# View logs for a specific service
journalctl --user -u cockpitai-backend.service -f

# Restart a specific service
systemctl --user restart cockpitai-engine.service

# Check if service is active
systemctl --user is-active cockpitai-frontend.service

# Reload after modifying service files
systemctl --user daemon-reload
```

## 📝 Configuration

### Environment Variables

Each service has its own environment variables defined in the service file:

**Backend (`cockpitai-backend.service`):**
- `MONGODB_URI=mongodb://100.71.107.100:27017/cockpitai`
- `PORT=3331`
- `NODE_ENV=production`

**Engine (`cockpitai-engine.service`):**
- `MONGODB_URI=mongodb://100.71.107.100:27017/cockpitai`
- `POLL_INTERVAL=5000`
- `DEFAULT_TIMEOUT=300000`
- `ENGINE_PORT=3332`
- `NODE_ENV=production`

**Frontend (`cockpitai-frontend.service`):**
- `NODE_ENV=production`
- `PORT=3333`

### Customizing Configuration

To customize the configuration:

1. Edit the service file:
   ```bash
   nano ~/.config/systemd/user/cockpitai-backend.service
   ```

2. Modify the `Environment=` directives

3. Reload systemd:
   ```bash
   systemctl --user daemon-reload
   ```

4. Restart the service:
   ```bash
   systemctl --user restart cockpitai-backend.service
   ```

## 📁 Log Files

Each service writes logs to:
- `~/projects/cockpitAI/logs/backend.log`
- `~/projects/cockpitAI/logs/backend-error.log`
- `~/projects/cockpitAI/logs/engine.log`
- `~/projects/cockpitAI/logs/engine-error.log`
- `~/projects/cockpitAI/logs/frontend.log`
- `~/projects/cockpitAI/logs/frontend-error.log`

You can also view logs via journalctl:
```bash
# All CockpitAI logs
journalctl --user -u cockpitai-* -f

# Backend logs only
journalctl --user -u cockpitai-backend.service --no-pager -n 100
```

## 🎯 Cockpit Server Integration

After installation, the three CockpitAI services will automatically appear in:

1. **Cockpit Server Web Interface** → **Services** tab
2. Each service can be started/stopped independently
3. Logs can be viewed through Cockpit's journal interface

### Service Names in Cockpit
- `cockpitai-backend.service` - CockpitAI Backend API Server
- `cockpitai-engine.service` - CockpitAI AI Engine - Agent Dispatcher
- `cockpitai-frontend.service` - CockpitAI Frontend - React/Vite Dashboard

## ⚠️ Important Notes

### User Services vs System Services
- ✅ **Use `systemctl --user`** (user services run as your user)
- ❌ **Never use `sudo systemctl`** or `/etc/systemd/system/`
- User services are isolated and safer for development tools

### XDG_RUNTIME_DIR (WSL/Remote Sessions)
If you're on WSL or remote sessions without a graphical environment, ensure `XDG_RUNTIME_DIR` is set:

```bash
# Add to ~/.bashrc
echo 'export XDG_RUNTIME_DIR=/run/user/$(id -u)' >> ~/.bashrc
source ~/.bashrc
```

### Linger Mode
For services to persist after you log out:

```bash
# Enable linger for your user
sudo loginctl enable-linger $(whoami)

# Check linger status
loginctl show-user $(whoami) --property=Linger
```

### File Permissions
Ensure your user has read/write access to:
- `~/.config/systemd/user/`
- `/home/ai_agent/projects/cockpitAI/`
- `/home/ai_agent/projects/cockpitAI/logs/`

## 🔄 Updating Services

When you pull updates to CockpitAI:

```bash
# Method 1: Using the management script
./cockpitai-manage.sh update

# Method 2: Manual update
./cockpitai-manage.sh stop
git pull
cd backend && npm install
cd ../engine && npm install
cd ../frontend && npm install
cd ..
./cockpitai-manage.sh start
```

## 🗑️ Uninstalling

To completely remove CockpitAI services:

```bash
# Using the management script
./cockpitai-manage.sh uninstall

# Manual uninstall
systemctl --user stop cockpitai-*.service
systemctl --user disable cockpitai-*.service
rm ~/.config/systemd/user/cockpitai-*.service
systemctl --user daemon-reload
```

## 🎨 Customizing Ports

To change the ports, edit the service files and update both the `Environment=PORT=...` and any `ExecStart` arguments:

```ini
# Example: Change backend to port 4000
[Service]
Environment=PORT=4000
ExecStart=/usr/bin/node --no-warnings server.js
```

Remember to:
1. Update the corresponding frontend API calls if you change backend port
2. Reload systemd: `systemctl --user daemon-reload`
3. Restart the service

## 🐛 Troubleshooting

### Services don't appear in Cockpit
- Ensure services are in `~/.config/systemd/user/`
- Run `systemctl --user daemon-reload`
- Check linger is enabled: `loginctl show-user $(whoami) --property=Linger`
- Restart Cockpit Server or refresh the page

### Services fail to start
```bash
# Check service status
systemctl --user status cockpitai-backend.service

# Check logs
journalctl --user -u cockpitai-backend.service --no-pager -n 50
```

### MongoDB connection errors
- Verify MongoDB is running: `systemctl status mongod` or `docker ps`
- Check the connection string in `.env` files
- Test connectivity: `echo 'ping' | nc -w 3 100.71.107.100 27017`

### Port already in use
```bash
# Find what's using the port
sudo lsof -i :3331

# Kill the process
kill -9 <PID>
```

### XDG_RUNTIME_DIR errors
```bash
# Create the directory manually
mkdir -p /run/user/$(id -u)
chmod 700 /run/user/$(id -u)
export XDG_RUNTIME_DIR=/run/user/$(id -u)
```

## 📚 References

- [Systemd User Services](https://wiki.archlinux.org/title/Systemd/User_services)
- [Cockpit Project - Services](https://cockpit-project.org/guide/latest/services.html)
- [CockpitAI Documentation](https://github.com/MrLouix/cockpitAI)

## 📞 Support

For issues with these service files:
1. Check the logs first: `journalctl --user -u cockpitai-*.service -n 50`
2. Review the troubleshooting section above
3. Open an issue on the CockpitAI GitHub repository
