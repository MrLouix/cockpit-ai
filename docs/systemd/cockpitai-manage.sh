#!/bin/bash
# CockpitAI - Service Management Script
# Manage systemd user services for CockpitAI

SERVICE_PREFIX="cockpitai"
SERVICES=("$SERVICE_PREFIX-backend" "$SERVICE_PREFIX-engine" "$SERVICE_PREFIX-frontend")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
    echo "Usage: $0 {start|stop|restart|status|enable|disable|logs|update|install|uninstall}"
    echo ""
    echo "Commands:"
    echo "  start     - Start all CockpitAI services"
    echo "  stop      - Stop all CockpitAI services"
    echo "  restart   - Restart all CockpitAI services"
    echo "  status    - Show status of all CockpitAI services"
    echo "  enable    - Enable all services to start on boot"
    echo "  disable   - Disable all services"
    echo "  logs      - Show logs for all services (follow)"
    echo "  logs [N]  - Show last N lines of logs"
    echo "  update    - Stop services, pull updates, restart"
    echo "  install   - Install systemd service files"
    echo "  uninstall - Remove systemd service files"
    exit 1
}

if [ $# -eq 0 ]; then
    usage
fi

ACTION="$1"
shift

manage_service() {
    local action="$1"
    local service="$2"
    
    case "$action" in
        start|stop|restart|status|enable|disable)
            systemctl --user "$action" "$service.service"
            ;;
        logs)
            if [ -n "$3" ]; then
                journalctl --user -u "$service.service" --no-pager -n "$3"
            else
                journalctl --user -u "$service.service" -f
            fi
            ;;
    esac
}

# Check XDG_RUNTIME_DIR for WSL
if [ -z "$XDG_RUNTIME_DIR" ]; then
    export XDG_RUNTIME_DIR=/run/user/$(id -u)
fi

