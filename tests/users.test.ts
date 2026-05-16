import { describe, expect, it, beforeEach } from "bun:test";
import { app } from "../src/index";
import { cleanDatabase, createAdmin, createUser, getAuthToken } from "./setup";
import { db } from "../src/db";
import { users } from "../src/db/schema";
import { eq } from "drizzle-orm";

describe("Users API", () => {
  let adminToken: string;
  let userToken: string;
  let testUser: any;
  let testAdmin: any;

  beforeEach(async () => {
    await cleanDatabase();
    testAdmin = await createAdmin(); // admin@test.com / admin123
    testUser = await createUser();   // user@test.com / user123
    
    adminToken = await getAuthToken(app, "admin@test.com", "admin123");
    userToken = await getAuthToken(app, "user@test.com", "user123");
  });

  describe("Middleware Auth", () => {
    it("should return 401 if no authorization header is provided", async () => {
      const response = await app.handle(
        new Request("http://localhost/users", { method: "GET" })
      );
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Token tidak ditemukan atau tidak valid");
    });

    it("should return 401 if token is invalid", async () => {
      const response = await app.handle(
        new Request("http://localhost/users", {
          method: "GET",
          headers: { "Authorization": "Bearer invalid-token" }
        })
      );
      expect(response.status).toBe(401);
    });
  });

  describe("GET /users", () => {
    it("should allow both user and admin to list users", async () => {
      // Test as user
      const resUser = await app.handle(
        new Request("http://localhost/users", {
          method: "GET",
          headers: { "Authorization": `Bearer ${userToken}` }
        })
      );
      expect(resUser.status).toBe(200);
      const dataUser = await resUser.json();
      expect(Array.isArray(dataUser)).toBe(true);
      expect(dataUser.length).toBe(2);
      expect(dataUser[0].password).toBeUndefined();

      // Test as admin
      const resAdmin = await app.handle(
        new Request("http://localhost/users", {
          method: "GET",
          headers: { "Authorization": `Bearer ${adminToken}` }
        })
      );
      expect(resAdmin.status).toBe(200);
    });
  });

  describe("GET /users/me", () => {
    it("should return current user information", async () => {
      const response = await app.handle(
        new Request("http://localhost/users/me", {
          method: "GET",
          headers: { "Authorization": `Bearer ${userToken}` }
        })
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.currentUser.email).toBe("user@test.com");
      expect(data.currentUser.role).toBe("user");
    });
  });

  describe("GET /users/:id", () => {
    it("should return user detail for valid ID", async () => {
      const response = await app.handle(
        new Request(`http://localhost/users/${testUser.id}`, {
          method: "GET",
          headers: { "Authorization": `Bearer ${userToken}` }
        })
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.email).toBe("user@test.com");
      expect(data.password).toBeUndefined();
    });

    it("should return 404 if user not found", async () => {
      const response = await app.handle(
        new Request("http://localhost/users/9999", {
          method: "GET",
          headers: { "Authorization": `Bearer ${userToken}` }
        })
      );
      expect(response.status).toBe(404);
    });
  });

  describe("POST /users (Admin Only)", () => {
    it("should allow admin to create user", async () => {
      const response = await app.handle(
        new Request("http://localhost/users", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${adminToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: "New User",
            email: "new@example.com",
            password: "password123",
            role: "user"
          })
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.email).toBe("new@example.com");
    });

    it("should deny non-admin to create user", async () => {
      const response = await app.handle(
        new Request("http://localhost/users", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${userToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: "New User",
            email: "new@example.com",
            password: "password123"
          })
        })
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe("Hanya admin yang bisa menambah user");
    });
  });

  describe("PUT /users/:id (Admin Only)", () => {
    it("should allow admin to update user", async () => {
      const response = await app.handle(
        new Request(`http://localhost/users/${testUser.id}`, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${adminToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: "Updated Name",
            role: "admin"
          })
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.name).toBe("Updated Name");
      expect(data.user.role).toBe("admin");
    });

    it("should deny non-admin to update user", async () => {
      const response = await app.handle(
        new Request(`http://localhost/users/${testAdmin.id}`, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${userToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ name: "Hacker" })
        })
      );
      expect(response.status).toBe(403);
    });
  });

  describe("DELETE /users/:id (Admin Only)", () => {
    it("should allow admin to delete user", async () => {
      const response = await app.handle(
        new Request(`http://localhost/users/${testUser.id}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${adminToken}` }
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe("User berhasil dihapus");

      // Verify gone from DB
      const dbUser = await db.select().from(users).where(eq(users.id, testUser.id));
      expect(dbUser.length).toBe(0);
    });

    it("should deny non-admin to delete user", async () => {
      const response = await app.handle(
        new Request(`http://localhost/users/${testAdmin.id}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${userToken}` }
        })
      );
      expect(response.status).toBe(403);
    });
  });
});
