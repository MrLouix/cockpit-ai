#!/bin/bash
# CockpitAI — Redémarrer les 3 services
set -e

MONGODB_HOST="100.71.107.100"
MONGODB_PORT=27017

cd /home/ai_agent/projects/cockpitAI

# ── 0. Vérifier / démarrer MongoDB ──────────────────────────────────
echo "🔍 Vérification de MongoDB ($MONGODB_HOST:$MONGODB_PORT)..."
if timeout 5 bash -c "echo 'ping' | nc -w 3 $MONGODB_HOST $MONGODB_PORT" >/dev/null 2>&1; then
    echo "✅ MongoDB est accessible en $MONGODB_HOST:$MONGODB_PORT"
else
    echo "⚠️  MongoDB inaccessible, tentative de démarrage..."
    if pgrep -a mongod >/dev/null 2>&1; then
        echo "📌 mongod est en cours d'exécution mais ne répond pas, restart..."
        pkill -9 mongod 2>/dev/null || true
        sleep 2
    fi
    # Démarrer mongod en arrière-plan (fichier de log dans le répertoire cockpitAI)
    mongod --dbpath /var/lib/mongodb --logpath /home/ai_agent/projects/cockpitAI/mongod.log --fork --bind_ip_all 2>/dev/null \
        || mongod --dbpath /data/db --logpath /home/ai_agent/projects/cockpitAI/mongod.log --fork --bind_ip_all 2>/dev/null \
        || echo "⚠️  Impossible de démarrer mongod (exécute-le manuellement)"
    # Attendre que mongod soit prêt
    for i in $(seq 1 30); do
        if timeout 2 bash -c "echo 'ping' | nc -w 1 $MONGODB_HOST $MONGODB_PORT" >/dev/null 2>&1; then
            echo "✅ MongoDB démarré avec succès"
            break
        fi
        sleep 1
    done
    if [ "$i" -eq 30 ]; then
        echo "❌ MongoDB n'a pas démarré à temps — vérifie mongod.log"
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

# ── 2. Vérifier la connexion MongoDB depuis le backend ───────────────
echo ""
echo "🔍 Test de connexion backend → MongoDB..."
# on utilise nc sur le port — le backend fera le vrai test au démarrage
if timeout 5 bash -c "echo 'ping' | nc -w 3 $MONGODB_HOST $MONGODB_PORT" >/dev/null 2>&1; then
    echo "✅ MongoDB reachable from backend"
else
    echo "❌ MongoDB unreachable from backend — check network/firewall"
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