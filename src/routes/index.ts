import { Elysia, t } from "elysia";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";

export const userRoutes = new Elysia({ prefix: "/users" })
  // Terapkan middleware auth ke semua route di bawah ini
  .use(authMiddleware)

  // GET /users - Semua user yang login bisa lihat daftar user
  .get("/", async () => {
    const result = await db.select().from(users);
    // Hilangkan password dari response
    return result.map(({ password, ...user }) => user);
  })

  .get("/me", (ctx) => {
    return {
      currentUser: (ctx as any).currentUser,
      headers: ctx.headers,
    };
  })

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
        name: t.String({ minLength: 1 }),
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 6 }),
        role: t.Optional(t.String()),
      }),
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
        name: t.Optional(t.String()),
        email: t.Optional(t.String({ format: "email" })),
        password: t.Optional(t.String({ minLength: 6 })),
        role: t.Optional(t.String()),
      }),
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
    }
  );
