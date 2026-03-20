import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../lib/auth";
import { db } from "../db/db";
import { books, copies, locations } from "../db/schema";

type AuthUser = typeof auth.$Infer.Session.user;
type AuthSession = typeof auth.$Infer.Session.session;

type AppVariables = {
  user: AuthUser | null;
  session: AuthSession | null;
};

const createCopySchema = z.object({
  copyId: z.string().trim().min(1, "Copy ID is required"),
  bookId: z.string().uuid(),
  rackId: z.string().min(1, "Rack ID is required"),
  status: z.enum(["borrowed", "available"]).default("available"),
  borrowedByUserId: z.string().min(1).optional(),
});

const updateCopySchema = z.object({
  bookId: z.string().uuid().optional(),
  rackId: z.string().min(1, "Rack ID is required").optional(),
  status: z.enum(["borrowed", "available"]).optional(),
  borrowedByUserId: z.string().min(1).nullable().optional(),
});

function requireUser(c: { get: (key: "user") => AuthUser | null }) {
  return c.get("user");
}

function requireAdmin(c: { get: (key: "user") => AuthUser | null }) {
  const user = requireUser(c);

  if (!user || user.role !== "admin") return null;

  return user;
}

async function ensureBookExists(bookId: string) {
  const book = await db.select().from(books).where(eq(books.bookId, bookId)).limit(1);
  return book[0] ?? null;
}

async function ensureRackExists(rackId: string) {
  const rack = await db.select().from(locations).where(eq(locations.rackId, rackId)).limit(1);
  return rack[0] ?? null;
}

async function insertCopy(payload: {
  copyId: string;
  bookId: string;
  rackId: string;
  status: "borrowed" | "available";
  borrowedByUserId: string | null;
}) {
  const existing = await db.select().from(copies).where(eq(copies.copyId, payload.copyId)).limit(1);

  if (existing.length) {
    throw new Error("COPY_ID_ALREADY_EXISTS");
  }

  const inserted = await db
    .insert(copies)
    .values({
      copyId: payload.copyId,
      bookId: payload.bookId,
      rackId: payload.rackId,
      status: payload.status,
      borrowedByUserId: payload.borrowedByUserId,
    })
    .returning();

  return inserted[0] ?? null;
}

const copiesRoutes = new Hono<{ Variables: AppVariables }>();

copiesRoutes.get("/", async (c) => {
  const allCopies = await db.select().from(copies).orderBy(desc(copies.copyId));
  return c.json(allCopies);
});

copiesRoutes.get("/:copyId", async (c) => {
  const copyId = c.req.param("copyId");
  const copy = await db.select().from(copies).where(eq(copies.copyId, copyId)).limit(1);

  if (!copy.length) {
    return c.json({ message: "Copy not found" }, 404);
  }

  return c.json(copy[0]);
});

copiesRoutes.post("/", async (c) => {
  const user = requireAdmin(c);

  if (!user) return c.json({ message: "Forbidden: admin access required" }, 403);

  const body = await c.req.json().catch(() => null);
  const parsed = createCopySchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ message: "Invalid copy payload", issues: parsed.error.flatten() }, 400);
  }

  const book = await ensureBookExists(parsed.data.bookId);
  if (!book) return c.json({ message: "Book not found" }, 404);

  const rack = await ensureRackExists(parsed.data.rackId);
  if (!rack) return c.json({ message: "Rack not found" }, 404);

  if (parsed.data.status === "borrowed" && !parsed.data.borrowedByUserId) {
    return c.json({ message: "borrowedByUserId is required when status is borrowed" }, 400);
  }

  try {
    const inserted = await insertCopy({
      copyId: parsed.data.copyId,
      bookId: parsed.data.bookId,
      rackId: parsed.data.rackId,
      status: parsed.data.status,
      borrowedByUserId: parsed.data.status === "borrowed" ? parsed.data.borrowedByUserId ?? null : null,
    });

    return c.json(inserted, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "COPY_ID_ALREADY_EXISTS") {
      return c.json({ message: "Copy ID already exists" }, 409);
    }

    throw error;
  }
});

copiesRoutes.patch("/:copyId", async (c) => {
  const user = requireAdmin(c);

  if (!user) return c.json({ message: "Forbidden: admin access required" }, 403);

  const copyId = c.req.param("copyId");
  const body = await c.req.json().catch(() => null);
  const parsed = updateCopySchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ message: "Invalid copy payload", issues: parsed.error.flatten() }, 400);
  }

  const current = await db.select().from(copies).where(eq(copies.copyId, copyId)).limit(1);
  if (!current.length) return c.json({ message: "Copy not found" }, 404);

  const values: Record<string, string | null> = {};

  if (parsed.data.bookId) {
    const book = await ensureBookExists(parsed.data.bookId);
    if (!book) return c.json({ message: "Book not found" }, 404);
    values.bookId = parsed.data.bookId;
  }

  if (parsed.data.rackId) {
    const rack = await ensureRackExists(parsed.data.rackId);
    if (!rack) return c.json({ message: "Rack not found" }, 404);
    values.rackId = parsed.data.rackId;
  }

  if (parsed.data.status) {
    values.status = parsed.data.status;
    if (parsed.data.status === "available") {
      values.borrowedByUserId = null;
    }
  }

  if (parsed.data.borrowedByUserId !== undefined) {
    values.borrowedByUserId = parsed.data.borrowedByUserId;
  }

  if (values.status === "borrowed" && !values.borrowedByUserId) {
    return c.json({ message: "borrowedByUserId is required when status is borrowed" }, 400);
  }

  if (Object.keys(values).length === 0) {
    return c.json({ message: "No valid fields to update" }, 400);
  }

  const updated = await db
    .update(copies)
    .set(values)
    .where(eq(copies.copyId, copyId))
    .returning();

  return c.json(updated[0]);
});

copiesRoutes.delete("/:copyId", async (c) => {
  const user = requireAdmin(c);

  if (!user) return c.json({ message: "Forbidden: admin access required" }, 403);

  const copyId = c.req.param("copyId");
  const deleted = await db.delete(copies).where(eq(copies.copyId, copyId)).returning();

  if (!deleted.length) {
    return c.json({ message: "Copy not found" }, 404);
  }

  return c.json({ message: "Copy deleted", copy: deleted[0] });
});

export default copiesRoutes;
