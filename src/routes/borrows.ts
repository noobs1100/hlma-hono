import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../lib/auth";
import { db } from "../db/db";
import { user } from "../db/auth-schema";
import { books, borrows, copies } from "../db/schema";

type AuthUser = typeof auth.$Infer.Session.user;
type AuthSession = typeof auth.$Infer.Session.session;

type AppVariables = {
  user: AuthUser | null;
  session: AuthSession | null;
};

const createBorrowSchema = z.object({
  copyId: z.string().trim().min(1, "Copy ID is required"),
  expectedReturnDate: z.coerce.date(),
});

function requireUserRole(c: { get: (key: "user") => AuthUser | null }) {
  const user = c.get("user");

  if (!user || (user.role !== "user" && user.role !== "admin")) return null;

  return user;
}

async function ensureBorrowExists(borrowId: string) {
  const borrow = await db.select().from(borrows).where(eq(borrows.borrowId, borrowId)).limit(1);
  return borrow[0] ?? null;
}

const borrowsRoutes = new Hono<{ Variables: AppVariables }>();

borrowsRoutes.get("/", async (c) => {
  const allBorrows = await db.select().from(borrows).orderBy(desc(borrows.borrowDate));
  return c.json(allBorrows);
});

borrowsRoutes.get("/me", async (c) => {
  const currentUser = c.get("user");

  if (!currentUser) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const rows = await db
    .select({
      borrowId: borrows.borrowId,
      copyId: borrows.copyId,
      borrowDate: borrows.borrowDate,
      expectedReturnDate: borrows.expectedReturnDate,
      returnDate: borrows.returnDate,
      bookId: books.bookId,
      bookTitle: books.title,
      bookAuthor: books.author,
      copyStatus: copies.status,
    })
    .from(borrows)
    .innerJoin(copies, eq(borrows.copyId, copies.copyId))
    .innerJoin(books, eq(copies.bookId, books.bookId))
    .where(eq(borrows.userId, currentUser.id))
    .orderBy(desc(borrows.borrowDate));

  return c.json(
    rows
      .filter((row) => !row.returnDate)
      .map((row) => ({
        borrowId: row.borrowId,
        copyId: row.copyId,
        borrowDate: row.borrowDate,
        expectedReturnDate: row.expectedReturnDate,
        book: {
          bookId: row.bookId,
          title: row.bookTitle,
          author: row.bookAuthor,
        },
        copy: {
          copyId: row.copyId,
          status: row.copyStatus,
        },
      })),
  );
});

borrowsRoutes.get("/:borrowId", async (c) => {
  const borrowId = c.req.param("borrowId");
  const borrow = await ensureBorrowExists(borrowId);

  if (!borrow) {
    return c.json({ message: "Borrow not found" }, 404);
  }

  return c.json(borrow);
});

borrowsRoutes.get("/:borrowId/details", async (c) => {
  const borrowId = c.req.param("borrowId");
  const borrowRows = await db
    .select({
      borrowId: borrows.borrowId,
      copyId: borrows.copyId,
      userId: borrows.userId,
      borrowDate: borrows.borrowDate,
      expectedReturnDate: borrows.expectedReturnDate,
      returnDate: borrows.returnDate,
      borrowerId: user.id,
      borrowerName: user.name,
      borrowerEmail: user.email,
      borrowerRole: user.role,
    })
    .from(borrows)
    .leftJoin(user, eq(borrows.userId, user.id))
    .where(eq(borrows.borrowId, borrowId))
    .limit(1);

  if (!borrowRows.length) {
    return c.json({ message: "Borrow not found" }, 404);
  }

  return c.json({
    borrow: {
      borrowId: borrowRows[0].borrowId,
      copyId: borrowRows[0].copyId,
      userId: borrowRows[0].userId,
      borrowDate: borrowRows[0].borrowDate,
      expectedReturnDate: borrowRows[0].expectedReturnDate,
      returnDate: borrowRows[0].returnDate,
      user: borrowRows[0].borrowerId
        ? {
            id: borrowRows[0].borrowerId,
            name: borrowRows[0].borrowerName,
            email: borrowRows[0].borrowerEmail,
            role: borrowRows[0].borrowerRole,
          }
        : null,
    },
  });
});

borrowsRoutes.post("/", async (c) => {
  const user = requireUserRole(c);

  if (!user) return c.json({ message: "Forbidden: user role required" }, 403);

  const body = await c.req.json().catch(() => null);
  const parsed = createBorrowSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ message: "Invalid borrow payload", issues: parsed.error.flatten() }, 400);
  }

  const existingCopy = await db.select().from(copies).where(eq(copies.copyId, parsed.data.copyId)).limit(1);

  if (!existingCopy.length) {
    return c.json({ message: "Copy not found" }, 404);
  }

  if (existingCopy[0].status !== "available") {
    return c.json({ message: "Copy is not available" }, 409);
  }

  const inserted = await db.transaction(async (tx) => {
    const [updatedCopy] = await tx
      .update(copies)
      .set({
        status: "borrowed",
        borrowedByUserId: user.id,
      })
      .where(and(eq(copies.copyId, parsed.data.copyId), eq(copies.status, "available")))
      .returning();

    if (!updatedCopy) {
      return null;
    }

    const [borrow] = await tx
      .insert(borrows)
      .values({
        copyId: parsed.data.copyId,
        userId: user.id,
        expectedReturnDate: parsed.data.expectedReturnDate,
      })
      .returning();

    return borrow ?? null;
  });

  if (!inserted) {
    return c.json({ message: "Copy is not available" }, 409);
  }

  return c.json(inserted, 201);
});

borrowsRoutes.post("/:borrowId/return", async (c) => {
  const user = requireUserRole(c);

  if (!user) return c.json({ message: "Forbidden: user role required" }, 403);

  const borrowId = c.req.param("borrowId");

  const updated = await db.transaction(async (tx) => {
    const borrow = await tx.select().from(borrows).where(eq(borrows.borrowId, borrowId)).limit(1);

    if (!borrow.length) {
      return { status: 404 as const, body: { message: "Borrow not found" } };
    }

    const activeBorrow = borrow[0];

    if (activeBorrow.userId !== user.id) {
      return { status: 403 as const, body: { message: "Forbidden: you can only return your own borrow" } };
    }

    if (activeBorrow.returnDate) {
      return { status: 409 as const, body: { message: "Borrow is already returned" } };
    }

    const [returnedBorrow] = await tx
      .update(borrows)
      .set({ returnDate: new Date() })
      .where(eq(borrows.borrowId, borrowId))
      .returning();

    await tx
      .update(copies)
      .set({
        status: "available",
        borrowedByUserId: null,
      })
      .where(eq(copies.copyId, activeBorrow.copyId));

    return { status: 200 as const, body: returnedBorrow ?? activeBorrow };
  });

  return c.json(updated.body, updated.status);
});

export default borrowsRoutes;