#!/bin/bash
set -e
echo "=== Cleaning BaseUSDP build artifacts ==="

echo "Removing node_modules..."
rm -rf node_modules

echo "Removing .next build cache..."
rm -rf .next

echo "Removing dist directory..."
rm -rf dist

echo "Removing coverage reports..."
rm -rf coverage

echo "Removing TypeScript build info..."
rm -f tsconfig.tsbuildinfo

echo "Reinstalling dependencies..."
npm ci

echo "=== Clean complete ==="
