# ARCHITECTURE OVERVIEW

## System Topology
- Client-Server Architecture.
- API-First design pattern.
- Separated UI (Frontend) and Business Logic (Backend).

## Primary Goal
A multi-tenant School Management SaaS

## Architecture Directives
1. Strict adherence to contracts in API_SPEC.md and Database schemas.
2. Absolutely no business logic in UI templates/components.
3. Decoupled services for third-party integrations: - 1. PostgreSQL (Multi-tenant schema isolation)
- 2. Redis (Session & Cache management)
- 3. AWS S3 (Student document storage)
- 1.Stripe/PayPal (School fee payments)
- 4.GitHub Actions (CI/CD Pipeline)
