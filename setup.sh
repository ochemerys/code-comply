#!/bin/bash

# Safety Codes Inspection System - Setup Script
# Milestone 1: Foundation & PWA Shell

set -e

echo "🚀 Setting up Safety Codes Inspection System..."
echo ""

# Check for required tools
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js >= 18.0.0"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version must be >= 18.0.0 (current: $(node -v))"
    exit 1
fi

echo "✅ Node.js $(node -v)"

if ! command -v pnpm &> /dev/null; then
    echo "📦 pnpm is not installed. Installing pnpm..."
    npm install -g pnpm
fi

echo "✅ pnpm $(pnpm -v)"

if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker is not installed. You'll need to set up PostgreSQL and Redis manually."
else
    echo "✅ Docker $(docker -v | cut -d' ' -f3 | tr -d ',')"
fi

echo ""

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

echo ""

# Setup environment variables
if [ ! -f packages/db/.env ]; then
    echo "📝 Creating packages/db/.env file..."
    cp packages/db/.env.example packages/db/.env
    echo "✅ packages/db/.env created"
else
    echo "✅ packages/db/.env already exists"
fi

if [ ! -f apps/api/.env ]; then
    echo "📝 Creating apps/api/.env file..."
    cp apps/api/.env.example apps/api/.env
    echo "✅ apps/api/.env created"
else
    echo "✅ apps/api/.env already exists"
fi

echo ""

# Start PostgreSQL and Redis with Docker
if command -v docker &> /dev/null; then
    echo "🐘 Starting PostgreSQL and Redis..."
    docker-compose up -d postgres redis
    
    echo "⏳ Waiting for services to be ready..."
    sleep 5
    
    echo "✅ Database services started"
fi

echo ""

# Generate Prisma client
echo "🔧 Generating Prisma client..."
pnpm db:generate

echo ""

# Push database schema
echo "📊 Pushing database schema..."
pnpm db:push

echo ""

# Seed database
echo "🌱 Seeding database..."
pnpm db:seed

echo ""

# Build packages
echo "🏗️  Building packages..."
pnpm build --filter=@codecomply/validators
pnpm build --filter=@codecomply/db
pnpm build --filter=@codecomply/ui
pnpm build --filter=@codecomply/utils
pnpm build --filter=@codecomply/contracts

echo ""
echo "✅ Setup complete!"
echo ""
echo "📚 Next steps:"
echo "  1. Run 'pnpm dev' to start all apps in development mode"
echo "  2. Or run individual apps:"
echo "     - pnpm inspector:dev  (Inspector PWA on http://localhost:3000)"
echo "     - pnpm admin:dev      (Admin Portal on http://localhost:3001)"
echo "     - pnpm api:dev        (API on http://localhost:4000)"
echo ""
echo "  3. Access the apps:"
echo "     - Inspector PWA: http://localhost:3000"
echo "     - Admin Portal:  http://localhost:3001"
echo "     - API Health:    http://localhost:4000/health"
echo ""
echo "📖 For more information, see _docs/development/02-initial-setup/quick-start.md"
echo ""
