To install dependencies:
```sh
bun install
```

To run the local Postgres database:
```sh
docker compose up -d
```

To run the app:
```sh
bun run dev
```

open http://localhost:3000

Auth endpoints live under `http://localhost:3000/api/auth/*`.

## Railway deployment

This repo is deployable on Railway with the included `Dockerfile` and `railway.toml`.

Required environment variables:
- `DATABASE_URL`: Railway Postgres connection string
- `BETTER_AUTH_SECRET`: strong random secret for Better Auth
- `BETTER_AUTH_URL`: public backend URL for auth callbacks
- `CORS_ORIGIN`: frontend origin allowed to call the API, if different from the backend URL

Railway will run the app on the `PORT` it provides automatically.

## Cloudflare Workers branch

The `cloudflare-workers` branch adds a Cloudflare Workers deployment path that uses `wrangler.toml` and a Hyperdrive-backed PostgreSQL connection.

Required Cloudflare-side setup:
- `HYPERDRIVE`: bind it to your existing PostgreSQL database
- `BETTER_AUTH_SECRET`: set as a secret in Workers
- `BETTER_AUTH_URL`: set to your Workers public URL
- `CORS_ORIGIN`: set to your Expo web or app origin if needed

Run locally with Wrangler after installing it globally or via `npx`:
```sh
wrangler dev
```
