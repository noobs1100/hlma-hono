import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../lib/auth";
import { db } from "../db/db";
import { books } from "../db/schema";

type AuthUser = typeof auth.$Infer.Session.user;
type AuthSession = typeof auth.$Infer.Session.session;

type AppVariables = {
  user: AuthUser | null;
  session: AuthSession | null;
};

const createBookSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  author: z.string().trim().min(1, "Author is required"),
  genre: z.string().trim().min(1, "Genre is required"),
  isbn: z.string().trim().min(1, "ISBN is required"),
  description: z.string().trim().min(1, "Description is required"),
});

type BookInput = z.infer<typeof createBookSchema>;

const booksRoutes = new Hono<{ Variables: AppVariables }>();

function requireUser(c: { get: (key: "user") => AuthUser | null }) {
  const user = c.get("user");

  if (!user) return null;
  return user;
}

function requireAdmin(c: { get: (key: "user") => AuthUser | null }) {
  const user = requireUser(c);

  if (!user) return null;

  if (user.role !== "admin") return null;

  return user;
}

booksRoutes.get("/", async (c) => {
  const allBooks = await db.select().from(books).orderBy(desc(books.createdAt));
  return c.json(allBooks);
});

booksRoutes.get("/:bookId", async (c) => {
  const bookId = c.req.param("bookId");
  const book = await db.select().from(books).where(eq(books.bookId, bookId)).limit(1);

  if (!book.length) {
    return c.json({ message: "Book not found" }, 404);
  }

  return c.json(book[0]);
});

booksRoutes.post("/", async (c) => {
  const user = requireAdmin(c);

  if (!user) return c.json({ message: "Forbidden: admin access required" }, 403);

  const body = await c.req.json().catch(() => null);

  const parsed = createBookSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        message: "Invalid book payload",
        issues: parsed.error.flatten(),
      },
      400,
    );
  }

  const inserted = await db
    .insert(books)
    .values({
      title: parsed.data.title,
      author: parsed.data.author,
      genre: parsed.data.genre,
      isbn: parsed.data.isbn,
      description: parsed.data.description,
    })
    .returning();

  return c.json(inserted[0], 201);
});

booksRoutes.patch("/:bookId", async (c) => {
  const user = requireAdmin(c);

  if (!user) return c.json({ message: "Forbidden: admin access required" }, 403);

  const bookId = c.req.param("bookId");
  const body = await c.req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return c.json({ message: "Invalid book payload" }, 400);
  }

  const record = body as Partial<BookInput>;
  const values: Partial<BookInput> = {};

  for (const key of ["title", "author", "genre", "isbn", "description"] as const) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      values[key] = value.trim();
    }
  }

  if (Object.keys(values).length === 0) {
    return c.json({ message: "No valid fields to update" }, 400);
  }

  const updated = await db
    .update(books)
    .set(values)
    .where(eq(books.bookId, bookId))
    .returning();

  if (!updated.length) {
    return c.json({ message: "Book not found" }, 404);
  }

  return c.json(updated[0]);
});

booksRoutes.delete("/:bookId", async (c) => {
  const user = requireAdmin(c);

  if (!user) return c.json({ message: "Forbidden: admin access required" }, 403);

  const bookId = c.req.param("bookId");
  const deleted = await db.delete(books).where(eq(books.bookId, bookId)).returning();

  if (!deleted.length) {
    return c.json({ message: "Book not found" }, 404);
  }

  return c.json({ message: "Book deleted", book: deleted[0] });
});

export default booksRoutes;