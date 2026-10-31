import { PrismaClient, Role, ProductType, BillingInterval, DiscountType, DiscountScope } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("Password123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      passwordHash: password,
      role: Role.ADMIN
    }
  });

  await prisma.user.upsert({
    where: { email: "sales@example.com" },
    update: {},
    create: {
      email: "sales@example.com",
      passwordHash: password,
      role: Role.SALES
    }
  });

  await prisma.user.upsert({
    where: { email: "finance@example.com" },
    update: {},
    create: {
      email: "finance@example.com",
      passwordHash: password,
      role: Role.FINANCE
    }
  });

  const customerUser = await prisma.user.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: {
      email: "customer@example.com",
      passwordHash: password,
      role: Role.CUSTOMER
    }
  });

  const customer = await prisma.customer.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: {
      userId: customerUser.id,
      name: "Example Customer",
      email: "customer@example.com"
    }
  });

  const product = await prisma.product.create({
    data: {
      name: "Managed Subscription Service",
      type: ProductType.SERVICE,
      salesPrice: 10000,
      costPrice: 4000,
      active: true
    }
  });

  const option = await prisma.productOption.create({
    data: {
      productId: product.id,
      name: "Brand"
    }
  });

  await prisma.productOptionValue.create({
    data: {
      optionId: option.id,
      value: "Brand A",
      priceDelta: 0,
      costDelta: 0
    }
  });

  await prisma.productOptionValue.create({
    data: {
      optionId: option.id,
      value: "Brand B",
      priceDelta: 500,
      costDelta: 200
    }
  });

  const plan = await prisma.plan.create({
    data: {
      name: "Monthly Plan",
      billingInterval: BillingInterval.MONTHLY,
      billingIntervalCount: 1,
      minimumQuantity: 1,
      active: true
    }
  });

  await prisma.planLine.create({
    data: {
      planId: plan.id,
      productId: product.id,
      quantity: 1,
      unitPriceOverride: 10000
    }
  });

  await prisma.taxRule.create({
    data: {
      name: "Standard Tax 10%",
      rateBps: 1000,
      active: true
    }
  });

  await prisma.discountRule.create({
    data: {
      name: "Launch Discount 10%",
      type: DiscountType.PERCENTAGE,
      value: 1000,
      scope: DiscountScope.SUBSCRIPTION,
      active: true
    }
  });

  console.log("Seed complete", { adminId: admin.id, customerId: customer.id });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });