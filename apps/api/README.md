# CodeComply Connect API

RESTful API built with [Hono](https://hono.dev/) for CodeComply — the open source inspection management system.

## Features

- 🚀 Fast and lightweight Hono framework
- 📚 Interactive Swagger UI documentation
- 🔒 JWT-based authentication
- ✅ Request validation with Zod
- 🗄️ Prisma ORM for database operations
- 🧪 Comprehensive test coverage with Vitest
- 📝 OpenAPI 3.0 specification

## Quick Start

### Development

```bash
# From the monorepo root
pnpm api:dev

# Or from this directory
pnpm dev
```

The API will start on `http://localhost:4000`

### Run All Applications

To run the API along with the Inspector PWA and Admin Portal:

```bash
# From the monorepo root
pnpm dev:all
```

This will start:

- **API Server**: http://localhost:4000 (Swagger UI: http://localhost:4000/swagger)
- **Inspector PWA**: http://localhost:3000
- **Admin Portal**: http://localhost:3001

````

### API Documentation

Once the server is running, you can access:

- **Swagger UI**: http://localhost:4000/swagger
- **OpenAPI Spec**: http://localhost:4000/openapi.json

## Available Endpoints

### Health Check
- `GET /health` - Health check endpoint

### Authentication
- `POST /auth/login` - Login with email and password
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout and invalidate session
- `GET /auth/me` - Get current user profile (requires authentication)

## Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Server
PORT=4000
HOST=0.0.0.0
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/inspections"

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# CORS
INSPECTOR_URL=http://localhost:3000
ADMIN_URL=http://localhost:3001
EXTRA_CORS_ORIGINS=
````

## Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm test` - Run tests
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:coverage` - Run tests with coverage
- `pnpm lint` - Lint code
- `pnpm lint:fix` - Lint and fix code
- `pnpm type-check` - Type check without emitting

## Project Structure

```
src/
├── mappers/          # Data mappers (Entity ↔ DTO)
├── middleware/       # Custom middleware
├── routes/           # API route handlers
├── services/         # Business logic services
├── utils/            # Utility functions
├── app.ts           # Hono app configuration with OpenAPI
└── index.ts         # Server entry point
```

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## Adding New Routes

1. Create a new route file in `src/routes/`
2. Define your routes with OpenAPI documentation
3. Register the route in `src/app.ts`

Example:

```typescript
import { OpenAPIHono } from '@hono/zod-openapi'
import { createRoute } from '@hono/zod-openapi'
import { z } from 'zod'

const route = createRoute({
  method: 'get',
  path: '/example',
  tags: ['Example'],
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
  },
})

const app = new OpenAPIHono()
app.openapi(route, (c) => {
  return c.json({ message: 'Hello World' })
})

export default app
```

## Deployment

The API can be deployed to any Node.js hosting platform:

- Render
- Railway
- Fly.io
- AWS Lambda (with adapter)
- Vercel (with adapter)

See the [public CI workflow](../../.github/workflows/public-ci.yml) for deployment instructions.

## License

MIT
