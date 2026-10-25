import { Router } from "express";
import { z } from "zod";
import { Prisma, ShipmentStatus } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../common/app-error.js";
import { asyncHandler } from "../../common/async-handler.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";

const router = Router();
router.use(authenticate);

const orderInclude = {
  details: { include: { product: { select: { productName: true } } } },
  shipments: true
} as const;

router.post("/", validate(z.object({
  body: z.object({
    items: z.array(z.object({
      productId: z.coerce.number().int().positive(),
      quantity: z.coerce.number().int().positive().max(1000)
    })).min(1).refine((items) => new Set(items.map((item) => item.productId)).size === items.length, "Sản phẩm bị trùng")
  })
})), asyncHandler(async (req, res) => {
  const items = req.body.items as Array<{ productId: number; quantity: number }>;

  const order = await prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({ where: { productId: { in: items.map((item) => item.productId) } } });
    if (products.length !== items.length) throw new AppError(400, "Có sản phẩm không tồn tại");
    const productMap = new Map(products.map((product) => [product.productId, product]));

    for (const item of items) {
      const updated = await tx.product.updateMany({
        where: { productId: item.productId, quantity: { gte: item.quantity } },
        data: { quantity: { decrement: item.quantity } }
      });
      if (updated.count === 0) {
        throw new AppError(409, `Sản phẩm ${productMap.get(item.productId)!.productName} không đủ tồn kho`);
      }
    }

    return tx.order.create({
      data: {
        userId: req.auth!.userId,
        details: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: productMap.get(item.productId)!.price
          }))
        },
        shipments: {
          create: {
            status: ShipmentStatus.PENDING
          }
        }
      },
      include: orderInclude
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  res.status(201).json({ success: true, data: order });
}));

router.get("/", asyncHandler(async (req, res) => {
  const where = req.auth!.role === "ADMIN" ? {} : { userId: req.auth!.userId };
  const orders = await prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: "desc" } });
  res.json({ success: true, data: orders });
}));

router.get("/:id", validate(z.object({ params: z.object({ id: z.coerce.number().int().positive() }) })), asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { orderId: Number(req.params.id) }, include: orderInclude });
  if (!order) throw new AppError(404, "Không tìm thấy đơn hàng");
  if (req.auth!.role !== "ADMIN" && order.userId !== req.auth!.userId) {
    throw new AppError(403, "Bạn không có quyền xem đơn hàng này");
  }
  res.json({ success: true, data: order });
}));

export default router;
