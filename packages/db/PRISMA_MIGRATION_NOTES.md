# Prisma Configuration Notes

## Current Setup (Prisma 5.x)

The project currently uses Prisma 5.22.0 with the standard configuration:

- Database URL is defined in `schema.prisma` using `url = env("DATABASE_URL")`
- This is the correct and supported approach for Prisma 5.x

## Future Migration to Prisma 7

When upgrading to Prisma 7, the following changes will be required:

### 1. Create `prisma/prisma.config.ts`

```typescript
import { defineConfig } from '@prisma/client'

export default defineConfig({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})
```

### 2. Update `schema.prisma`

Remove the `url` property from the datasource block:

```prisma
datasource db {
  provider = "postgresql"
  // url property removed - now configured in prisma.config.ts
}
```

### 3. Update `src/client.ts`

Pass the datasource URL to the PrismaClient constructor:

```typescript
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasourceUrl: process.env.DATABASE_URL,
  })
```

## References

- [Prisma 7 Config Documentation](https://pris.ly/d/config-datasource)
- [Prisma 7 Client Configuration](https://pris.ly/d/prisma7-client-config)

## Action Required

**Do not make these changes until upgrading to Prisma 7.** The current configuration is correct for Prisma 5.x.

If you're seeing warnings about this, they are forward-compatibility warnings that can be safely ignored until you're ready to upgrade to Prisma 7.
