# Subscription System

Subscription management platform.

## Stack

- TypeScript
- Next.js
- PostgreSQL
- Prisma
- Zod
- Vitest
- Docker

## Setup

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm prisma migrate dev --name init
pnpm prisma db seed
pnpm dev
