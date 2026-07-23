import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const mfaChallenges = sqliteTable(
  "mfa_challenges",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    role: text("role", { enum: ["patient", "staff"] }).notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    consumedAt: integer("consumed_at"),
  },
  (table) => [
    index("mfa_challenges_email_created_idx").on(
      table.email,
      table.createdAt,
    ),
  ],
);
