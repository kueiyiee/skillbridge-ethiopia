#!/bin/bash
# ==============================================================================
# SKILLBRIDGE — cPanel Node.js Application Build & Package Script
# Generates a clean, production-ready tar.gz archive for upload to cPanel
# ==============================================================================

set -e

echo "=== [1/5] Cleaning existing build artifacts ==="
npm run clean || true
rm -rf dist release skillbridge-cpanel-deploy.tar.gz

echo "=== [2/5] Compiling Frontend SPA (Vite + React + Tailwind) ==="
npm run build

echo "=== [3/5] Compiling backend and migration runner ==="
npm run build:server

echo "=== [4/5] Preparing Production Deployment Directory ==="
mkdir -p release
cp -r dist release/
cp server.js release/
cp migrate.js release/
cp admin-provision.js release/
cp deployment/app.js release/
cp deployment/.htaccess release/
cp .env.example release/.env.example
mkdir -p release/prisma
cp -r prisma/migrations release/prisma/
cp package.json release/
cp package-lock.json release/

echo "=== [5/5] Packaging deployable archive ==="
tar -czf skillbridge-cpanel-deploy.tar.gz -C release .

echo "=============================================================================="
echo " SUCCESS: Deployment package generated -> skillbridge-cpanel-deploy.tar.gz"
echo " Size: $(du -h skillbridge-cpanel-deploy.tar.gz | cut -f1)"
echo " Ready to upload to cPanel File Manager and extract to application root."
echo "=============================================================================="
