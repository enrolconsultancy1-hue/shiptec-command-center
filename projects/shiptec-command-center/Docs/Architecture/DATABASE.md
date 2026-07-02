---
type: SHIPTEC Artifact
title: DATABASE DESIGN
description: Migrated artifact
tags: [shiptec]
timestamp: 2026-07-02T17:07:55.976Z
---

# DATABASE DESIGN

## Database Engine
- Recommended: PostgreSQL (for multi-tenant safety/schemas).

## Core Schemas / Models
- **Tenant:** id, domain, status, createdAt
- **User:** id, tenantId, email, role, passwordHash
- **Profile:** id, userId, firstName, lastName

## Isolation Strategy
- Row-Level Security (RLS) or schema-per-tenant to prevent cross-tenant data leaks.
