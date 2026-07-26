#!/bin/bash
# CockpitAI - Install systemd user services for Cockpit Server
set -e

USER_NAME=$(whoami)
COCKPITAI_DIR="/home/ai_agent/projects/cockpitAI"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
LOGS_DIR="$COCKPITAI_DIR/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo_success() {
    echo -e "${GREEN}✓${NC} $1"
}

echo_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

echo_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running as root
if [ "$USER_NAME" = "root" ]; then
    echo_error "Do not run this script as root! Use your regular user account."
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo_error "Node.js is not installed. Please install Node.js >= 22"
    exit 1
fi

# Check npm/npx
if ! command -v npx &> /dev/null; then
    echo_error "npx is not available. Please install npm."
    exit 1
fi

echo ""
echo "=========================================="
echo "  CockpitAI - systemd User Service Setup"
echo "=========================================="
echo ""

# Step 1: Create directories
echo_info "[1/5] Creating directories..."
mkdir -p "$SYSTEMD_USER_DIR"
mkdir -p "$LOGS_DIR"
echo_success "Directories created"

# Step 2: Copy service files
echo_info "[2/5] Installing service files..."

# Install backend service
cp "$COCKPITAI_DIR/docs/systemd/cockpitai-backend.service" "$SYSTEMD_USER_DIR/"
# Install engine service
cp "$COCKPITAI_DIR/docs/systemd/cockpitai-engine.service" "$SYSTEMD_USER_DIR/"
# Install frontend service
cp "$COCKPITAI_DIR/docs/systemd/cockpitai-frontend.service" "$SYSTEMD_USER_DIR/"

echo_success "Service files installed to $SYSTEMD_USER_DIR/"

# Step 3: Ensure linger is enabled (for persistent services)
echo_info "[3/5] Checking linger status..."
if ! loginctl show-user "$USER_NAME" --property=Linger | grep -q "yes"; then
    echo_warning "Enabling linger for user $USER_NAME (requires sudo)..."
    sudo loginctl enable-linger "$USER_NAME" || {
        echo_error "Failed to enable linger. Services may not persist after logout."
        echo_warning "You can manually run: sudo loginctl enable-linger $USER_NAME"
    }
    echo_success "Linger enabled"
else
    echo_success "Linger is already enabled"
fi

# Step 4: Setup XDG_RUNTIME_DIR for WSL/compatibility
echo_info "[4/5] Checking XDG_RUNTIME_DIR..."
if [ -z "$XDG_RUNTIME_DIR" ]; then
    RUNTIME_DIR="/run/user/$(id -u)"
    if [ ! -d "$RUNTIME_DIR" ]; then
        mkdir -p "$RUNTIME_DIR"
        chmod 700 "$RUNTIME_DIR"
    fi
    echo "export XDG_RUNTIME_DIR=$RUNTIME_DIR" >> "$HOME/.bashrc"
    export XDG_RUNTIME_DIR="$RUNTIME_DIR"
    echo_success "XDG_RUNTIME_DIR set to $RUNTIME_DIR"
else
    echo_success "XDG_RUNTIME_DIR is already set: $XDG_RUNTIME_DIR"
fi

# Step 5: Reload and enable services
echo_info "[5/5] Reloading systemd and starting services..."

# Reload systemd user daemon
systemctl --user daemon-reload
echo_success "systemd daemon reloaded"

# Enable and start each service
SERVICES=("cockpitai-backend" "cockpitai-engine" "cockpitai-frontend")

for SERVICE in "${SERVICES[@]}"; do
    echo_info "  Enabling $SERVICE.service..."
    systemctl --user enable "$SERVICE.service"
    systemctl --user start "$SERVICE.service"
    
    # Wait a bit and check status
    sleep 2
    if systemctl --user is-active --quiet "$SERVICE.service"; then
        echo_success "  $SERVICE.service is active and running"
    else
        echo_warning "  $SERVICE.service may have failed to start"
        echo_warning "  Check logs: journalctl --user -u $SERVICE.service --no-pager -n 20"
    fi
done

echo ""
echo "=========================================="
echo "  Installation Complete!"
echo "=========================================="
echo ""
echo "CockpitAI services are now available in Cockpit Server dashboard."
echo ""
echo "Access URLs:"
echo "  Backend API:  http://localhost:3331"
echo "  Engine:       http://localhost:3332"
echo "  Frontend:     http://localhost:3333"
echo ""
echo "Management commands:"
echo "  View status:       systemctl --user status cockpitai-*.service"
echo "  View logs:         journalctl --user -u cockpitai-*.service -f"
echo "  Restart all:       systemctl --user restart cockpitai-*.service"
echo "  Stop all:          systemctl --user stop cockpitai-*.service"
echo ""
echo "Logs are also saved to: $LOGS_DIR/"
echo ""
