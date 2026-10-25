import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../common/app-error.js";
import { asyncHandler } from "../../common/async-handler.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";

const router = Router();

const registerSchema = z.object({
  body: z.object({
    username: z.string().trim().min(3).max(50),
    fullName: z.string().trim().min(2).max(100),
    password: z.string().min(8).max(72)
  })
});

const loginSchema = z.object({
  body: z.object({
    username: z.string().trim().min(1),
    password: z.string().min(1)
  })
});

const createToken = (userId: number, role: string) => jwt.sign(
  { role },
  env.JWT_SECRET,
  { subject: String(userId), expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] }
);

router.post("/register", validate(registerSchema), asyncHandler(async (req, res) => {
  const { username, fullName, password } = req.body;
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) throw new AppError(409, "Tên đăng nhập đã tồn tại");

  const [role, membership] = await Promise.all([
    prisma.role.findUnique({ where: { roleName: "NORMAL" } }),
    prisma.membership.findUnique({ where: { membershipName: "BASIC" } })
  ]);
  if (!role || !membership) throw new AppError(503, "Dữ liệu nền chưa được seed");

  const user = await prisma.user.create({
    data: {
      username,
      fullName,
      password: await bcrypt.hash(password, 12),
      roleId: role.roleId,
      membershipId: membership.membershipId
    },
    select: { userId: true, username: true, fullName: true }
  });

  res.status(201).json({ success: true, data: { user, accessToken: createToken(user.userId, role.roleName) } });
}));

router.post("/login", validate(loginSchema), asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username }, include: { role: true } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError(401, "Tên đăng nhập hoặc mật khẩu không đúng");
  }

  res.json({
    success: true,
    data: {
      accessToken: createToken(user.userId, user.role.roleName),
      user: { userId: user.userId, username: user.username, fullName: user.fullName, role: user.role.roleName }
    }
  });
}));

router.get("/me", authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { userId: req.auth!.userId },
    select: {
      userId: true,
      username: true,
      fullName: true,
      role: { select: { roleName: true } },
      membership: { select: { membershipName: true, score: true } }
    }
  });
  if (!user) throw new AppError(404, "Không tìm thấy người dùng");
  res.json({ success: true, data: user });
}));

export default router;
