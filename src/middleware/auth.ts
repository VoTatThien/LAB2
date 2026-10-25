import type { RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../common/app-error.js";

type AccessTokenPayload = JwtPayload & { sub: string; role: string };

export const authenticate: RequestHandler = (req, _res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return next(new AppError(401, "Thiếu access token"));
  }

  try {
    const payload = jwt.verify(authorization.slice(7), env.JWT_SECRET) as AccessTokenPayload;
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || !payload.role) throw new Error("Invalid payload");
    req.auth = { userId, role: payload.role };
    next();
  } catch {
    next(new AppError(401, "Access token không hợp lệ hoặc đã hết hạn"));
  }
};

export const authorize = (...roles: string[]): RequestHandler => (req, _res, next) => {
  if (!req.auth || !roles.includes(req.auth.role)) {
    return next(new AppError(403, "Bạn không có quyền thực hiện thao tác này"));
  }
  next();
};

