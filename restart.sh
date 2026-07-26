#!/bin/bash
# CockpitAI — Redémarrer les 3 services
set -e

REDIS_HOST="127.0.0.1"
REDIS_PORT=6379

cd /home/ai_agent/projects/cockpitAI

# ── 0. Vérifier / démarrer Redis ────────────────────────────────────
echo "🔍 Vérification de Redis ($REDIS_HOST:$REDIS_PORT)..."
if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q PONG; then
    echo "✅ Redis est accessible en $REDIS_HOST:$REDIS_PORT"
else
    echo "⚠️  Redis inaccessible, tentative de démarrage..."
    if pgrep -a redis-server >/dev/null 2>&1; then
        echo "📌 redis-server est en cours d'exécution mais ne répond pas, restart..."
        pkill -9 redis-server 2>/dev/null || true
        sleep 2
    fi
    # Démarrer redis-server en arrière-plan avec persistance AOF
    redis-server --appendonly yes --dir /var/lib/redis --daemonize yes --bind 0.0.0.0 2>/dev/null \
        || redis-server --appendonly yes --daemonize yes --bind 0.0.0.0 2>/dev/null \
        || echo "⚠️  Impossible de démarrer redis-server (exécute-le manuellement)"
    # Attendre que redis-server soit prêt
    for i in $(seq 1 30); do
        if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q PONG; then
            echo "✅ Redis démarré avec succès"
            break
        fi
        sleep 1
    done
    if [ "$i" -eq 30 ]; then
        echo "❌ Redis n'a pas démarré à temps"
    fi
fi

# ── 1. Arrêt des processus existants ────────────────────────────────
echo ""
echo "⏹  Arrêt des processus existants..."
pkill -f "node.*server\.js" 2>/dev/null || true
pkill -f "node.*runEngine\.js" 2>/dev/null || true
pkill -f "npx vite" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Attendre que tout soit bien killé
sleep 2

# Vérification — kill forcé si nécessaire
if pgrep -f "node.*server\.js" >/dev/null 2>&1; then
    echo "⚠️  Des processus server.js sont toujours en vie, kill forcé..."
    pkill -9 -f "node.*server\.js" || true
fi
if pgrep -f "node.*runEngine\.js" >/dev/null 2>&1; then
    echo "⚠️  Des processus runEngine.js sont toujours en vie, kill forcé..."
    pkill -9 -f "node.*runEngine\.js" || true
fi
if pgrep -f "vite" >/dev/null 2>&1; then
    echo "⚠️  Des processus vite sont toujours en vie, kill forcé..."
    pkill -9 -f "vite" || true
fi

sleep 1

# ── 2. Vérifier la connexion Redis depuis le backend ─────────────────
echo ""
echo "🔍 Test de connexion backend → Redis..."
if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q PONG; then
    echo "✅ Redis reachable from backend"
else
    echo "❌ Redis unreachable from backend — check redis-server"
fi

# ── 3. Démarrage des services ───────────────────────────────────────
echo ""
echo "🚀 Démarrage du backend API (port 3331)..."
node --watch ./backend/server.js &
BACKEND_PID=$!

echo "🚀 Démarrage de l'engine (port 3332)..."
node --watch ./engine/runEngine.js &
ENGINE_PID=$!

sleep 2

echo "🚀 Démarrage du front-end (port 3333)..."
cd frontend && npx vite --port 3333 --host 0.0.0.0 &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Services démarrés"
echo "   Backend API  : http://localhost:3331"
echo "   Engine       : http://localhost:3332"
echo "   Front-end    : http://localhost:3333"
echo ""
echo "PID backend=$BACKEND_PID  engine=$ENGINE_PID  frontend=$FRONTEND_PID"
