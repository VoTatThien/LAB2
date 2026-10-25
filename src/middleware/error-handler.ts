import type { ErrorRequestHandler, RequestHandler } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { ZodError } from "zod";
import { AppError } from "../common/app-error.js";
import { env } from "../config/env.js";

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError(404, `Không tìm thấy ${req.method} ${req.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ success: false, message: error.message, details: error.details });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ", details: error.flatten() });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return res.status(409).json({ success: false, message: "Dữ liệu đã tồn tại" });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "Không tìm thấy dữ liệu" });
    }
    if (error.code === "P2003") {
      return res.status(409).json({ success: false, message: "Không thể xóa dữ liệu đang được tham chiếu" });
    }
  }

  console.error(error);
  return res.status(500).json({
    success: false,
    message: "Lỗi máy chủ nội bộ",
    ...(env.NODE_ENV === "development" && { error: error instanceof Error ? error.message : String(error) })
  });
};
