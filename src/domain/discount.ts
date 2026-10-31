import { Prisma, DiscountRule, DiscountScope, DiscountType } from "@prisma/client";
import { applyBps } from "@/lib/money";

export type DiscountContext = {
  currency: string;
  subtotal: number;
  quantity: number;
  scope: "SUBSCRIPTION" | "PRODUCT";
  at: Date;
};

function isEligible(rule: DiscountRule, ctx: DiscountContext): boolean {
  if (!rule.active) {
    return false;
  }

  if (rule.startsAt && rule.startsAt > ctx.at) {
    return false;
  }

  if (rule.endsAt && rule.endsAt < ctx.at) {
    return false;
  }

  if (rule.usageLimit !== null && rule.usageCount >= rule.usageLimit) {
    return false;
  }

  if (rule.minimumPurchase !== null && ctx.subtotal < rule.minimumPurchase) {
    return false;
  }

  if (rule.minimumQuantity !== null && ctx.quantity < rule.minimumQuantity) {
    return false;
  }

  if (rule.scope === DiscountScope.SUBSCRIPTION && ctx.scope !== "SUBSCRIPTION") {
    return false;
  }

  if (rule.scope === DiscountScope.PRODUCT && ctx.scope !== "PRODUCT") {
    return false;
  }

  return true;
}

export function calculateDiscountAmount(rule: DiscountRule, ctx: DiscountContext): number {
  if (rule.type === DiscountType.FIXED) {
    return Math.min(rule.value, ctx.subtotal);
  }

  return applyBps(ctx.subtotal, rule.value);
}

export async function chooseBestDiscountTx(
  tx: Prisma.TransactionClient,
  ctx: DiscountContext
): Promise<{ discountRuleId: string; amount: number } | null> {
  const rules = await tx.discountRule.findMany({
    where: { active: true },
    orderBy: { priority: "desc" }
  });

  let best: { discountRuleId: string; amount: number } | null = null;

  for (const rule of rules) {
    if (!isEligible(rule, ctx)) {
      continue;
    }

    const amount = calculateDiscountAmount(rule, ctx);

    if (amount > 0 && (!best || amount > best.amount)) {
      best = {
        discountRuleId: rule.id,
        amount
      };
    }
  }

  return best;
}