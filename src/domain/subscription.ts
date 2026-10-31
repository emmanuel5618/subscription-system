import { Prisma, SubscriptionStatus } from "@prisma/client";
import { nextSequence } from "@/domain/sequence";
import { audit } from "@/lib/audit";
import { ApiError } from "@/lib/api-error";

export async function createSubscriptionFromQuoteTx(
  tx: Prisma.TransactionClient,
  quoteId: string,
  actorId?: string | null
): Promise<any> {
  const quote = await tx.quote.findUnique({
    where: { id: quoteId },
    include: {
      lines: true,
      customer: true,
      plan: true
    }
  });

  if (!quote) {
    throw new ApiError(404, "Quote not found");
  }

  if (!quote.planId) {
    throw new ApiError(400, "Quote must have a plan before activation");
  }

  if (quote.lines.length === 0) {
    throw new ApiError(400, "Quote has no lines");
  }

  const number = await nextSequence("subscription", "SUB", tx);
  const now = new Date();

  const subscription = await tx.subscription.create({
    data: {
      number,
      customerId: quote.customerId,
      planId: quote.planId,
      quoteId: quote.id,
      status: SubscriptionStatus.ACTIVE,
      startDate: now,
      paymentTerms: quote.paymentTerms,
      currency: quote.currency,
      nextBillingAt: now,
      lines: {
        create: quote.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
         optionSelection:
  line.optionSelection === null
    ? Prisma.JsonNull
    : (line.optionSelection as Prisma.InputJsonValue),
          taxRuleId: line.taxRuleId
        }))
      }
    }
  });

  await tx.quote.update({
    where: { id: quote.id },
    data: { status: "ACTIVE" }
  });

  await audit(tx, actorId, "subscription", subscription.id, "created-from-quote", quote, subscription);

  return subscription;
}