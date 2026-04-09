FROM oven/bun:1.2.22-alpine

WORKDIR /app

COPY package.json bun.lock tsconfig.json drizzle.config.ts ./
COPY src ./src

RUN bun install --frozen-lockfile

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]