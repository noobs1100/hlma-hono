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
