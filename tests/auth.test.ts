import { describe, expect, it, beforeEach } from "bun:test";
import { app } from "../src/index";
import { cleanDatabase } from "./setup";
import { db } from "../src/db";
import { users } from "../src/db/schema";
import { eq } from "drizzle-orm";

describe("Auth API", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("POST /auth/register", () => {
    it("should register a new user with valid data", async () => {
      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Budi",
            email: "budi@example.com",
            password: "password123",
          }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe("Register berhasil");
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe("budi@example.com");
      expect(data.user.password).toBeUndefined();
      
      // Verify role default
      expect(data.user.role).toBe("user");
      
      // Verify database entry and hashed password
      const dbUser = await db.select().from(users).where(eq(users.email, "budi@example.com"));
      expect(dbUser.length).toBe(1);
      expect(dbUser[0].password).not.toBe("password123");
      const isPasswordValid = await Bun.password.verify("password123", dbUser[0].password);
      expect(isPasswordValid).toBe(true);
    });

    it("should fail if email is already registered", async () => {
      // Create first user
      await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Budi",
            email: "budi@example.com",
            password: "password123",
          }),
        })
      );

      // Try to register again with same email
      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Budi 2",
            email: "budi@example.com",
            password: "password123",
          }),
        })
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Email sudah terdaftar");
    });

    it("should fail validation with invalid data", async () => {
      const invalidData = [
        { name: "", email: "budi@example.com", password: "password123" }, // Empty name
        { name: "Budi", email: "invalid-email", password: "password123" }, // Invalid email
        { name: "Budi", email: "budi@example.com", password: "123" },      // Short password
      ];

      for (const body of invalidData) {
        const response = await app.handle(
          new Request("http://localhost/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        );
        expect(response.status).toBe(422);
      }
    });
  });

  describe("POST /auth/login", () => {
    beforeEach(async () => {
      // Create a user for login tests
      await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "User Test",
            email: "user@test.com",
            password: "password123",
          }),
        })
      );
    });

    it("should login successfully with valid credentials", async () => {
      const response = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "user@test.com",
            password: "password123",
          }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe("Login berhasil");
      expect(data.token).toBeDefined();
    });

    it("should fail login with wrong password", async () => {
      const response = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "user@test.com",
            password: "wrongpassword",
          }),
        })
      );

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Email atau password salah");
    });

    it("should fail login with non-existent email", async () => {
      const response = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "nobody@test.com",
            password: "password123",
          }),
        })
      );

      expect(response.status).toBe(401);
    });
  });

  describe("POST /auth/logout", () => {
    it("should return logout success message", async () => {
      const response = await app.handle(
        new Request("http://localhost/auth/logout", {
          method: "POST",
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe("Logout berhasil. Hapus token di client.");
    });
  });
});
