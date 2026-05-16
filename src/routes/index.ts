import { Elysia, t } from "elysia";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";

export const userRoutes = new Elysia({ prefix: "/users" })
  // Terapkan middleware auth ke semua route di bawah ini
  .use(authMiddleware)

  .get(
    "/",
    async () => {
      const result = await db.select().from(users);
      // Hilangkan password dari response
      return result.map(({ password, ...user }) => user);
    },
    {
      response: {
        200: t.Array(
          t.Object({
            id: t.Number(),
            name: t.String(),
            email: t.String(),
            role: t.String(),
            createdAt: t.Any(),
          })
        ),
      },
      detail: {
        summary: "List Semua User",
        tags: ["Users"],
        description: "Melihat daftar semua user yang terdaftar di sistem.",
      },
    }
  )

  .get(
    "/me",
    (ctx) => {
      return {
        currentUser: (ctx as any).currentUser,
        headers: ctx.headers,
      };
    },
    {
      response: {
        200: t.Object({
          currentUser: t.Object({
            id: t.Number(),
            email: t.String(),
            role: t.String(),
          }),
          headers: t.Any(),
        }),
      },
      detail: {
        summary: "Info Profil Saya",
        tags: ["Users"],
        description: "Mendapatkan informasi user yang sedang login dari token.",
      },
    }
  )

  // GET /users/:id - Lihat detail user
  .get(
    "/:id",
    async ({ params, set }) => {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.id, Number(params.id)));

      if (result.length === 0) {
        set.status = 404;
        return { error: "User tidak ditemukan" };
      }

      const { password, ...user } = result[0];
      return user;
    },
    {
      params: t.Object({ id: t.String() }),
      response: {
        200: t.Object({
          id: t.Number(),
          name: t.String(),
          email: t.String(),
          role: t.String(),
          createdAt: t.Any(),
        }),
        404: t.Object({
          error: t.String(),
        }),
      },
      detail: {
        summary: "Detail User Berdasarkan ID",
        tags: ["Users"],
        description: "Melihat informasi mendalam dari satu user spesifik.",
      },
    }
  )

  // POST /users - Hanya admin yang bisa tambah user
  .post(
    "/",
    async ({ body, currentUser, set }) => {
      // Cek role admin
      if (currentUser.role !== "admin") {
        set.status = 403;
        return { error: "Hanya admin yang bisa menambah user" };
      }

      const hashedPassword = await Bun.password.hash(body.password);

      const result = await db
        .insert(users)
        .values({ 
          name: body.name,
          email: body.email,
          password: hashedPassword,
          role: body.role || "user"
        })
        .returning();

      const { password, ...user } = result[0];
      return { message: "User berhasil ditambahkan", user };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, default: "Jane Doe" }),
        email: t.String({ format: "email", default: "jane@example.com" }),
        password: t.String({ minLength: 6, default: "securepassword" }),
        role: t.Optional(t.String({ default: "user" })),
      }),
      response: {
        200: t.Object({
          message: t.String(),
          user: t.Object({
            id: t.Number(),
            name: t.String(),
            email: t.String(),
            role: t.String(),
            createdAt: t.Any(),
          }),
        }),
        403: t.Object({
          error: t.String(),
        }),
      },
      detail: {
        summary: "Tambah User (Admin Only)",
        tags: ["Users"],
        description: "Menambahkan user baru ke database secara manual oleh Admin.",
      },
    }
  )

  // PUT /users/:id - Hanya admin yang bisa edit user
  .put(
    "/:id",
    async ({ params, body, currentUser, set }) => {
      if (currentUser.role !== "admin") {
        set.status = 403;
        return { error: "Hanya admin yang bisa mengedit user" };
      }

      // Siapkan data yang akan diupdate
      const updateData: Record<string, any> = {};
      if (body.name) updateData.name = body.name;
      if (body.email) updateData.email = body.email;
      if (body.role) updateData.role = body.role;
      if (body.password) {
        updateData.password = await Bun.password.hash(body.password);
      }

      const result = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, Number(params.id)))
        .returning();

      if (result.length === 0) {
        set.status = 404;
        return { error: "User tidak ditemukan" };
      }

      const { password, ...user } = result[0];
      return { message: "User berhasil diupdate", user };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ default: "Jane Updated" })),
        email: t.Optional(t.String({ format: "email", default: "jane@example.com" })),
        password: t.Optional(t.String({ minLength: 6 })),
        role: t.Optional(t.String({ default: "admin" })),
      }),
      response: {
        200: t.Object({
          message: t.String(),
          user: t.Object({
            id: t.Number(),
            name: t.String(),
            email: t.String(),
            role: t.String(),
            createdAt: t.Any(),
          }),
        }),
        403: t.Object({
          error: t.String(),
        }),
        404: t.Object({
          error: t.String(),
        }),
      },
      detail: {
        summary: "Update Data User (Admin Only)",
        tags: ["Users"],
        description: "Memperbarui informasi user berdasarkan ID.",
      },
    }
  )

  // DELETE /users/:id - Hanya admin yang bisa hapus user
  .delete(
    "/:id",
    async ({ params, currentUser, set }) => {
      if (currentUser.role !== "admin") {
        set.status = 403;
        return { error: "Hanya admin yang bisa menghapus user" };
      }

      const result = await db
        .delete(users)
        .where(eq(users.id, Number(params.id)))
        .returning();

      if (result.length === 0) {
        set.status = 404;
        return { error: "User tidak ditemukan" };
      }

      return { message: "User berhasil dihapus" };
    },
    {
      params: t.Object({ id: t.String() }),
      response: {
        200: t.Object({
          message: t.String(),
        }),
        403: t.Object({
          error: t.String(),
        }),
        404: t.Object({
          error: t.String(),
        }),
      },
      detail: {
        summary: "Hapus User (Admin Only)",
        tags: ["Users"],
        description: "Menghapus user secara permanen dari database.",
      },
    }
  );
