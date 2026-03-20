import "dotenv/config";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import * as authSchema from "../db/auth-schema";
import { db } from "../db/db";

export type Role = "admin" | "user";

export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: authSchema,
    }),
    databaseHooks: {
        user: {
            create: {
                before: async (user) => {
                    const existingUsers = await db
                        .select({ id: authSchema.user.id })
                        .from(authSchema.user)
                        .limit(1);

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
    plugins: [openAPI()],
});
