import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "../common/app-error.js";

export const validate = (schema: ZodType): RequestHandler => (req, _res, next) => {
  const result = schema.safeParse({ body: req.body, params: req.params, query: req.query });

  if (!result.success) {
    return next(new AppError(400, "Dữ liệu đầu vào không hợp lệ", result.error.flatten()));
  }

  const parsed = result.data as { body?: unknown; params?: unknown; query?: unknown };
  if (parsed.body !== undefined) req.body = parsed.body;
  if (parsed.params !== undefined) Object.assign(req.params, parsed.params);
  if (parsed.query !== undefined) Object.assign(req.query, parsed.query);
  next();
};

