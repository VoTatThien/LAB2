import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL chưa được cấu hình");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function main() {
  const [adminRole, normalRole, basicMembership] = await Promise.all([
    prisma.role.upsert({ where: { roleName: "ADMIN" }, update: {}, create: { roleName: "ADMIN" } }),
    prisma.role.upsert({ where: { roleName: "NORMAL" }, update: {}, create: { roleName: "NORMAL" } }),
    prisma.membership.upsert({
      where: { membershipName: "BASIC" },
      update: { score: 10 },
      create: { membershipName: "BASIC", score: 10 }
    })
  ]);

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      fullName: "System Administrator",
      password: await bcrypt.hash("Admin@123", 12),
      roleId: adminRole.roleId,
      membershipId: basicMembership.membershipId
    }
  });

  const sampleProducts = [
    { productName: "Laptop MVP", price: "1599.00", quantity: 10 },
    { productName: "Wireless Mouse", price: "29.90", quantity: 50 }
  ];

  for (const product of sampleProducts) {
    const existing = await prisma.product.findFirst({ where: { productName: product.productName } });
    if (!existing) await prisma.product.create({ data: product });
  }

  console.log(`Seed hoàn tất. Roles: ${adminRole.roleName}, ${normalRole.roleName}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
