import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../lib/auth";
import { db } from "../db/db";
import { user } from "../db/auth-schema";

type AuthUser = typeof auth.$Infer.Session.user;
type AuthSession = typeof auth.$Infer.Session.session;

type AppVariables = {
  user: AuthUser | null;
  session: AuthSession | null;
};

const setUserRoleSchema = z.object({
  role: z.enum(["admin", "user"]),
});

const adminRoutes = new Hono<{ Variables: AppVariables }>();

function requireAdmin(c: { get: (key: "user") => AuthUser | null }) {
  const currentUser = c.get("user");

  if (!currentUser || currentUser.role !== "admin") return null;

  return currentUser;
}

adminRoutes.get("/users", async (c) => {
  const currentUser = requireAdmin(c);

  if (!currentUser) return c.json({ message: "Forbidden: admin access required" }, 403);

  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .orderBy(desc(user.createdAt));

  return c.json(users);
});

adminRoutes.patch("/users/:userId/role", async (c) => {
  const currentUser = requireAdmin(c);

  if (!currentUser) return c.json({ message: "Forbidden: admin access required" }, 403);

  const userId = c.req.param("userId");
  const body = await c.req.json().catch(() => null);
  const parsed = setUserRoleSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        message: "Invalid role payload",
        issues: parsed.error.flatten(),
      },
      400,
    );
  }

  const targetUser = await db.select().from(user).where(eq(user.id, userId)).limit(1);

  if (!targetUser.length) {
    return c.json({ message: "User not found" }, 404);
  }

  const role = parsed.data.role;

  if (targetUser[0].id === currentUser.id && role === "user") {
    const adminCount = await db
      .select({ count: user.id })
      .from(user)
      .where(eq(user.role, "admin"));

    if (adminCount.length <= 1) {
      return c.json(
        { message: "You cannot demote the last admin" },
        400,
      );
    }
  }

  const updatedUser = await db
    .update(user)
    .set({ role })
    .where(eq(user.id, userId))
    .returning({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });

  return c.json(updatedUser[0]);
});

export default adminRoutes;