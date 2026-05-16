# Issue: Web Sederhana dengan Autentikasi & Manajemen User

## Deskripsi

Buat web sederhana dengan fitur autentikasi (login, register, logout) dan manajemen user berbasis **role** (admin & user biasa). Menggunakan stack yang sudah ada: **Bun.js + Elysia.js + Drizzle ORM + SQLite**.

> **IMPORTANT:** Project ini sudah punya setup dasar dari Issue #2. Kita akan **mengembangkan** kode yang sudah ada, bukan membuat dari awal.

---

## Kondisi Project Saat Ini

```
src/
├── index.ts          # Entry point Elysia server (port 3000)
├── db/
│   ├── index.ts      # Koneksi database (bun:sqlite + drizzle)
│   └── schema.ts     # Schema tabel users (id, name, email, createdAt)
└── routes/
    └── index.ts      # Route GET /users & POST /users
drizzle.config.ts     # Konfigurasi Drizzle Kit
```

---

## Langkah-Langkah Implementasi

### Langkah 1: Update Schema Database

**File:** `src/db/schema.ts`

Tambahkan kolom baru ke tabel `users` untuk mendukung autentikasi dan role:

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `password` | `text` | Password yang sudah di-hash (wajib) |
| `role` | `text` | Role user: `"admin"` atau `"user"` (default: `"user"`) |

Contoh schema yang diupdate:

```ts
// src/db/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("user").notNull(), // "admin" atau "user"
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});
```

Setelah update schema, jalankan:

```bash
bun run db:push
```

> **NOTE:** `db:push` akan langsung sync schema ke database. Karena kita menambahkan kolom baru yang `notNull`, database lama mungkin perlu di-reset. Hapus file `data/app.db` terlebih dahulu jika ada error.

---

### Langkah 2: Setup JWT untuk Autentikasi

Install plugin JWT dari Elysia:

```bash
bun add @elysiajs/jwt
```

> **TIP:** JWT (JSON Web Token) digunakan untuk mengelola sesi login. Setelah user login, server memberikan token. Token ini dikirim di setiap request berikutnya sebagai bukti bahwa user sudah login.

Tambahkan variabel `JWT_SECRET` di file `.env`:

```
DATABASE_URL=./data/app.db
JWT_SECRET=rahasia-jwt-kamu-ganti-ini
```

Update juga `.env.example`:

```
DATABASE_URL=./data/app.db
JWT_SECRET=your-jwt-secret-here
```

---

### Langkah 3: Buat File Auth Routes

**File baru:** `src/routes/auth.ts`

Buat file route baru khusus untuk autentikasi (register, login, logout).

#### 3a. Register (`POST /auth/register`)

Alur kerja:
1. Terima `name`, `email`, `password` dari body request
2. Cek apakah email sudah terdaftar → jika sudah, return error
3. Hash password menggunakan `Bun.password.hash()`
4. Simpan user baru ke database dengan role default `"user"`
5. Return data user (tanpa password)

Contoh kode:

```ts
// src/routes/auth.ts
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
```

#### 3b. Login (`POST /auth/login`)

Alur kerja:
1. Terima `email` dan `password` dari body request
2. Cari user berdasarkan email → jika tidak ditemukan, return error
3. Verifikasi password menggunakan `Bun.password.verify()`
4. Jika cocok, buat JWT token berisi `id`, `email`, dan `role`
5. Return token

Contoh kode (tambahkan di chain yang sama):

```ts
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
```

#### 3c. Logout (`POST /auth/logout`)

> **NOTE TENTANG LOGOUT PADA JWT:**
> Fitur logout di atas hanya mengembalikan pesan sukses. Ini wajar karena pada sistem **Stateless JWT**, token tidak disimpan di sisi server. Server tidak bisa "menghancurkan" token secara sepihak.
> Proses logout yang sebenarnya harus dilakukan oleh **Client / Frontend** (React, Vue, Android, dll.) dengan cara **menghapus token dari memori atau localStorage**. Selama token tidak dikirim lagi di request selanjutnya, maka user dianggap sudah logout.
```ts
  // --- LOGOUT ---
  .post("/logout", () => {
    return { message: "Logout berhasil. Hapus token di client." };
  });
```

---

### Langkah 4: Buat Middleware Autentikasi

**File baru:** `src/middleware/auth.ts`

Middleware ini berfungsi untuk:
1. Mengecek apakah request memiliki token JWT yang valid
2. Mengecek apakah user memiliki role yang sesuai

Contoh kode:

```ts
// src/middleware/auth.ts
import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";

// Middleware: Cek apakah user sudah login (token valid)
// Note: Kita jadikan fungsi (app: Elysia) => app agar variabel currentUser
// bisa terekspos / dibagikan dengan baik ke route yang menggunakan middleware ini.
export const authMiddleware = (app: Elysia) =>
  app
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
      // 4. Tolak akses jika token tidak ada atau tidak valid
      if (!currentUser) {
        set.status = 401;
        return { error: "Token tidak ditemukan atau tidak valid. Silakan login." };
      }
    });
```

