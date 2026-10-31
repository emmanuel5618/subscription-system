import { prisma } from "@/lib/prisma";
import { addBillingInterval } from "@/lib/dates";
import { createDraftInvoiceTx, confirmInvoiceTx } from "@/domain/invoice";
import { SubscriptionStatus } from "@prisma/client";

export async function runBilling(now: Date = new Date(), actorId?: string | null) {
  const dueSubscriptions = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      nextBillingAt: { lte: now }
    },
    include: {
      plan: true,
      lines: true
    }
  });

  const results: Array<{ subscriptionId: string; ok: boolean; error?: string }> = [];

  for (const subscription of dueSubscriptions) {
    try {
      await prisma.$transaction(async (tx) => {
        const periodStart = subscription.nextBillingAt!;
        const periodEnd = addBillingInterval(
          periodStart,
          subscription.plan.billingInterval,
          subscription.plan.billingIntervalCount
        );

        const { invoice, created } = await createDraftInvoiceTx(
          tx,
          subscription.id,
          periodStart,
          periodEnd,
          actorId
        );

        if (created || invoice.status === "DRAFT") {
          await confirmInvoiceTx(tx, invoice.id, actorId);
        }

        await tx.subscription.update({
          where: { id: subscription.id },
          data: { nextBillingAt: periodEnd }
        });

        if (subscription.plan.autoCloseOnEnd && subscription.expiryDate && subscription.expiryDate <= periodEnd) {
          await tx.subscription.update({
            where: { id: subscription.id },
            data: {
              status: SubscriptionStatus.CLOSED,
              closedAt: now,
              closeReason: "auto_close_on_end"
            }
          });
        }
      });

      results.push({ subscriptionId: subscription.id, ok: true });
    } catch (error) {
      results.push({
        subscriptionId: subscription.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    processed: dueSubscriptions.length,
    results
  };
}