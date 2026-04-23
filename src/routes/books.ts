import { desc, eq, ilike, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../lib/auth";
import { db } from "../db/db";
import { user } from "../db/auth-schema";
import { books, copies } from "../db/schema";

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
  isbn: z
    .string()
    .trim()
    .min(1, "ISBN must not be empty")
    .optional()
    .nullable(),
  description: z
    .string()
    .trim()
    .min(1, "Description must not be empty")
    .optional()
    .nullable(),
});

type BookInput = z.infer<typeof createBookSchema>;

const booksRoutes = new Hono<{ Variables: AppVariables }>();

const coverAutofillRequestSchema = z.object({
  imageBase64: z.string().min(1, "imageBase64 is required"),
  mimeType: z.string().optional().default("image/jpeg"),
});

const coverAutofillSuggestedSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    author: z.string().trim().min(1).optional(),
    genre: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
  })
  .strict();

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();

  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const slice = candidate.slice(firstBrace, lastBrace + 1);
    return JSON.parse(slice);
  }

  return JSON.parse(candidate);
}

async function inferBookFieldsFromCover(params: {
  imageBase64: string;
  mimeType: string;
}): Promise<z.infer<typeof coverAutofillSuggestedSchema>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  // Gemini 1.5 models are retired and can 404 on v1beta; default to a current Flash model.
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  console.info("[cover-autofill] gemini request", { model });

  const prompt = [
    "You are extracting structured bibliographic details from a photo of a book's FRONT COVER.",
    "Return ONLY valid JSON (no markdown) with keys: title, author, genre, description.",
    "Rules:",
    "- If a field is unknown, omit it (do not guess).",
    "- Keep values short and clean (no extra quotes).",
    "- author should be a single string (e.g. 'First Last' or 'A, B').",
    "- title, author, and genre MUST be in English only (Latin characters). Translate if needed.",
    "- If the cover language is not English, set genre to the language name in English (for example: Hindi, Gujarati, Marathi).",
    "- description MUST include the original (cover language) details for title/author/genre at the top, for example:",
    "  'Original (as on cover): Title: <...> | Author: <...> | Genre: <...>'",
    "- The Original (as on cover) Title/Author/Genre MUST be copied EXACTLY as printed on the cover (verbatim).",
    "  Do NOT translate, do NOT change spelling, do NOT expand abbreviations, do NOT change punctuation, and do NOT change casing.",
    "  Then you may add the English blurb/summary if present on the cover.",
  ].join("\n");

  const geminiResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: params.mimeType,
                data: params.imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 500,
      },
    }),
  });

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text().catch(() => "");
    throw new Error(
      `Gemini request failed (${geminiResponse.status}): ${errorText || geminiResponse.statusText}`,
    );
  }

  const payload = (await geminiResponse.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text =
    payload.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") ?? "";

  if (!text.trim()) {
    throw new Error("Gemini returned an empty response");
  }

  const extracted = extractJsonObject(text);
  const parsed = coverAutofillSuggestedSchema.safeParse(extracted);
  if (!parsed.success) {
    throw new Error("Gemini returned an invalid JSON payload");
  }

  return parsed.data;
}

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
  const searchQuery = (c.req.query("query") ?? c.req.query("q") ?? "").trim();

  const allBooks = searchQuery
    ? await db
        .select()
        .from(books)
        .where(
          or(
            ilike(books.title, `%${searchQuery}%`),
            ilike(books.author, `%${searchQuery}%`),
            ilike(books.genre, `%${searchQuery}%`),
            ilike(books.isbn, `%${searchQuery}%`),
            ilike(books.description, `%${searchQuery}%`),
          ),
        )
        .orderBy(desc(books.createdAt))
    : await db.select().from(books).orderBy(desc(books.createdAt));

  return c.json(allBooks);
});

booksRoutes.post("/autofill-from-cover", async (c) => {
  const user = requireAdmin(c);
  if (!user) return c.json({ message: "Forbidden: admin access required" }, 403);

  const body = await c.req.json().catch(() => null);
  const parsed = coverAutofillRequestSchema.safeParse(body);
  if (!parsed.success) {
    console.info("[cover-autofill] invalid payload");
    return c.json(
      { message: "Invalid payload", issues: parsed.error.flatten() },
      400,
    );
  }

  // Rough safety cap: base64 inflates size; keep under ~6MB of base64 text.
  if (parsed.data.imageBase64.length > 6_000_000) {
    console.info("[cover-autofill] image too large:", parsed.data.imageBase64.length);
    return c.json({ message: "Image too large" }, 413);
  }

  try {
    console.info("[cover-autofill] request received", {
      mimeType: parsed.data.mimeType,
      base64Length: parsed.data.imageBase64.length,
      userId: user.id,
    });
    const suggested = await inferBookFieldsFromCover({
      imageBase64: parsed.data.imageBase64,
      mimeType: parsed.data.mimeType,
    });

    console.info("[cover-autofill] success", {
      hasTitle: Boolean(suggested.title),
      hasAuthor: Boolean(suggested.author),
      hasGenre: Boolean(suggested.genre),
      hasDescription: Boolean(suggested.description),
    });
    return c.json({ suggested });
  } catch (error) {
    console.error("[cover-autofill] gemini error", error);
    return c.json(
      {
        message:
          error instanceof Error ? error.message : "Could not infer book fields",
      },
      502,
    );
  }
});

booksRoutes.get("/:bookId", async (c) => {
  const bookId = c.req.param("bookId");
  const book = await db.select().from(books).where(eq(books.bookId, bookId)).limit(1);

  if (!book.length) {
    return c.json({ message: "Book not found" }, 404);
  }

  return c.json(book[0]);
});

booksRoutes.get("/:bookId/details", async (c) => {
  const bookId = c.req.param("bookId");
  const book = await db.select().from(books).where(eq(books.bookId, bookId)).limit(1);

  if (!book.length) {
    return c.json({ message: "Book not found" }, 404);
  }

  const copyRows = await db
    .select({
      copyId: copies.copyId,
      bookId: copies.bookId,
      rackId: copies.rackId,
      status: copies.status,
      borrowedByUserId: copies.borrowedByUserId,
      borrowerId: user.id,
      borrowerName: user.name,
      borrowerEmail: user.email,
      borrowerRole: user.role,
    })
    .from(copies)
    .leftJoin(user, eq(copies.borrowedByUserId, user.id))
    .where(eq(copies.bookId, bookId))
    .orderBy(desc(copies.copyId));

  return c.json({
    book: book[0],
    copies: copyRows.map((copy) => ({
      copyId: copy.copyId,
      bookId: copy.bookId,
      rackId: copy.rackId,
      status: copy.status,
      borrowedByUserId: copy.borrowedByUserId,
      borrowedByUser: copy.borrowerId
        ? {
            id: copy.borrowerId,
            name: copy.borrowerName,
            email: copy.borrowerEmail,
            role: copy.borrowerRole,
          }
        : null,
    })),
  });
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

  try {
    const inserted = await db
      .insert(books)
      .values({
        title: parsed.data.title,
        author: parsed.data.author,
        genre: parsed.data.genre,
        isbn: parsed.data.isbn ?? null,
        description: parsed.data.description ?? null,
      })
      .returning();

    return c.json(inserted[0], 201);
  } catch (error) {
    const databaseError = error as {
      code?: string;
      cause?: { code?: string; constraint?: string };
    };
    const errorCode = databaseError.code ?? databaseError.cause?.code;

    if (errorCode === "23505") {
      return c.json({ message: "A book with this ISBN already exists" }, 409);
    }

    throw error;
  }
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