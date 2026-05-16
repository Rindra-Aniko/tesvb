# Unit Test Plan — User Management API

## Tujuan

Membuat unit test untuk **seluruh API endpoint** yang tersedia pada project ini. Test harus memastikan bahwa setiap endpoint berjalan sesuai ekspektasi, baik untuk kasus sukses (happy path) maupun kasus gagal (edge case / error).

---

## Tech Stack Testing

- **Test Runner:** `bun test` (built-in Bun test runner)
- **HTTP Client:** Gunakan `app.handle()` dari Elysia (tanpa perlu menjalankan server terpisah)
- **Database:** Gunakan SQLite file terpisah khusus test (misal `./data/test.db`) agar tidak mengganggu data development

---

## Aturan Umum

1. **Sebelum setiap skenario test (`beforeEach`), hapus semua data di tabel `users`** agar state database selalu bersih dan konsisten.
2. Jika skenario membutuhkan data awal (misal admin sudah ada), buat data tersebut di dalam `beforeEach` setelah penghapusan.
3. Gunakan file `.env.test` atau hardcode `DATABASE_URL` ke database test agar tidak menimpa database development.
4. Setiap file test harus bisa dijalankan secara independen.
5. Tambahkan script `"test": "bun test"` di `package.json`.

---

## Struktur File Test

```
tests/
├── setup.ts          # Setup database test, helper functions (create app instance, cleanup db, dll)
├── auth.test.ts      # Test untuk POST /auth/register, POST /auth/login, POST /auth/logout
└── users.test.ts     # Test untuk GET/POST/PUT/DELETE /users
```

---

## Skenario Test

### File: `tests/auth.test.ts`

#### `POST /auth/register`

- Register berhasil dengan data valid → status 200, response berisi `message` dan `user` (tanpa field `password`)
- Register gagal karena email sudah terdaftar → status 400, response berisi `error`
- Register gagal karena `name` kosong → status 422 (validation error)
- Register gagal karena `email` format tidak valid → status 422
- Register gagal karena `password` kurang dari 6 karakter → status 422
- Register gagal karena body kosong / field wajib tidak dikirim → status 422
- Verifikasi password yang tersimpan di database sudah di-hash (bukan plain text)
- Verifikasi role default user yang di-register selalu `"user"`

#### `POST /auth/login`

- Login berhasil dengan credential valid → status 200, response berisi `token`
- Login gagal karena email tidak terdaftar → status 401
- Login gagal karena password salah → status 401
- Login gagal karena `email` format tidak valid → status 422
- Login gagal karena `password` kurang dari 6 karakter → status 422
- Login gagal karena body kosong → status 422
- Verifikasi token JWT yang dikembalikan valid dan berisi payload `id`, `email`, `role`

#### `POST /auth/logout`

- Logout berhasil → status 200, response berisi `message`
- Logout bisa dipanggil tanpa token (stateless)

---

### File: `tests/users.test.ts`

> **Catatan:** Semua endpoint `/users` membutuhkan JWT token yang valid. Buat helper function untuk register + login dan mendapatkan token.

#### Middleware Auth (berlaku untuk semua endpoint `/users`)

- Request tanpa header `Authorization` → status 401
- Request dengan token yang tidak valid / expired / random string → status 401
- Request dengan format header salah (tanpa prefix `Bearer `) → status 401

#### `GET /users`

- User biasa (role `user`) bisa melihat daftar user → status 200, response berupa array
- Admin bisa melihat daftar user → status 200
- Response tidak mengandung field `password` di setiap item
- Ketika database kosong (hanya ada user yang login), response tetap valid

#### `GET /users/me`

- User yang login bisa melihat data dirinya → status 200, response berisi `currentUser`
- `currentUser` berisi `id`, `email`, `role`

#### `GET /users/:id`

- Berhasil mendapatkan detail user berdasarkan ID yang valid → status 200
- Response tidak mengandung field `password`
- User tidak ditemukan (ID tidak ada di database) → status 404
- ID bukan angka / format tidak valid → cek behavior (error atau 404)

#### `POST /users` (Admin Only)

- Admin berhasil menambah user baru → status 200, response berisi `user`
- User biasa (role `user`) ditolak → status 403
- Admin menambah user dengan email yang sudah ada → cek behavior (apakah ada error handling)
- Admin menambah user tanpa field `role` → role default menjadi `"user"`
- Admin menambah user dengan role `"admin"` → berhasil, role tersimpan sebagai `"admin"`
- Validasi gagal: `name` kosong → status 422
- Validasi gagal: `email` format tidak valid → status 422
- Validasi gagal: `password` kurang dari 6 karakter → status 422
- Response tidak mengandung field `password`

#### `PUT /users/:id` (Admin Only)

- Admin berhasil update `name` user → status 200
- Admin berhasil update `email` user → status 200
- Admin berhasil update `password` user → status 200, password baru di-hash
- Admin berhasil update `role` user → status 200
- Admin berhasil update beberapa field sekaligus → status 200
- User biasa (role `user`) ditolak → status 403
- User yang akan di-update tidak ditemukan → status 404
- Validasi: `email` format tidak valid → status 422
- Validasi: `password` kurang dari 6 karakter → status 422
- Response tidak mengandung field `password`

#### `DELETE /users/:id` (Admin Only)

- Admin berhasil menghapus user → status 200, response berisi `message`
- User biasa (role `user`) ditolak → status 403
- User yang akan dihapus tidak ditemukan → status 404
- Verifikasi user benar-benar hilang dari database setelah dihapus
- Admin menghapus dirinya sendiri → cek behavior

---

## Helper yang Perlu Dibuat di `tests/setup.ts`

1. **`createTestApp()`** — membuat instance Elysia app yang terhubung ke test database
2. **`cleanDatabase()`** — menghapus semua data di tabel `users`
3. **`createAdminUser()`** — membuat user admin dan mengembalikan datanya
4. **`createRegularUser()`** — membuat user biasa dan mengembalikan datanya
5. **`getAuthToken(email, password)`** — login dan mengembalikan JWT token
6. **`makeRequest(app, method, path, options?)`** — helper untuk membuat HTTP request ke app (opsional, untuk mengurangi boilerplate)

---

## Cara Menjalankan

```bash
bun test
```

Atau menjalankan file test tertentu:

```bash
bun test tests/auth.test.ts
bun test tests/users.test.ts
```
