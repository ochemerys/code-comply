#!/usr/bin/env bash

# Git hooks setup script
# Run this script to install pre-push hooks that run checks before pushing

set -e

HOOKS_DIR=".git/hooks"
HOOK_SOURCE="scripts/git-hooks/pre-push"
HOOK_TARGET="$HOOKS_DIR/pre-push"

echo "🔧 Setting up Git hooks..."
echo ""

# Check if .git directory exists
if [ ! -d ".git" ]; then
  echo "❌ Error: .git directory not found"
  echo "   Please run this script from the repository root"
  exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p "$HOOKS_DIR"

# Copy pre-push hook
if [ -f "$HOOK_SOURCE" ]; then
  cp "$HOOK_SOURCE" "$HOOK_TARGET"
  chmod +x "$HOOK_TARGET"
  echo "✅ Pre-push hook installed"
else
  echo "⚠️  Warning: $HOOK_SOURCE not found"
  echo "   Creating hook directly in .git/hooks/"
  
  # Create the hook directly
  cat > "$HOOK_TARGET" << 'EOF'
#!/usr/bin/env bash

# Pre-push hook to run checks before pushing to develop or main branches
# This prevents pushing broken code that would fail CI

# Get the current branch name
current_branch=$(git symbolic-ref --short HEAD 2>/dev/null)

# Only run checks for develop and main branches
if [[ "$current_branch" != "develop" && "$current_branch" != "main" ]]; then
  echo "ℹ️  Skipping pre-push checks for branch: $current_branch"
  exit 0
fi

echo "🔍 Running pre-push checks for branch: $current_branch"
echo ""

# Function to print colored output
print_status() {
  if [ $1 -eq 0 ]; then
    echo "✅ $2 passed"
  else
    echo "❌ $2 failed"
  fi
}

# Track overall status
overall_status=0

# 1. Type checking
echo "📝 Running type check..."
pnpm typecheck
typecheck_status=$?
print_status $typecheck_status "Type check"
if [ $typecheck_status -ne 0 ]; then
  overall_status=1
fi
echo ""

# 2. Linting
echo "🔍 Running linter..."
pnpm lint
lint_status=$?
print_status $lint_status "Linting"
if [ $lint_status -ne 0 ]; then
  overall_status=1
fi
echo ""

# 3. Format check
echo "💅 Checking code formatting..."
pnpm format:check
format_status=$?
print_status $format_status "Format check"
if [ $format_status -ne 0 ]; then
  echo "💡 Tip: Run 'pnpm format' to fix formatting issues"
  overall_status=1
fi
echo ""

# 4. Build
echo "🔨 Building packages..."
pnpm build
build_status=$?
print_status $build_status "Build"
if [ $build_status -ne 0 ]; then
  overall_status=1
fi
echo ""

# 5. Unit and integration tests
echo "🧪 Running unit and integration tests..."
pnpm test
test_status=$?
print_status $test_status "Tests"
if [ $test_status -ne 0 ]; then
  overall_status=1
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $overall_status -eq 0 ]; then
  echo "✅ All pre-push checks passed! Proceeding with push..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
else
  echo "❌ Pre-push checks failed!"
  echo ""
  echo "Please fix the issues above before pushing to $current_branch"
  echo ""
  echo "To bypass this check (not recommended), use:"
  echo "  git push --no-verify"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
EOF
  chmod +x "$HOOK_TARGET"
  echo "✅ Pre-push hook created"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Git hooks setup complete!"
echo ""
echo "The pre-push hook will now run these checks before pushing to develop/main:"
echo "  1. Type checking (pnpm typecheck)"
echo "  2. Linting (pnpm lint)"
echo "  3. Format checking (pnpm format:check)"
echo "  4. Build (pnpm build)"
echo "  5. Unit & integration tests (pnpm test)"
echo ""
echo "To bypass the hook (not recommended), use: git push --no-verify"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
