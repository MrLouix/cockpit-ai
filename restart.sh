#!/bin/bash
# CockpitAI — Redémarrer les 3 services
set -e

cd /home/ai_agent/projects/cockpitAI

echo "⏹  Arrêt des processus existants..."
# Kill TOUS les processus liés (parent + enfants)
pkill -f "node.*server\.js" 2>/dev/null || true
pkill -f "node.*runEngine\.js" 2>/dev/null || true
pkill -f "npx vite" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Attendre que tout soit bien killé
sleep 2

# Vérification
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

echo "🚀 Démarrage du backend API (port 3331)..."
node ./backend/server.js &
BACKEND_PID=$!

echo "🚀 Démarrage de l'engine (port 3332)..."
node ./engine/runEngine.js &
ENGINE_PID=$!

sleep 10

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