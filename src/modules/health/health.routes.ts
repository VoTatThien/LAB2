import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../common/async-handler.js";

const router = Router();

router.get("/live", (_req, res) => {
  res.json({ status: "ok", service: "ecommerce-api", timestamp: new Date().toISOString() });
});

router.get("/ready", asyncHandler(async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ready", database: "connected", timestamp: new Date().toISOString() });
}));

router.get("/", asyncHandler(async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", database: "connected", uptime: process.uptime(), timestamp: new Date().toISOString() });
}));

export default router;

