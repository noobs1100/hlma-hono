export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "hlma-hono API",
    version: "1.0.0",
    description: "Hono + Better Auth + Drizzle API for books, copies, borrows, racks, and labels.",
  },
  servers: [{ url: "http://localhost:3000" }],
  tags: [
    { name: "Books" },
    { name: "Copies" },
    { name: "Borrows" },
    { name: "Racks" },
    { name: "Admin" },
    { name: "Labels" },
  ],
  paths: {
    "/api/books": {
      get: {
        tags: ["Books"],
        summary: "List all books",
        responses: {
          200: {
            description: "List of books",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Book" } },
              },
            },
          },
        },
      },
      post: {
        tags: ["Books"],
        summary: "Add a book",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BookCreate" },
            },
          },
        },
        responses: {
          201: {
            description: "Created book",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Book" },
              },
            },
          },
          400: { description: "Invalid payload", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/books/{bookId}": {
      get: {
        tags: ["Books"],
        summary: "Fetch one book",
        parameters: [{ name: "bookId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Book", content: { "application/json": { schema: { $ref: "#/components/schemas/Book" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
      patch: {
        tags: ["Books"],
        summary: "Update a book",
        parameters: [{ name: "bookId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/BookUpdate" } } },
        },
        responses: {
          200: { description: "Updated book", content: { "application/json": { schema: { $ref: "#/components/schemas/Book" } } } },
          400: { description: "Invalid payload", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
      delete: {
        tags: ["Books"],
        summary: "Delete a book",
        parameters: [{ name: "bookId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Deleted book", content: { "application/json": { schema: { $ref: "#/components/schemas/DeleteResponse" } } } },
          403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/copies": {
      get: {
        tags: ["Copies"],
        summary: "List all copies",
        responses: { 200: { description: "Copies", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Copy" } } } } } },
      },
      post: {
        tags: ["Copies"],
        summary: "Add a copy",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CopyCreate" } } } },
        responses: {
          201: { description: "Created copy", content: { "application/json": { schema: { $ref: "#/components/schemas/Copy" } } } },
          400: { description: "Invalid payload", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Book or rack not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          409: { description: "Duplicate copy ID", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/copies/{copyId}": {
      get: {
        tags: ["Copies"],
        summary: "Fetch one copy",
        parameters: [{ name: "copyId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Copy", content: { "application/json": { schema: { $ref: "#/components/schemas/Copy" } } } }, 404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } } },
      },
      patch: {
        tags: ["Copies"],
        summary: "Update a copy",
        parameters: [{ name: "copyId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CopyUpdate" } } } },
        responses: {
          200: { description: "Updated copy", content: { "application/json": { schema: { $ref: "#/components/schemas/Copy" } } } },
          400: { description: "Invalid payload", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
      delete: {
        tags: ["Copies"],
        summary: "Delete a copy",
        parameters: [{ name: "copyId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Deleted copy", content: { "application/json": { schema: { $ref: "#/components/schemas/DeleteResponse" } } } },
          403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/borrows": {
      get: {
        tags: ["Borrows"],
        summary: "List all borrows",
        responses: { 200: { description: "Borrows", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Borrow" } } } } } },
      },
      post: {
        tags: ["Borrows"],
        summary: "Create a borrow",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/BorrowCreate" } } } },
        responses: {
          201: { description: "Created borrow", content: { "application/json": { schema: { $ref: "#/components/schemas/Borrow" } } } },
          400: { description: "Invalid payload", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Copy not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          409: { description: "Copy not available", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/borrows/{borrowId}": {
      get: {
        tags: ["Borrows"],
        summary: "Fetch one borrow",
        parameters: [{ name: "borrowId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Borrow", content: { "application/json": { schema: { $ref: "#/components/schemas/Borrow" } } } }, 404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } } },
      },
    },
    "/api/borrows/{borrowId}/return": {
      post: {
        tags: ["Borrows"],
        summary: "Return a borrow",
        parameters: [{ name: "borrowId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Returned borrow", content: { "application/json": { schema: { $ref: "#/components/schemas/Borrow" } } } },
          403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          409: { description: "Already returned", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/racks": {
      get: {
        tags: ["Racks"],
        summary: "List all racks",
        responses: { 200: { description: "Racks", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Rack" } } } } } },
      },
      post: {
        tags: ["Racks"],
        summary: "Add a rack",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RackCreate" } } } },
        responses: {
          201: { description: "Created rack", content: { "application/json": { schema: { $ref: "#/components/schemas/Rack" } } } },
          400: { description: "Invalid payload", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          409: { description: "Duplicate rack ID", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/racks/{rackId}": {
      get: {
        tags: ["Racks"],
        summary: "Fetch one rack",
        parameters: [{ name: "rackId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Rack", content: { "application/json": { schema: { $ref: "#/components/schemas/Rack" } } } }, 404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } } },
      },
      patch: {
        tags: ["Racks"],
        summary: "Update a rack",
        parameters: [{ name: "rackId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RackUpdate" } } } },
        responses: {
          200: { description: "Updated rack", content: { "application/json": { schema: { $ref: "#/components/schemas/Rack" } } } },
          400: { description: "Invalid payload", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
      delete: {
        tags: ["Racks"],
        summary: "Delete a rack",
        parameters: [{ name: "rackId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Deleted rack", content: { "application/json": { schema: { $ref: "#/components/schemas/DeleteResponse" } } } },
          403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/labels/{type}": {
      get: {
        tags: ["Labels"],
        summary: "Generate an A4 Data Matrix PDF page",
        parameters: [{ name: "type", in: "path", required: true, schema: { type: "string", enum: ["r", "b"] } }],
        responses: {
          200: {
            description: "PDF document",
            content: { "application/pdf": { schema: { type: "string", format: "binary" } } },
          },
          400: { description: "Invalid type", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/admin/users": {
      get: {
        tags: ["Admin"],
        summary: "List users",
        responses: {
          200: {
            description: "Users",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/AdminUser" } },
              },
            },
          },
          403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/admin/users/{userId}/role": {
      patch: {
        tags: ["Admin"],
        summary: "Promote or demote a user",
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AdminSetRole" } } } },
        responses: {
          200: { description: "Updated user", content: { "application/json": { schema: { $ref: "#/components/schemas/AdminUser" } } } },
          400: { description: "Invalid payload or last admin protection", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "User not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
  },
  components: {
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: { message: { type: "string" } },
        required: ["message"],
      },
      DeleteResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
        required: ["message"],
      },
      Book: {
        type: "object",
        properties: {
          bookId: { type: "string", format: "uuid" },
          title: { type: "string" },
          author: { type: "string" },
          genre: { type: "string" },
          isbn: { type: "string" },
          description: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: ["bookId", "title", "author", "genre", "isbn", "description", "createdAt", "updatedAt"],
      },
      BookCreate: {
        type: "object",
        properties: {
          title: { type: "string" },
          author: { type: "string" },
          genre: { type: "string" },
          isbn: { type: "string" },
          description: { type: "string" },
        },
        required: ["title", "author", "genre", "isbn", "description"],
      },
      BookUpdate: {
        type: "object",
        properties: {
          title: { type: "string" },
          author: { type: "string" },
          genre: { type: "string" },
          isbn: { type: "string" },
          description: { type: "string" },
        },
      },
      Copy: {
        type: "object",
        properties: {
          copyId: { type: "string" },
          bookId: { type: "string", format: "uuid" },
          rackId: { type: "string" },
          status: { type: "string", enum: ["borrowed", "available"] },
          borrowedByUserId: { type: ["string", "null"] },
        },
        required: ["copyId", "bookId", "rackId", "status"],
      },
      CopyCreate: {
        type: "object",
        properties: {
          copyId: { type: "string" },
          bookId: { type: "string", format: "uuid" },
          rackId: { type: "string" },
          status: { type: "string", enum: ["borrowed", "available"], default: "available" },
          borrowedByUserId: { type: "string" },
        },
        required: ["copyId", "bookId", "rackId"],
      },
      CopyUpdate: {
        type: "object",
        properties: {
          bookId: { type: "string", format: "uuid" },
          rackId: { type: "string" },
          status: { type: "string", enum: ["borrowed", "available"] },
          borrowedByUserId: { type: ["string", "null"] },
        },
      },
      Borrow: {
        type: "object",
        properties: {
          borrowId: { type: "string", format: "uuid" },
          copyId: { type: "string" },
          userId: { type: "string" },
          borrowDate: { type: "string", format: "date-time" },
          expectedReturnDate: { type: "string", format: "date-time" },
          returnDate: { type: ["string", "null"], format: "date-time" },
        },
        required: ["borrowId", "copyId", "userId", "borrowDate", "expectedReturnDate"],
      },
      BorrowCreate: {
        type: "object",
        properties: {
          copyId: { type: "string" },
          expectedReturnDate: { type: "string", format: "date-time" },
        },
        required: ["copyId", "expectedReturnDate"],
      },
      Rack: {
        type: "object",
        properties: {
          rackId: { type: "string" },
          description: { type: ["string", "null"] },
          room: { type: "string" },
          cupboard: { type: "string" },
          rack: { type: "string" },
        },
        required: ["rackId", "room", "cupboard", "rack"],
      },
      RackCreate: {
        type: "object",
        properties: {
          rackId: { type: "string" },
          room: { type: "string" },
          cupboard: { type: "string" },
          rack: { type: "string" },
          description: { type: ["string", "null"] },
        },
        required: ["rackId", "room", "cupboard", "rack"],
      },
      RackUpdate: {
        type: "object",
        properties: {
          room: { type: "string" },
          cupboard: { type: "string" },
          rack: { type: "string" },
          description: { type: ["string", "null"] },
        },
      },
      AdminUser: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          role: { type: "string", enum: ["admin", "user"] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: ["id", "name", "email", "role", "createdAt", "updatedAt"],
      },
      AdminSetRole: {
        type: "object",
        properties: {
          role: { type: "string", enum: ["admin", "user"] },
        },
        required: ["role"],
      },
    },
  },
} as const;