# Git Hooks

This directory contains Git hooks that help maintain code quality by running checks before certain Git operations.

## Available Hooks

### Pre-Push Hook

The pre-push hook runs automatically before pushing to `develop` or `main` branches. It performs the following checks:

1. **Type checking** - Ensures TypeScript types are valid
2. **Linting** - Checks code style and potential errors
3. **Format checking** - Verifies code formatting with Prettier
4. **Build** - Ensures all packages build successfully
5. **Unit & Integration Tests** - Runs all tests

## Installation

### Automatic Installation

Run the setup script from the repository root:

```bash
./scripts/setup-git-hooks.sh
```

### Manual Installation

Copy the hook to your `.git/hooks` directory:

```bash
cp scripts/git-hooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

## Usage

Once installed, the hook runs automatically when you push to `develop` or `main`:

```bash
git push origin develop
```

**Output example:**

```
🔍 Running pre-push checks for branch: develop

📝 Running type check...
✅ Type check passed

🔍 Running linter...
✅ Linting passed

💅 Checking code formatting...
✅ Format check passed

🔨 Building packages...
✅ Build passed

🧪 Running unit and integration tests...
✅ Tests passed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All pre-push checks passed! Proceeding with push...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Bypassing the Hook

If you need to bypass the hook (not recommended), use:

```bash
git push --no-verify
```

**⚠️ Warning:** Bypassing the hook may result in CI failures and blocked deployments.

## Benefits

✅ **Catch issues early** - Find problems before pushing  
✅ **Faster feedback** - No need to wait for CI to fail  
✅ **Save CI minutes** - Reduce failed CI runs  
✅ **Prevent broken deployments** - Ensure code quality  
✅ **Team consistency** - Everyone runs the same checks

## Troubleshooting

### Hook not running

1. Check if the hook is executable:

   ```bash
   ls -la .git/hooks/pre-push
   ```

2. If not executable, make it executable:

   ```bash
   chmod +x .git/hooks/pre-push
   ```

3. Verify the hook exists:
   ```bash
   cat .git/hooks/pre-push
   ```

### Hook runs on feature branches

The hook only runs on `develop` and `main` branches. For feature branches, it will skip checks:

```
ℹ️  Skipping pre-push checks for branch: feature/my-feature
```

### Checks take too long

If the checks are too slow, you can:

1. **Run checks manually** before pushing:

   ```bash
   pnpm typecheck && pnpm lint && pnpm build && pnpm test
   ```

2. **Bypass the hook** (not recommended):

   ```bash
   git push --no-verify
   ```

3. **Optimize your tests** - Use test filtering or parallel execution

## Customization

To modify what checks run, edit `scripts/git-hooks/pre-push` and run the setup script again:

```bash
./scripts/setup-git-hooks.sh
```

## Team Setup

When a new team member clones the repository, they should run:

```bash
pnpm install
./scripts/setup-git-hooks.sh
```

Consider adding this to your onboarding documentation.
