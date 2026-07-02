#!/bin/bash
set -e

echo "=========================================="
echo "Starting All-in-One E2E Test Container"
echo "=========================================="

# Create log directory
mkdir -p /var/log/supervisor

# Start PostgreSQL in background
echo "Starting PostgreSQL..."
su - postgres -c "/usr/lib/postgresql/*/bin/postgres -D /var/lib/postgresql/data" &
POSTGRES_PID=$!

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if su - postgres -c "pg_isready -U postgres" > /dev/null 2>&1; then
        echo "PostgreSQL is ready!"
        break
    fi
    echo "Waiting for PostgreSQL... ($i/30)"
    sleep 1
done

# Create database and user
echo "Setting up database..."
su - postgres -c "psql -c \"CREATE USER inspector WITH PASSWORD 'test_password';\"" || true
su - postgres -c "psql -c \"CREATE DATABASE inspections_test OWNER inspector;\"" || true
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE inspections_test TO inspector;\"" || true

# Run migrations
echo "Running database migrations..."
cd /app/packages/db
pnpm prisma migrate deploy
cd /app

# Seed database (optional)
echo "Seeding database..."
pnpm --filter @codecomply/db seed || echo "No seed script or seeding failed, continuing..."

# Start API
echo "Starting API server..."
cd /app
PORT=4000 NODE_ENV=test pnpm --filter @codecomply/api start &
API_PID=$!

# Wait for API to be ready
echo "Waiting for API to be ready..."
for i in {1..60}; do
    if wget --no-verbose --tries=1 --spider http://localhost:4000/health > /dev/null 2>&1; then
        echo "API is ready!"
        break
    fi
    echo "Waiting for API... ($i/60)"
    sleep 1
done

# Start Inspector PWA
echo "Starting Inspector PWA..."
cd /app
pnpm --filter @codecomply/inspector preview --port 5175 --host 0.0.0.0 &
INSPECTOR_PID=$!

# Start Admin Portal
echo "Starting Admin Portal..."
cd /app
pnpm --filter @codecomply/admin preview --port 5174 --host 0.0.0.0 &
ADMIN_PID=$!

# Wait for UIs to be ready
echo "Waiting for UIs to be ready..."
sleep 10

# Check if all services are running
echo "Checking service health..."
echo "- PostgreSQL: $(su - postgres -c 'pg_isready -U postgres' && echo 'OK' || echo 'FAIL')"
echo "- API: $(wget --no-verbose --tries=1 --spider http://localhost:4000/health 2>&1 | grep -q '200 OK' && echo 'OK' || echo 'FAIL')"
echo "- Inspector: $(wget --no-verbose --tries=1 --spider http://localhost:5175 2>&1 | grep -q '200 OK' && echo 'OK' || echo 'FAIL')"
echo "- Admin: $(wget --no-verbose --tries=1 --spider http://localhost:5174 2>&1 | grep -q '200 OK' && echo 'OK' || echo 'FAIL')"

# Run E2E tests
echo "=========================================="
echo "Running E2E Tests"
echo "=========================================="
cd /app

# Set environment variables for E2E tests
export E2E_API_URL=http://localhost:4000
export E2E_INSPECTOR_URL=http://localhost:5175
export E2E_ADMIN_URL=http://localhost:5174
export DATABASE_URL=postgresql://inspector:test_password@localhost:5432/inspections_test

# Run tests and capture exit code
TAG_EXPR="not @wip"
if [ -n "$TEST_TAGS" ]; then
    TAG_EXPR="$TAG_EXPR and ($TEST_TAGS)"
    echo "Running tests with tags: $TAG_EXPR"
else
    echo "Running tests with tags: $TAG_EXPR"
fi

# Same as packages/e2e-tests `test:docker`, plus --tags, from the e2e package dir so
# `NODE_OPTIONS=--import tsx` resolves `tsx` (repo root cwd breaks module resolution).
# Do not use `pnpm run test:docker -- --tags ...`: pnpm injects `--` before forwarded args
# and cucumber-js then treats `--tags` as a feature path → 0 scenarios with exit 0.
export NODE_OPTIONS='--import tsx --no-warnings'
cd /app/packages/e2e-tests
pnpm exec cucumber-js --config cucumber.cjs --tags "$TAG_EXPR"
TEST_EXIT_CODE=$?

# Save test results
echo "=========================================="
echo "Test Results"
echo "=========================================="
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All E2E tests passed!"
else
    echo "❌ E2E tests failed with exit code: $TEST_EXIT_CODE"
fi

# Copy test results to output directory
mkdir -p /test-results
cp -r /app/packages/e2e-tests/reports/* /test-results/ 2>/dev/null || echo "No test reports found"
cp -r /app/packages/e2e-tests/test-results/* /test-results/ 2>/dev/null || echo "No test artifacts found"

# Show logs
echo "=========================================="
echo "Service Logs"
echo "=========================================="
echo "--- API Logs (last 50 lines) ---"
tail -50 /var/log/supervisor/api.log 2>/dev/null || echo "No API logs"

echo "--- Inspector Logs (last 20 lines) ---"
tail -20 /var/log/supervisor/inspector.log 2>/dev/null || echo "No Inspector logs"

echo "--- Admin Logs (last 20 lines) ---"
tail -20 /var/log/supervisor/admin.log 2>/dev/null || echo "No Admin logs"

# Keep container running if requested (for debugging)
if [ "$KEEP_RUNNING" = "true" ]; then
    echo "=========================================="
    echo "Container will keep running for debugging"
    echo "Services are available at:"
    echo "  - API: http://localhost:4000"
    echo "  - Inspector: http://localhost:5175"
    echo "  - Admin: http://localhost:5174"
    echo "  - PostgreSQL: localhost:5432"
    echo "=========================================="
    
    # Keep services running
    wait $API_PID $INSPECTOR_PID $ADMIN_PID $POSTGRES_PID
else
    # Cleanup
    echo "Stopping services..."
    kill $API_PID $INSPECTOR_PID $ADMIN_PID 2>/dev/null || true
    su - postgres -c "/usr/lib/postgresql/*/bin/pg_ctl stop -D /var/lib/postgresql/data -m fast" || true
    
    # Exit with test exit code
    exit $TEST_EXIT_CODE
fi
