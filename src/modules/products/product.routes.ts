import { Router } from "express";
import { z } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../common/app-error.js";
import { asyncHandler } from "../../common/async-handler.js";
import { authenticate, authorize } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";

const router = Router();
const idParams = z.object({ params: z.object({ id: z.coerce.number().int().positive() }) });
const listQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional()
});
const productBody = z.object({
  productName: z.string().trim().min(2).max(100),
  price: z.coerce.number().positive().max(99_999_999.99),
  quantity: z.coerce.number().int().nonnegative()
});

router.get("/", asyncHandler(async (req, res) => {
  const { page, limit, search } = listQuery.parse(req.query);
  const where = search ? { productName: { contains: search, mode: Prisma.QueryMode.insensitive } } : {};
  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { productId: "asc" } }),
    prisma.product.count({ where })
  ]);
  res.json({ success: true, data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}));

router.get("/:id", validate(idParams), asyncHandler(async (req, res) => {
  const product = await prisma.product.findUnique({ where: { productId: Number(req.params.id) } });
  if (!product) throw new AppError(404, "Không tìm thấy sản phẩm");
  res.json({ success: true, data: product });
}));

router.post("/", authenticate, authorize("ADMIN"), validate(z.object({ body: productBody })), asyncHandler(async (req, res) => {
  const product = await prisma.product.create({ data: req.body });
  res.status(201).json({ success: true, data: product });
}));

router.patch("/:id", authenticate, authorize("ADMIN"), validate(z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: productBody.partial().refine((value) => Object.keys(value).length > 0, "Cần ít nhất một trường")
})), asyncHandler(async (req, res) => {
  const product = await prisma.product.update({ where: { productId: Number(req.params.id) }, data: req.body });
  res.json({ success: true, data: product });
}));

router.delete("/:id", authenticate, authorize("ADMIN"), validate(idParams), asyncHandler(async (req, res) => {
  await prisma.product.delete({ where: { productId: Number(req.params.id) } });
  res.status(204).send();
}));

export default router;