> **IMPORTANT:**
> 1. Mengapa menggunakan `(app: Elysia) => app` dan bukan `new Elysia({ name: "..." })`? Karena jika kita memberikan *name*, Elysia akan mengisolasi state-nya, sehingga variabel `currentUser` tidak akan terbaca di route utama (undefined) dan menyebabkan error 500 saat kita mengecek `.role`.
> 2. Mengapa tidak me-lempar `throw new Error()` langsung di dalam `.resolve()`? Me-lempar error di tahap resolusi dependensi terkadang bisa bypass penanganan error biasa. Solusi yang lebih kuat adalah mereturn `null`, lalu menolak request secara bersih lewat *lifecycle hook* `.onBeforeHandle()`. Ini menjamin API akan merespon dengan rapi (status 401).

---

### Langkah 5: Update User Routes

**File:** `src/routes/index.ts`

Ubah route users agar:
- **Semua route butuh login** (menggunakan `authMiddleware`)
- **GET /users** → semua user yang login bisa akses (admin & user biasa)
- **GET /users/:id** → semua user yang login bisa lihat detail user
- **POST /users** → hanya admin
- **PUT /users/:id** → hanya admin
- **DELETE /users/:id** → hanya admin

Contoh kode:

```ts
// src/routes/index.ts
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
        .values({ ...body, password: hashedPassword })
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
```

---

### Langkah 6: Update Entry Point

**File:** `src/index.ts`

Tambahkan auth routes ke server:

```ts
// src/index.ts
import { Elysia } from "elysia";
import { userRoutes } from "./routes";
import { authRoutes } from "./routes/auth";

const app = new Elysia()
  .get("/", () => "Hello Elysia")
  .use(authRoutes)
  .use(userRoutes)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
```

---

### Langkah 7: Buat Seed Admin

**File baru:** `src/db/seed.ts`

Buat script untuk menambahkan user admin pertama kali:

```ts
// src/db/seed.ts
import { db } from "./index";
import { users } from "./schema";
import { eq } from "drizzle-orm";

async function seed() {
  // Cek apakah admin sudah ada
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, "admin@admin.com"));

  if (existing.length > 0) {
    console.log("Admin sudah ada, skip seed.");
    return;
  }

  // Buat admin
  const hashedPassword = await Bun.password.hash("admin123");

  await db.insert(users).values({
    name: "Admin",
    email: "admin@admin.com",
    password: hashedPassword,
    role: "admin",
  });

  console.log("✅ Admin berhasil dibuat!");
  console.log("   Email: admin@admin.com");
  console.log("   Password: admin123");
}

seed();
```

Tambahkan script di `package.json`:

```json
{
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed": "bun run src/db/seed.ts"
  }
}
```

---

### Langkah 8: Testing

Jalankan perintah berikut secara berurutan:

```bash
# 1. Push schema terbaru ke database
bun run db:push

# 2. Seed admin pertama
bun run db:seed

# 3. Jalankan server
bun run dev
```

#### Test dengan curl / Postman:

**Register user baru:**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "John", "email": "john@test.com", "password": "123456"}'
```

**Login:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@admin.com", "password": "admin123"}'
```
→ Simpan `token` dari response

**Lihat semua user (pakai token):**
```bash
curl http://localhost:3000/users \
  -H "Authorization: Bearer TOKEN_DARI_LOGIN"
```

**Tambah user (admin only):**
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_ADMIN" \
  -d '{"name": "Jane", "email": "jane@test.com", "password": "123456"}'
```

---

## Struktur Folder Akhir

```
src/
├── index.ts              # Entry point, setup server + routes
├── db/
│   ├── index.ts           # Koneksi database
│   ├── schema.ts          # Definisi tabel (users + password + role)
│   └── seed.ts            # Script seed admin
├── middleware/
│   └── auth.ts            # Middleware cek JWT token + role
└── routes/
    ├── index.ts           # CRUD users (admin & user)
    └── auth.ts            # Register, login, logout
```

---

## Ringkasan Endpoint API

| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| `POST` | `/auth/register` | Public | Daftar user baru |
| `POST` | `/auth/login` | Public | Login, dapat token |
| `POST` | `/auth/logout` | Public | Konfirmasi logout |
| `GET` | `/users` | Login (admin & user) | Lihat daftar user |
| `GET` | `/users/:id` | Login (admin & user) | Lihat detail user |
| `POST` | `/users` | Admin only | Tambah user baru |
| `PUT` | `/users/:id` | Admin only | Edit user |
| `DELETE` | `/users/:id` | Admin only | Hapus user |

---

## Catatan Penting

- **Password tidak pernah dikembalikan** di response API — selalu distrip sebelum dikirim
- **JWT bersifat stateless** — logout dilakukan di sisi client (hapus token)
- **Role hanya 2:** `admin` dan `user`. Bisa dikembangkan nanti
- Jangan commit file `.env` dan `data/*.db` ke repository
- Untuk testing cepat, gunakan Postman atau extension REST Client di VS Code
