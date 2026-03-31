#!/bin/bash
set -e
echo "=== BaseUSDP Development Setup ==="

# Check Node version
REQUIRED_NODE=18
CURRENT_NODE=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$CURRENT_NODE" -lt "$REQUIRED_NODE" ]; then
  echo "Error: Node.js v${REQUIRED_NODE}+ required (found v${CURRENT_NODE})"
  exit 1
fi
echo "Node.js version: $(node -v) ✓"

# Install dependencies
echo "Installing dependencies..."
npm ci

# Create env file
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "Created .env.local from .env.example"
  echo "Please edit .env.local with your configuration"
else
  echo ".env.local already exists"
fi

echo ""
echo "=== Setup Complete ==="
echo "Run 'npm run dev' to start development server"