case "$ACTION" in
    start)
        echo -e "${BLUE}Starting CockpitAI services...${NC}"
        for SERVICE in "${SERVICES[@]}"; do
            echo -n "  $SERVICE... "
            systemctl --user start "$SERVICE.service" 2>/dev/null
            if systemctl --user is-active --quiet "$SERVICE.service"; then
                echo -e "${GREEN}✓${NC}"
            else
                echo -e "${RED}✗${NC}"
            fi
        done
        ;;
    stop)
        echo -e "${BLUE}Stopping CockpitAI services...${NC}"
        for SERVICE in "${SERVICES[@]}"; do
            echo -n "  $SERVICE... "
            systemctl --user stop "$SERVICE.service" 2>/dev/null
            if ! systemctl --user is-active --quiet "$SERVICE.service"; then
                echo -e "${GREEN}✓${NC}"
            else
                echo -e "${RED}✗${NC}"
            fi
        done
        ;;
    restart)
        echo -e "${BLUE}Restarting CockpitAI services...${NC}"
        for SERVICE in "${SERVICES[@]}"; do
            echo -n "  $SERVICE... "
            systemctl --user restart "$SERVICE.service" 2>/dev/null
            sleep 2
            if systemctl --user is-active --quiet "$SERVICE.service"; then
                echo -e "${GREEN}✓${NC}"
            else
                echo -e "${RED}✗${NC}"
            fi
        done
        ;;
    status)
        echo -e "${BLUE}CockpitAI Services Status:${NC}"
        echo "========================================"
        for SERVICE in "${SERVICES[@]}"; do
            STATUS=$(systemctl --user is-active "$SERVICE.service" 2>/dev/null || echo "inactive")
            LOAD=$(systemctl --user show "$SERVICE.service" --property=MainPID 2>/dev/null | cut -d= -f2 || echo "N/A")
            echo "  $SERVICE.service: $STATUS (PID: $LOAD)"
        done
        echo ""
        ;;
    enable)
        echo -e "${BLUE}Enabling CockpitAI services to start on boot...${NC}"
        for SERVICE in "${SERVICES[@]}"; do
            echo -n "  $SERVICE... "
            systemctl --user enable "$SERVICE.service" 2>/dev/null
            if systemctl --user is-enabled --quiet "$SERVICE.service"; then
                echo -e "${GREEN}✓${NC}"
            else
                echo -e "${RED}✗${NC}"
            fi
        done
        ;;
    disable)
        echo -e "${BLUE}Disabling CockpitAI services...${NC}"
        for SERVICE in "${SERVICES[@]}"; do
            echo -n "  $SERVICE... "
            systemctl --user disable "$SERVICE.service" 2>/dev/null
            if ! systemctl --user is-enabled --quiet "$SERVICE.service"; then
                echo -e "${GREEN}✓${NC}"
            else
                echo -e "${RED}✗${NC}"
            fi
        done
        ;;
    logs)
        if [ -n "$1" ]; then
            LINES="$1"
            echo -e "${BLUE}Showing last $LINES lines of logs for all services:${NC}"
            for SERVICE in "${SERVICES[@]}"; do
                echo ""
                echo "=== $SERVICE.service ==="
                journalctl --user -u "$SERVICE.service" --no-pager -n "$LINES"
            done
        else
            echo -e "${BLUE}Following logs for all CockpitAI services (Ctrl+C to exit)...${NC}"
            journalctl --user -u "${SERVICES[0]}.service" -f &
            JOURNAL_PIDS=$!
            for SERVICE in "${SERVICES[@]:1}"; do
                journalctl --user -u "$SERVICE.service" -f &
                JOURNAL_PIDS="$JOURNAL_PIDS $!"
            done
            wait $JOURNAL_PIDS
        fi
        ;;
    install)
        echo -e "${BLUE}Installing CockpitAI systemd service files...${NC}"
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
        
        mkdir -p "$SYSTEMD_USER_DIR"
        
        cp "$SCRIPT_DIR/cockpitai-backend.service" "$SYSTEMD_USER_DIR/"
        cp "$SCRIPT_DIR/cockpitai-engine.service" "$SYSTEMD_USER_DIR/"
        cp "$SCRIPT_DIR/cockpitai-frontend.service" "$SYSTEMD_USER_DIR/"
        
        systemctl --user daemon-reload
        echo -e "${GREEN}✓${NC} Service files installed and daemon reloaded"
        ;;
    uninstall)
        echo -e "${YELLOW}Uninstalling CockpitAI systemd service files...${NC}"
        SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
        
        for SERVICE in "${SERVICES[@]}"; do
            echo -n "  Stopping $SERVICE... "
            systemctl --user stop "$SERVICE.service" 2>/dev/null || true
            echo -e "${GREEN}✓${NC}"
            
            echo -n "  Disabling $SERVICE... "
            systemctl --user disable "$SERVICE.service" 2>/dev/null || true
            echo -e "${GREEN}✓${NC}"
            
            echo -n "  Removing $SERVICE.service... "
            rm -f "$SYSTEMD_USER_DIR/$SERVICE.service"
            echo -e "${GREEN}✓${NC}"
        done
        
        systemctl --user daemon-reload
        echo -e "${GREEN}✓${NC} CockpitAI services uninstalled"
        ;;
    update)
        echo -e "${BLUE}Updating CockpitAI...${NC}"
        
        # Stop services
        echo "Stopping services..."
        for SERVICE in "${SERVICES[@]}"; do
            systemctl --user stop "$SERVICE.service" 2>/dev/null || true
        done
        
        # Pull updates
        echo "Pulling updates..."
        cd /home/ai_agent/projects/cockpitAI
        git pull
        
        # Install dependencies
        echo "Installing dependencies..."
        cd backend && npm install 2>/dev/null || true
        cd ../engine && npm install 2>/dev/null || true
        cd ../frontend && npm install 2>/dev/null || true
        cd ..
        
        # Reload systemd
        systemctl --user daemon-reload
        
        # Start services
        echo "Starting services..."
        for SERVICE in "${SERVICES[@]}"; do
            systemctl --user start "$SERVICE.service"
        done
        
        # Check status
        sleep 3
        echo ""
        echo "Update complete! Checking status:"
        for SERVICE in "${SERVICES[@]}"; do
            if systemctl --user is-active --quiet "$SERVICE.service"; then
                echo -e "  ${GREEN}✓${NC} $SERVICE.service is running"
            else
                echo -e "  ${RED}✗${NC} $SERVICE.service failed to start"
                echo "  Check logs: journalctl --user -u $SERVICE.service --no-pager -n 20"
            fi
        done
        ;;
    *)
        usage
        ;;
esac
