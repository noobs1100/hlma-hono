import { relations } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  PgVarchar,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const copyStatusEnum = pgEnum("copy_status", ["borrowed", "available"]);

export const books = pgTable("books", {
  bookId: uuid("book_id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  genre: text("genre").notNull(),
  isbn: text("isbn").notNull().unique(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const locations = pgTable("locations", {
  rackId: text("rack_id").primaryKey(),
  description: text("description"),
  room: text("room").notNull(),
  cupboard: text("cupboard").notNull(),
  rack: text("rack").notNull(),
});

export const copies = pgTable("copies", {
  copyId: text("copy_id").primaryKey(),
  bookId: uuid("book_id")
    .notNull()
    .references(() => books.bookId, { onDelete: "cascade" }),
  rackId: text("rack_id")
    .notNull()
    .references(() => locations.rackId, { onDelete: "restrict" }),
  status: copyStatusEnum("status").notNull().default("available"),
  borrowedByUserId: text("borrowed_by_user_id").references(() => user.id, { onDelete: "set null" }),
});

export const borrows = pgTable("borrows", {
  borrowId: uuid("borrow_id").primaryKey().defaultRandom(),
  copyId: text("copy_id")
    .notNull()
    .references(() => copies.copyId, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  borrowDate: timestamp("borrow_date", { withTimezone: true }).defaultNow().notNull(),
  expectedReturnDate: timestamp("expected_return_date", { withTimezone: true }).notNull(),
  returnDate: timestamp("return_date", { withTimezone: true }),
});

export const booksRelations = relations(books, ({ many }) => ({
  copies: many(copies),
}));

export const locationsRelations = relations(locations, ({ many }) => ({
  copies: many(copies),
}));

export const copiesRelations = relations(copies, ({ one, many }) => ({
  book: one(books, {
    fields: [copies.bookId],
    references: [books.bookId],
  }),
  location: one(locations, {
    fields: [copies.rackId],
    references: [locations.rackId],
  }),
  borrowedByUser: one(user, {
    fields: [copies.borrowedByUserId],
    references: [user.id],
  }),
  borrows: many(borrows),
}));

export const borrowsRelations = relations(borrows, ({ one }) => ({
  copy: one(copies, {
    fields: [borrows.copyId],
    references: [copies.copyId],
  }),
  user: one(user, {
    fields: [borrows.userId],
    references: [user.id],
  }),
}));
