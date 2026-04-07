# Deploy on Railway

This project can be deployed on Railway with:

- one `MySQL` service
- one `app` service built from this repository

The repository now includes:

- a production `Dockerfile` for Railway
- a `railway.json` with:
  - `preDeployCommand: npm run db:init`
  - healthcheck on `/api/health`
- an idempotent database bootstrap script at `scripts/init-db.mjs`

## 1. Create the Railway project

1. Create a new Railway project.
2. Add a `MySQL` service.
3. Add a new service from your GitHub repository for this app.

## 2. Configure app variables

Railway MySQL exposes variables on the database service. In the app service, add references so the app can read them.

Set these variables on the app service:

```env
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
DB_SEED_TEST_DATA=true
NODE_ENV=production
```

The server now reads these `DB_*` variables directly at runtime.
This avoids the common Docker + Nuxt issue where database values get frozen during image build.

Optional:

```env
WS_URL=wss://${{RAILWAY_PUBLIC_DOMAIN}}
```

If you do not want the 5 local test accounts to be created on Railway, set:

```env
DB_SEED_TEST_DATA=false
```

## 3. Deploy

Once the variables are set:

1. Trigger a deploy.
2. Railway builds the image from `Dockerfile`.
3. Before the app starts, Railway runs `npm run db:init`.
4. The app becomes healthy when `/api/health` can reach MySQL.

## 4. What the bootstrap script does

`npm run db:init`:

- connects to MySQL
- creates the configured database if allowed
- creates the required tables if missing
- inserts the 78 tarot cards if missing
- optionally inserts the 5 test users if missing

It is safe to run on every deploy.

## 5. Local Docker development

Local Docker development still uses `Dockerfile.dev` through `docker-compose.yml`.

Use:

```bash
docker compose up --build
```

## 6. Troubleshooting

If the app deploys but cannot connect to the database:

- verify the app service variables point to the MySQL service references
- verify the MySQL service is in the same Railway project/environment
- open the deploy logs and confirm `npm run db:init` completed successfully
- check `/api/health`

## 7. Useful commands

Build locally:

```bash
npm run build
```

Initialize the configured database manually:

```bash
npm run db:init
```
