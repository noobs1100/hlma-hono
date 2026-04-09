import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as authSchema from "./db/auth-schema";
import * as schema from "./db/schema";

type RuntimeBindings = {
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  CORS_ORIGIN?: string;
  HYPERDRIVE?: {
    connectionString: string;
  };
};

type DbInstance = ReturnType<typeof drizzle>;
type AuthInstance = ReturnType<typeof betterAuth>;

type RuntimeState = {
  key: string | null;
  pool: Pool | null;
  db: DbInstance | null;
  auth: AuthInstance | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __HLMA_RUNTIME__: RuntimeState | undefined;
}

const runtimeState: RuntimeState =
  globalThis.__HLMA_RUNTIME__ ?? {
    key: null,
    pool: null,
    db: null,
    auth: null,
  };

globalThis.__HLMA_RUNTIME__ = runtimeState;

function resolveConnectionString(bindings?: RuntimeBindings) {
  return bindings?.HYPERDRIVE?.connectionString ?? bindings?.DATABASE_URL ?? process.env.DATABASE_URL;
}

function resolveSecret(bindings?: RuntimeBindings) {
  return bindings?.BETTER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET;
}

function resolveKey(bindings?: RuntimeBindings) {
  const connectionString = resolveConnectionString(bindings);
  const secret = resolveSecret(bindings);

  return `${connectionString ?? ""}|${secret ?? ""}`;
}

export function configureRuntime(bindings?: RuntimeBindings) {
  const connectionString = resolveConnectionString(bindings);
  const secret = resolveSecret(bindings);

  if (!connectionString) {
    throw new Error("DATABASE_URL or HYPERDRIVE.connectionString is required");
  }

  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required");
  }

  const key = resolveKey(bindings);

  if (runtimeState.key === key && runtimeState.db && runtimeState.auth) {
    return runtimeState;
  }

  runtimeState.pool?.end().catch(() => undefined);

  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
  });

  const db = drizzle(pool, { schema: { ...schema, ...authSchema }, casing: "snake_case" });
  const auth = betterAuth({
    secret,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: authSchema,
    }),
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const existingUsers = await db.select({ id: authSchema.user.id }).from(authSchema.user).limit(1);

            if (existingUsers.length === 0) {
              return {
                data: {
                  ...user,
                  role: "admin",
                },
              };
            }
          },
        },
      },
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: true,
          defaultValue: "user",
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
  });

  runtimeState.key = key;
  runtimeState.pool = pool;
  runtimeState.db = db;
  runtimeState.auth = auth;

  return runtimeState;
}

function getDbInstance() {
  if (!runtimeState.db) {
    configureRuntime();
  }

  if (!runtimeState.db) {
    throw new Error("Database has not been configured");
  }

  return runtimeState.db;
}

function getAuthInstance() {
  if (!runtimeState.auth) {
    configureRuntime();
  }

  if (!runtimeState.auth) {
    throw new Error("Auth has not been configured");
  }

  return runtimeState.auth;
}

export type Db = DbInstance;
export type Auth = AuthInstance;

export const db = new Proxy({} as DbInstance, {
  get(_target, property, receiver) {
    const instance = getDbInstance();
    const value = Reflect.get(instance, property, receiver);

    if (typeof value === "function") {
      return value.bind(instance);
    }

    return value;
  },
}) as DbInstance;

export const auth = new Proxy({} as AuthInstance, {
  get(_target, property, receiver) {
    const instance = getAuthInstance();
    const value = Reflect.get(instance, property, receiver);

    if (typeof value === "function") {
      return value.bind(instance);
    }

    return value;
  },
}) as AuthInstance;