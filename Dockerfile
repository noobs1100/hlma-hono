FROM oven/bun:1

WORKDIR /app

COPY package.json ./
RUN bun install --production

COPY src ./src

ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]