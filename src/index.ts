import "dotenv/config";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { Scalar } from "@scalar/hono-api-reference";
import { auth } from "./lib/auth";
import { openApiDocument } from "./lib/openapi.ts";
import copiesRoutes from "./routes/copies.ts";
import adminRoutes from "./routes/admin";
import booksRoutes from "./routes/books";
import borrowsRoutes from "./routes/borrows";
import racksRoutes from "./routes/racks.ts";
import labelsRoutes from "./routes/labels";

type AuthUser = typeof auth.$Infer.Session.user;
type AuthSession = typeof auth.$Infer.Session.session;

const app = new Hono<{ Variables: { user: AuthUser | null; session: AuthSession | null } }>();
const frontendOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";

function withExpoOrigin(request: Request) {
  const expoOrigin = request.headers.get("expo-origin");

  if (!expoOrigin) {
    return request;
  }

  const headers = new Headers(request.headers);
  headers.set("origin", expoOrigin);

  return new Request(request, { headers });
}

app.use(
  "/api/*",
  cors({
    origin: frontendOrigin,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

app.use("*", async (c, next) => {
  if (c.req.path.startsWith("/api/auth/")) {
    await next();
    return;
  }

  const session = await auth.api.getSession({ headers: withExpoOrigin(c.req.raw).headers });

  if (!session) {
    c.set("user", null);
    c.set("session", null);
    await next();
    return;
  }

  c.set("user", session.user);
  c.set("session", session.session);
  await next();
});

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(withExpoOrigin(c.req.raw)));

app.get("/session", (c) => {
  const session = c.get("session");
  const user = c.get("user");

  if (!user) return c.body(null, 401);

  return c.json({ session, user });
});

app.get("/openapi.json", (c) => c.json(openApiDocument));

app.get(
  "/docs",
  Scalar({
    theme: "kepler",
    url: "/openapi.json",
  }),
);

app.route("/api/books", booksRoutes);
app.route("/api/copies", copiesRoutes);
app.route("/api/borrows", borrowsRoutes);
app.route("/api/racks", racksRoutes);
app.route("/api/labels", labelsRoutes);
app.route("/api/admin", adminRoutes);

app.get("/", (c) => c.text("Better Auth + Hono is running"));

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "0.0.0.0";

const server = Bun.serve({
  fetch: app.fetch,
  port,
  hostname,
});

console.info(`Server listening on http://${server.hostname}:${server.port}`);

export { app };



