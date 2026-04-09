import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../lib/auth";
import { db } from "../db/db";
import { locations } from "../db/schema";

type AuthUser = typeof auth.$Infer.Session.user;
type AuthSession = typeof auth.$Infer.Session.session;

type AppVariables = {
  user: AuthUser | null;
  session: AuthSession | null;
};

const createRackSchema = z.object({
  rackId: z.string().trim().min(1, "Rack ID is required"),
  room: z.string().trim().min(1, "Room is required"),
  cupboard: z.string().trim().min(1, "Cupboard is required"),
  rack: z.string().trim().min(1, "Rack is required"),
  description: z.string().trim().optional().nullable(),
});

const updateRackSchema = z.object({
  room: z.string().trim().min(1, "Room is required").optional(),
  cupboard: z.string().trim().min(1, "Cupboard is required").optional(),
  rack: z.string().trim().min(1, "Rack is required").optional(),
  description: z.string().trim().nullable().optional(),
});

function requireAdmin(c: { get: (key: "user") => AuthUser | null }) {
  const user = c.get("user");

  if (!user || user.role !== "admin") return null;

  return user;
}

async function insertRack(payload: {
  rackId: string;
  room: string;
  cupboard: string;
  rack: string;
  description: string | null;
}) {
  const existing = await db.select().from(locations).where(eq(locations.rackId, payload.rackId)).limit(1);

  if (existing.length) {
    throw new Error("RACK_ID_ALREADY_EXISTS");
  }

  const inserted = await db
    .insert(locations)
    .values({
      rackId: payload.rackId,
      room: payload.room,
      cupboard: payload.cupboard,
      rack: payload.rack,
      description: payload.description,
    })
    .returning();

  return inserted[0] ?? null;
}

const racksRoutes = new Hono<{ Variables: AppVariables }>();

racksRoutes.get("/", async (c) => {
  const user = requireAdmin(c);

  if (!user) return c.json({ message: "Forbidden: admin access required" }, 403);

  const allRacks = await db.select().from(locations).orderBy(desc(locations.rackId));
  return c.json(allRacks);
});

racksRoutes.get("/:rackId", async (c) => {
  const user = requireAdmin(c);

  if (!user) return c.json({ message: "Forbidden: admin access required" }, 403);

  const rackId = c.req.param("rackId");
  const rack = await db.select().from(locations).where(eq(locations.rackId, rackId)).limit(1);

  if (!rack.length) {
    return c.json({ message: "Rack not found" }, 404);
  }

  return c.json(rack[0]);
});

racksRoutes.post("/", async (c) => {
  const user = requireAdmin(c);

  if (!user) return c.json({ message: "Forbidden: admin access required" }, 403);

  const body = await c.req.json().catch(() => null);
  const parsed = createRackSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ message: "Invalid rack payload", issues: parsed.error.flatten() }, 400);
  }

  try {
    const inserted = await insertRack({
      rackId: parsed.data.rackId,
      room: parsed.data.room,
      cupboard: parsed.data.cupboard,
      rack: parsed.data.rack,
      description: parsed.data.description ?? null,
    });

    return c.json(inserted, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "RACK_ID_ALREADY_EXISTS") {
      return c.json({ message: "Rack ID already exists" }, 409);
    }

    throw error;
  }
});

racksRoutes.patch("/:rackId", async (c) => {
  const user = requireAdmin(c);

  if (!user) return c.json({ message: "Forbidden: admin access required" }, 403);

  const rackId = c.req.param("rackId");
  const body = await c.req.json().catch(() => null);
  const parsed = updateRackSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ message: "Invalid rack payload", issues: parsed.error.flatten() }, 400);
  }

  const current = await db.select().from(locations).where(eq(locations.rackId, rackId)).limit(1);
  if (!current.length) return c.json({ message: "Rack not found" }, 404);

  const values: Record<string, string | null> = {};

  if (parsed.data.room !== undefined) values.room = parsed.data.room;
  if (parsed.data.cupboard !== undefined) values.cupboard = parsed.data.cupboard;
  if (parsed.data.rack !== undefined) values.rack = parsed.data.rack;
  if (parsed.data.description !== undefined) values.description = parsed.data.description;

  if (Object.keys(values).length === 0) {
    return c.json({ message: "No valid fields to update" }, 400);
  }

  const updated = await db
    .update(locations)
    .set(values)
    .where(eq(locations.rackId, rackId))
    .returning();

  return c.json(updated[0]);
});

racksRoutes.delete("/:rackId", async (c) => {
  const user = requireAdmin(c);

  if (!user) return c.json({ message: "Forbidden: admin access required" }, 403);

  const rackId = c.req.param("rackId");
  try {
    const deleted = await db.delete(locations).where(eq(locations.rackId, rackId)).returning();

    if (!deleted.length) {
      return c.json({ message: "Rack not found" }, 404);
    }

    return c.json({ message: "Rack deleted", rack: deleted[0] });
  } catch (error) {
    const databaseError = error as {
      code?: string;
      cause?: { code?: string; constraint?: string };
    };
    const errorCode = databaseError.code ?? databaseError.cause?.code;

    if (errorCode === "23503") {
      return c.json({ message: "Cannot delete a rack that still has copies assigned to it" }, 409);
    }

    throw error;
  }
});

export default racksRoutes;