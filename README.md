To install dependencies:
```sh
bun install
```

To generate a new migration from the current schema:
```sh
bun run db:generate -- --name your_migration_name
```

To apply migrations to the configured database:
```sh
bun run db:migrate
```

To run the local Postgres database:
```sh
docker compose up -d
```

To build and run the API in Docker:
```sh
docker build -t hlma-hono:latest .
docker run --rm -p 3000:3000 \
	-e HOST=0.0.0.0 \
	-e PORT=3000 \
	-e BETTER_AUTH_URL='http://192.168.168.72:3000' \
	-e DATABASE_URL='postgresql://neondb_owner:npg_9ltPQgk1brhs@ep-blue-mountain-a15juag7.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' \
	-e BETTER_AUTH_SECRET='4b2e9d6c1c7b4f39b4a4d7b7f4b8c9d2' \
	hlma-hono:latest
```

To run the app:
```sh
bun run dev
```

open http://localhost:3000

Auth endpoints live under `http://localhost:3000/api/auth/*`.
