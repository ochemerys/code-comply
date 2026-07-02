# Authentication Tests

This directory contains comprehensive unit and integration tests for the authentication system fixes implemented in **CodeComply Admin** and **CodeComply Field**.

## Test Coverage

### Issues Covered

The tests cover the following authentication issues that were fixed:

1. **Session Restoration with Profile Fetching**
   - Tests that `restoreSession()` fetches user profile from `/auth/me`
   - Verifies Authorization header is sent with stored access token
   - Ensures user data is properly restored from API response

2. **Role-Based Access Control**
   - CodeComply Admin: Verifies only ADMIN users can access
   - CodeComply Field: Verifies only SCO users can access
   - Tests rejection of users with incorrect roles

3. **Token Management**
   - Tests token storage in localStorage
   - Verifies token updates and refresh functionality
   - Tests token validation and expiration handling

4. **Authorization Header Handling**
   - Tests that fetch requests include `Authorization: Bearer <token>` header
   - Verifies profile fetching during login and session restore
   - Tests API calls with proper authentication

5. **Session Cleanup**
   - Tests logout clears all auth state
   - Verifies localStorage is cleared on logout
   - Tests session cleanup on invalid tokens

6. **Offline Grace Period** (CodeComply Field only)
   - Tests offline grace period is set on login
   - Verifies grace period expiration logic
   - Tests grace period restoration on session restore

## Test Files

### CodeComply Admin

- **`apps/admin/src/stores/auth.spec.ts`**
  - Tests for the auth store (Pinia)
  - Covers login, logout, restoreSession, updateTokens
  - Tests computed properties (isAuthenticated, isAdmin)
  - Tests role-based access control

- **`apps/admin/src/composables/useAuth.spec.ts`**
  - Tests for the useAuth composable
  - Covers login flow with profile fetching
  - Tests logout with API calls
  - Tests token refresh functionality
  - Verifies Authorization headers are sent

### CodeComply Field

- **`apps/inspector/src/stores/auth.spec.ts`**
  - Tests for the auth store (Pinia)
  - Covers login, logout, restoreSession, updateTokens
  - Tests offline grace period functionality
  - Tests computed properties (certifications, disciplines)
  - Tests role-based access control for SCO users

- **`apps/inspector/src/composables/useAuth.spec.ts`**
  - Tests for the useAuth composable
  - Covers login flow with profile fetching
  - Tests logout with API calls
  - Tests token refresh functionality
  - Tests offline grace period checking
  - Verifies Authorization headers are sent

## Running Tests

### CodeComply Admin

```bash
# Run all tests
cd apps/admin
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### CodeComply Field

```bash
# Run all tests
cd apps/inspector
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### Run All Tests from Root

```bash
# Run tests for both apps
pnpm test --filter=@codecomply/admin --filter=@codecomply/inspector
```

## Test Setup

Both apps use:

- **Vitest** as the test runner
- **jsdom** for DOM environment
- **@vue/test-utils** for Vue component testing
- **Pinia** for state management testing

### Setup Files

- `apps/admin/src/test/setup.ts` - Test setup for admin app
- `apps/inspector/src/test/setup.ts` - Test setup for inspector app

These files mock:

- `localStorage` for token storage testing
- `console` methods to reduce test noise
- Global `fetch` for API call testing

## Key Test Scenarios

### 1. Session Restoration

```typescript
it('should restore session with valid tokens and fetch user profile', async () => {
  // Setup: Store tokens in localStorage
  localStorage.setItem('accessToken', 'valid-token')

  // Mock: API returns user profile
  fetch.mockResolvedValue({
    ok: true,
    json: async () => mockUserProfile,
  })

  // Test: Restore session
  const result = await authStore.restoreSession()

  // Verify: Session restored with user data
  expect(result).toBe(true)
  expect(authStore.user).toEqual(mockUserProfile)

  // Verify: Authorization header was sent
  expect(fetch).toHaveBeenCalledWith('http://localhost:4000/auth/me', {
    headers: { Authorization: 'Bearer valid-token' },
  })
})
```

### 2. Login with Profile Fetching

```typescript
it('should successfully login and fetch user profile', async () => {
  // Mock: Login API returns tokens
  apiClient.auth.login.$post.mockResolvedValue({
    ok: true,
    json: async () => mockTokens,
  })

  // Mock: Profile API returns user data
  fetch.mockResolvedValue({
    ok: true,
    json: async () => mockUserProfile,
  })

  // Test: Login
  await login(credentials)

  // Verify: Tokens and user stored
  expect(authStore.accessToken).toBe('test-access-token')
  expect(authStore.user).toEqual(mockUserProfile)

  // Verify: Authorization header sent to /auth/me
  expect(fetch).toHaveBeenCalledWith('http://localhost:4000/auth/me', {
    headers: { Authorization: 'Bearer test-access-token' },
  })
})
```

### 3. Role-Based Access Control

```typescript
it('should reject non-admin users', async () => {
  // Mock: User with SCO role
  const scoUser = { ...mockUser, role: 'SCO' }

  // Test: Attempt login
  await expect(authStore.login(credentials, tokens, scoUser)).rejects.toThrow(
    'Access denied: Admin privileges required',
  )

  // Verify: Session not created
  expect(authStore.user).toBeNull()
  expect(authStore.accessToken).toBeNull()
})
```

## Regression Prevention

These tests ensure that:

1. **Authorization headers are always sent** when fetching user profiles
2. **Session restoration fetches user data** instead of just restoring tokens
3. **Role validation happens** during both login and session restore
4. **Tokens are properly stored** in localStorage with correct keys
5. **Session cleanup is complete** on logout or invalid tokens
6. **Offline grace period** is properly managed (CodeComply Field)

## CI/CD Integration

These tests should be run in CI/CD pipelines to prevent regression of the authentication fixes:

```yaml
# Example GitHub Actions workflow
- name: Test CodeComply Admin
  run: pnpm test --filter=@codecomply/admin

- name: Test CodeComply Field
  run: pnpm test --filter=@codecomply/inspector
```

## Future Improvements

- Add E2E tests for complete authentication flows
- Add tests for token refresh on expiration
- Add tests for concurrent session handling
- Add tests for network error scenarios
- Add performance tests for session restoration

---

**Last Updated:** February 2025  
**Related Issues:** Authentication 401 errors, Session restoration, Authorization headers
