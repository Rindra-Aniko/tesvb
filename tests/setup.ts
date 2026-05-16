import { db } from "../src/db";
import { users } from "../src/db/schema";
import { sql } from "drizzle-orm";

export async function cleanDatabase() {
  await db.delete(users);
  // Reset auto-increment if needed (SQLite specific)
  await db.run(sql`DELETE FROM sqlite_sequence WHERE name = 'users'`);
}

export async function createAdmin() {
  const hashedPassword = await Bun.password.hash("admin123");
  const result = await db.insert(users).values({
    name: "Admin Test",
    email: "admin@test.com",
    password: hashedPassword,
    role: "admin",
  }).returning();
  return result[0];
}

export async function createUser() {
  const hashedPassword = await Bun.password.hash("user123");
  const result = await db.insert(users).values({
    name: "User Test",
    email: "user@test.com",
    password: hashedPassword,
    role: "user",
  }).returning();
  return result[0];
}

export async function getAuthToken(app: any, email: string, password: string) {
  const response = await app.handle(
    new Request("http://localhost/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
  );
  const data = await response.json();
  return data.token;
}
