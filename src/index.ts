import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { userRoutes } from "./routes";
import { authRoutes } from "./routes/auth";

export const app = new Elysia()
  .use(swagger({
    documentation: {
      info: {
        title: 'User Management API',
        version: '1.0.0'
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      },
      security: [{ bearerAuth: [] }]
    }
  }))
  .get("/", () => "Hello Elysia")
  .use(authRoutes)
  .use(userRoutes);

if (process.env.NODE_ENV !== 'test') {
  app.listen(3000);
  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
  );
}

