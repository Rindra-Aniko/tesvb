import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";

// Middleware: Cek apakah user sudah login (token valid)
export const authMiddleware = (app: Elysia) => app
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "default-secret",
    })
  )
  .resolve(async ({ jwt, headers }) => {
    // 1. Ambil token dari header Authorization
    const authHeader = headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { currentUser: null };
    }

    const token = authHeader.replace("Bearer ", "");

    // 2. Verifikasi token
    const payload = await jwt.verify(token);

    if (!payload) {
      return { currentUser: null };
    }

    // 3. Simpan data user di context agar bisa diakses di route
    return {
      currentUser: {
        id: Number(payload.id),
        email: payload.email as string,
        role: payload.role as string,
      },
    };
  })
  .onBeforeHandle(({ currentUser, set }) => {
    if (!currentUser) {
      set.status = 401;
      return { error: "Token tidak ditemukan atau tidak valid" };
    }
  });
