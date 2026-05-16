# User Management API

REST API untuk manajemen user dengan fitur autentikasi JWT dan role-based access control (RBAC). Dibangun menggunakan **Bun**, **Elysia.js**, **Drizzle ORM**, dan **SQLite**.

---

## Tech Stack

| Teknologi | Keterangan |
|---|---|
| [Bun](https://bun.sh) v1.3+ | JavaScript runtime & package manager |
| [Elysia.js](https://elysiajs.com) v1.4 | Web framework (mirip Express, khusus Bun) |
| [Drizzle ORM](https://orm.drizzle.team) v0.45 | ORM type-safe untuk query database |
| [SQLite](https://www.sqlite.org) | Database file-based (ringan, tanpa setup server) |
| TypeScript v5 | Bahasa pemrograman |

### Library yang Digunakan

| Library | Fungsi |
|---|---|
| `elysia` | Framework HTTP utama |
| `@elysiajs/jwt` | Plugin JWT untuk autentikasi token |
| `@elysiajs/swagger` | Plugin Swagger UI untuk dokumentasi API interaktif |
| `drizzle-orm` | ORM untuk interaksi dengan database |
| `better-sqlite3` | Driver SQLite untuk Node.js/Bun |
| `drizzle-kit` | CLI tool untuk migrasi dan manajemen skema database |

---

## Arsitektur & Struktur Folder

```
tesvb/
├── src/
│   ├── index.ts              # Entry point aplikasi, konfigurasi Elysia & Swagger
│   ├── db/
│   │   ├── index.ts          # Koneksi database (Drizzle + SQLite)
│   │   ├── schema.ts         # Definisi skema tabel (Drizzle schema)
│   │   └── seed.ts           # Script untuk membuat data awal (admin)
│   ├── middleware/
│   │   └── auth.ts           # Middleware autentikasi JWT (verifikasi token)
│   └── routes/
│       ├── auth.ts           # Route autentikasi (register, login, logout)
│       └── index.ts          # Route CRUD user (list, detail, create, update, delete)
├── data/
│   └── app.db                # File database SQLite (auto-generated)
├── drizzle/                  # Folder migrasi database (auto-generated)
├── drizzle.config.ts         # Konfigurasi Drizzle Kit
├── .env                      # Environment variables (jangan di-commit)
├── .env.example              # Contoh environment variables
├── package.json
└── tsconfig.json
```

### Konvensi Penamaan File

- **`src/db/`** — Semua yang berhubungan dengan database (koneksi, skema, seed)
- **`src/middleware/`** — Middleware yang digunakan sebelum request masuk ke route
- **`src/routes/`** — Definisi endpoint API, dikelompokkan per fitur
- **`src/index.ts`** — Entry point, tempat semua plugin dan route di-register

---

## Skema Database

### Tabel: `users`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | ID unik user |
| `name` | TEXT | NOT NULL | Nama lengkap user |
| `email` | TEXT | NOT NULL, UNIQUE | Email (digunakan untuk login) |
| `password` | TEXT | NOT NULL | Password yang sudah di-hash |
| `role` | TEXT | NOT NULL, DEFAULT `"user"` | Role user: `"admin"` atau `"user"` |
| `created_at` | TEXT | DEFAULT `CURRENT_TIMESTAMP` | Waktu pembuatan akun |

---

## API yang Tersedia

### Auth (`/auth`)

| Method | Endpoint | Deskripsi | Auth |
|---|---|---|---|
| POST | `/auth/register` | Mendaftarkan user baru | ❌ |
| POST | `/auth/login` | Login dan mendapatkan JWT token | ❌ |
| POST | `/auth/logout` | Logout (stateless, hapus token di client) | ❌ |

### Users (`/users`)

| Method | Endpoint | Deskripsi | Auth | Role |
|---|---|---|---|---|
| GET | `/users` | Daftar semua user | ✅ | Semua |
| GET | `/users/me` | Informasi user yang sedang login | ✅ | Semua |
| GET | `/users/:id` | Detail user berdasarkan ID | ✅ | Semua |
| POST | `/users` | Tambah user baru | ✅ | Admin |
| PUT | `/users/:id` | Update data user | ✅ | Admin |
| DELETE | `/users/:id` | Hapus user | ✅ | Admin |

### Detail Request & Response

#### `POST /auth/register`

Request:
```json
{
  "name": "Budi",
  "email": "budi@example.com",
  "password": "password123"
}
```

Response (200):
```json
{
  "message": "Register berhasil",
  "user": {
    "id": 2,
    "name": "Budi",
    "email": "budi@example.com",
    "role": "user",
    "createdAt": "CURRENT_TIMESTAMP"
  }
}
```

Error (400): `{ "error": "Email sudah terdaftar" }`

#### `POST /auth/login`

Request:
```json
{
  "email": "admin@admin.com",
  "password": "admin123"
}
```

Response (200):
```json
{
  "message": "Login berhasil",
  "token": "eyJhbGciOiJIUzI1NiJ9..."
}
```

Error (401): `{ "error": "Email atau password salah" }`

#### `POST /auth/logout`

Response (200):
```json
{
  "message": "Logout berhasil. Hapus token di client."
}
```

#### `GET /users`

Header: `Authorization: Bearer <token>`

Response (200):
```json
[
  {
    "id": 1,
    "name": "Admin",
    "email": "admin@admin.com",
    "role": "admin",
    "createdAt": "CURRENT_TIMESTAMP"
  }
]
```

Error (401): `{ "error": "Token tidak ditemukan atau tidak valid" }`

#### `POST /users` (Admin Only)

Header: `Authorization: Bearer <token>`

Request:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securepassword",
  "role": "user"
}
```

Response (200):
```json
{
  "message": "User berhasil ditambahkan",
  "user": {
    "id": 3,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "user",
    "createdAt": "CURRENT_TIMESTAMP"
  }
}
```

Error (403): `{ "error": "Hanya admin yang bisa menambah user" }`

#### `PUT /users/:id` (Admin Only)

Header: `Authorization: Bearer <token>`

Request (semua field opsional):
```json
{
  "name": "Jane Updated",
  "role": "admin"
}
```

Response (200):
```json
{
  "message": "User berhasil diupdate",
  "user": {
    "id": 3,
    "name": "Jane Updated",
    "email": "jane@example.com",
    "role": "admin",
    "createdAt": "CURRENT_TIMESTAMP"
  }
}
```

Error (403): `{ "error": "Hanya admin yang bisa mengedit user" }`
Error (404): `{ "error": "User tidak ditemukan" }`

#### `DELETE /users/:id` (Admin Only)

Header: `Authorization: Bearer <token>`

Response (200): `{ "message": "User berhasil dihapus" }`
Error (403): `{ "error": "Hanya admin yang bisa menghapus user" }`
Error (404): `{ "error": "User tidak ditemukan" }`

---

## Cara Setup Project

### Prasyarat

- [Bun](https://bun.sh) v1.3 atau lebih baru

### Langkah-langkah

```bash
# 1. Clone repository
git clone https://github.com/Rindra-Aniko/tesvb.git
cd tesvb

# 2. Install dependencies
bun install

# 3. Salin file environment
cp .env.example .env
# Edit .env dan ganti JWT_SECRET dengan nilai yang aman

# 4. Push skema database ke SQLite
bun run db:push

# 5. Buat data admin awal (opsional)
bun run db:seed
# Admin default: admin@admin.com / admin123
```

---

## Cara Menjalankan Aplikasi

```bash
# Mode development (auto-reload saat file berubah)
bun run dev
```

Server akan berjalan di `http://localhost:3000`.

### Swagger UI

Dokumentasi API interaktif tersedia di:

```
http://localhost:3000/swagger
```

### Script yang Tersedia

| Script | Perintah | Keterangan |
|---|---|---|
| `dev` | `bun run dev` | Menjalankan server dengan auto-reload |
| `db:generate` | `bun run db:generate` | Generate file migrasi dari skema |
| `db:migrate` | `bun run db:migrate` | Jalankan migrasi database |
| `db:push` | `bun run db:push` | Push skema langsung ke database (tanpa migrasi) |
| `db:studio` | `bun run db:studio` | Buka Drizzle Studio (GUI database) |
| `db:seed` | `bun run db:seed` | Jalankan seeder untuk membuat admin awal |

---

## Cara Tes Aplikasi

Unit test tersedia di branch `test/unit-tests` menggunakan **Bun Test** (built-in test runner dari Bun).

```bash
# Pindah ke branch test
git checkout test/unit-tests

# Jalankan semua test
bun test

# Jalankan file test tertentu
bun test tests/auth.test.ts
bun test tests/users.test.ts
```

### Struktur File Test

```
tests/
├── setup.ts          # Helper: cleanup database, buat user, dapatkan token
├── auth.test.ts      # Test endpoint /auth (register, login, logout)
└── users.test.ts     # Test endpoint /users (CRUD + middleware auth)
```

### Cakupan Test

- **Auth**: Register (validasi, duplikat email, hashing), Login (kredensial valid/invalid), Logout
- **Middleware**: Request tanpa token, token invalid
- **Users CRUD**: List, Detail, Create (admin only), Update (admin only), Delete (admin only)
- **Role-Based Access**: Verifikasi user biasa ditolak untuk operasi admin

---

## Autentikasi

API ini menggunakan **JWT (JSON Web Token)** untuk autentikasi:

1. **Register** atau **Login** untuk mendapatkan token
2. Sertakan token di header setiap request ke endpoint yang memerlukan autentikasi:
   ```
   Authorization: Bearer <token>
   ```
3. Token berisi payload: `id`, `email`, `role`

### Role

| Role | Hak Akses |
|---|---|
| `user` | Melihat daftar user, melihat profil sendiri, melihat detail user |
| `admin` | Semua hak `user` + membuat, mengedit, dan menghapus user |
