import { Router } from "express";
import { z } from "zod";
import { ShipmentStatus } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../common/async-handler.js";
import { authenticate, authorize } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";

const router = Router();
router.use(authenticate, authorize("ADMIN"));

router.post("/", validate(z.object({
  body: z.object({
    orderId: z.coerce.number().int().positive(),
    status: z.nativeEnum(ShipmentStatus).default(ShipmentStatus.PENDING)
  })
})), asyncHandler(async (req, res) => {
  const shipment = await prisma.shipment.create({ data: req.body });
  res.status(201).json({ success: true, data: shipment });
}));

router.patch("/:id/status", validate(z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({ status: z.nativeEnum(ShipmentStatus) })
})), asyncHandler(async (req, res) => {
  const shipment = await prisma.shipment.update({
    where: { shipmentId: Number(req.params.id) },
    data: { status: req.body.status }
  });
  res.json({ success: true, data: shipment });
}));

export default router;

