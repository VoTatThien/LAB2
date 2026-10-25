import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET phải có ít nhất 32 ký tự"),
  JWT_EXPIRES_IN: z.string().default("1d"),
  CORS_ORIGIN: z.string().default("http://localhost:3000")
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Cấu hình môi trường không hợp lệ:", result.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = result.data;

