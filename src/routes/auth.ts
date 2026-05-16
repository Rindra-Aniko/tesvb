import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "default-secret",
    })
  )
  // --- REGISTER ---
  .post(
    "/register",
    async ({ body, set }) => {
      // 1. Cek apakah email sudah terdaftar
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, body.email));

      if (existing.length > 0) {
        set.status = 400;
        return { error: "Email sudah terdaftar" };
      }

      // 2. Hash password
      const hashedPassword = await Bun.password.hash(body.password);

      // 3. Simpan user baru
      const result = await db
        .insert(users)
        .values({
          name: body.name,
          email: body.email,
          password: hashedPassword,
          role: "user",
        })
        .returning();

      // 4. Return data user tanpa password
      const { password, ...userWithoutPassword } = result[0];
      return { message: "Register berhasil", user: userWithoutPassword };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 6 }),
      }),
    }
  )
  // --- LOGIN ---
  .post(
    "/login",
    async ({ body, jwt, set }) => {
      // 1. Cari user berdasarkan email
      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, body.email));

      if (result.length === 0) {
        set.status = 401;
        return { error: "Email atau password salah" };
      }

      const user = result[0];

      // 2. Verifikasi password
      const isValid = await Bun.password.verify(body.password, user.password);

      if (!isValid) {
        set.status = 401;
        return { error: "Email atau password salah" };
      }

      // 3. Buat JWT token
      const token = await jwt.sign({
        id: String(user.id),
        email: user.email,
        role: user.role,
      });

      return { message: "Login berhasil", token };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 6 }),
      }),
    }
  )
  // --- LOGOUT ---
  .post("/logout", () => {
    return { message: "Logout berhasil. Hapus token di client." };
  });
