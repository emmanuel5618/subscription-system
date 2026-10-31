import { prisma } from "@/lib/prisma";
import { InvoiceStatus, PaymentStatus, SubscriptionStatus, BillingInterval } from "@prisma/client";
import { getStartOfMonth, getEndOfMonth } from "@/lib/dates";

export async function getFinanceSummary() {
  const now = new Date();
  const startOfMonth = getStartOfMonth(now);
  const endOfMonth = getEndOfMonth(now);

  const activeSubscriptions = await prisma.subscription.count({
    where: { status: SubscriptionStatus.ACTIVE }
  });

  const subscriptionsForMrr = await prisma.subscription.findMany({
    where: { status: SubscriptionStatus.ACTIVE },
    include: {
      plan: true,
      lines: true
    }
  });

  let mrr = 0;

  for (const subscription of subscriptionsForMrr) {
    const subscriptionMonthly = subscription.lines.reduce((acc, line) => {
      const amount = line.unitPrice * line.quantity;

      switch (subscription.plan.billingInterval) {
        case BillingInterval.DAILY:
          return acc + Math.round((amount * 30) / subscription.plan.billingIntervalCount);
        case BillingInterval.WEEKLY:
          return acc + Math.round((amount * 52) / (12 * subscription.plan.billingIntervalCount));
        case BillingInterval.MONTHLY:
          return acc + Math.round(amount / subscription.plan.billingIntervalCount);
        case BillingInterval.YEARLY:
          return acc + Math.round(amount / (12 * subscription.plan.billingIntervalCount));
        default:
          return acc + amount;
      }
    }, 0);

    mrr += subscriptionMonthly;
  }

  const revenueThisMonth = await prisma.invoice.aggregate({
    _sum: { total: true },
    where: {
      issueDate: { gte: startOfMonth, lte: endOfMonth },
      status: { in: [InvoiceStatus.CONFIRMED, InvoiceStatus.PAID] }
    }
  });

  const paymentsReceivedThisMonth = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: {
      paidAt: { gte: startOfMonth, lte: endOfMonth },
      status: PaymentStatus.COMPLETED
    }
  });

  const overdueInvoices = await prisma.invoice.aggregate({
    _sum: { balance: true },
    where: {
      status: InvoiceStatus.CONFIRMED,
      dueDate: { lt: now }
    }
  });

  const outstandingInvoices = await prisma.invoice.aggregate({
    _sum: { balance: true },
    where: {
      status: InvoiceStatus.CONFIRMED
    }
  });

  const taxCollectedThisMonth = await prisma.invoice.aggregate({
    _sum: { taxTotal: true },
    where: {
      issueDate: { gte: startOfMonth, lte: endOfMonth },
      status: { in: [InvoiceStatus.CONFIRMED, InvoiceStatus.PAID] }
    }
  });

  const discountsUsedThisMonth = await prisma.discountRedemption.count({
    where: {
      redeemedAt: { gte: startOfMonth, lte: endOfMonth }
    }
  });

  return {
    activeSubscriptions,
    mrr,
    arr: mrr * 12,
    revenueThisMonth: revenueThisMonth._sum.total ?? 0,
    paymentsReceivedThisMonth: paymentsReceivedThisMonth._sum.amount ?? 0,
    overdueTotal: overdueInvoices._sum.balance ?? 0,
    outstandingTotal: outstandingInvoices._sum.balance ?? 0,
    taxCollectedThisMonth: taxCollectedThisMonth._sum.taxTotal ?? 0,
    discountsUsedThisMonth
  };
}