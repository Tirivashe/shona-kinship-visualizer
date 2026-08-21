# Shona Family

A Next.js application for building a family graph and resolving Shona
kinship dynamically from an Ego's perspective.

## Local development

Requirements:

- Docker Desktop
- Node.js and pnpm
- The local `postgres:alpine` image

Copy the development environment template if `.env` does not already exist:

```powershell
Copy-Item .env.example .env
```

The default local credentials are development-only. Change them before using
the database outside your own machine.

Start PostgreSQL and wait for it to become healthy:

```powershell
docker compose up -d postgres
docker compose ps
```

Install dependencies, apply committed database migrations, and start Next.js:

```powershell
pnpm install
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The database health check
is available at
[http://localhost:3000/api/health/database](http://localhost:3000/api/health/database).

The `postgres:alpine` tag is intentionally used by `compose.yaml` as required
for this local environment. It is a moving tag; the image currently installed
on the development machine is PostgreSQL 18.6. The named volume is mounted at
`/var/lib/postgresql`, which matches PostgreSQL 18's image layout.

## Database workflow

The Drizzle schema is in `src/db/schema.ts`. After changing it, generate and
apply a migration:

```powershell
pnpm db:generate
pnpm db:migrate
```

To inspect the database from the container:

```powershell
docker compose exec postgres psql -U shona_app -d shona_family
```

`docker compose down` stops the services without deleting family data. Do not
use `docker compose down -v` unless you deliberately want to erase the named
database volume.

## Validation

```powershell
pnpm test
pnpm lint
pnpm build
```
