import { Prisma } from "@prisma/client";

export async function getTaxBpsTx(
  tx: Prisma.TransactionClient,
  taxRuleId: string | null | undefined,
  at: Date = new Date()
): Promise<number> {
  if (!taxRuleId) {
    return 0;
  }

  const rule = await tx.taxRule.findFirst({
    where: {
      id: taxRuleId,
      active: true
    }
  });

  if (!rule) {
    return 0;
  }

  if (rule.validFrom && rule.validFrom > at) {
    return 0;
  }

  if (rule.validTo && rule.validTo < at) {
    return 0;
  }

  return rule.rateBps;
}