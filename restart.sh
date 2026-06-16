#!/bin/bash
# CockpitAI — Redémarrer les 3 services
set -e

cd /home/ai_agent/projects/cockpitAI

echo "⏹  Arrêt des processus existants..."
# Backend
lsof -ti:3331 2>/dev/null | xargs kill 2>/dev/null || true
# Engine
lsof -ti:3332 2>/dev/null | xargs kill 2>/dev/null || true
# Frontend
lsof -ti:3333 2>/dev/null | xargs kill 2>/dev/null || true
sleep 1

echo "🚀 Démarrage du backend API (port 3331)..."
node ./backend/server.js &
BACKEND_PID=$!

echo "🚀 Démarrage de l'engine (port 3332)..."
node ./engine/runEngine.js &
ENGINE_PID=$!

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
echo ""
echo "Pour arrêter : pkill -f 'node.*server.js'; pkill -f 'node.*runEngine.js'; pkill -f 'npx vite'"
