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
    process.exit(0);
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
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Error seeding admin:", err);
  process.exit(1);
});
