# DATABASE DESIGN

## Database Engine
- Recommended: PostgreSQL (for multi-tenant safety/schemas).

## Core Schemas / Models
- **Tenant:** id, domain, status, createdAt
- **User:** id, tenantId, email, role, passwordHash
- **Profile:** id, userId, firstName, lastName

## Isolation Strategy
- Row-Level Security (RLS) or schema-per-tenant to prevent cross-tenant data leaks.
