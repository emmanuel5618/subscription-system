import { Prisma, InvoiceStatus } from "@prisma/client";
import { addDays } from "date-fns";
import { nextSequence } from "@/domain/sequence";
import { getTaxBpsTx } from "@/domain/tax";
import { chooseBestDiscountTx } from "@/domain/discount";
import { allocateDiscount, calculateLineTotals, calculateTotals } from "@/domain/pricing";
import { audit } from "@/lib/audit";
import { ApiError } from "@/lib/api-error";

export async function createDraftInvoiceTx(
  tx: Prisma.TransactionClient,
  subscriptionId: string,
  periodStart: Date,
  periodEnd: Date,
  actorId?: string | null
): Promise<{ invoice: any; created: boolean }> {
  const existing = await tx.invoice.findFirst({
    where: {
      subscriptionId,
      periodStart,
      periodEnd,
      status: { not: InvoiceStatus.CANCELLED }
    }
  });

  if (existing) {
    return { invoice: existing, created: false };
  }

  const subscription = await tx.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      lines: {
        include: {
          product: true
        }
      },
      customer: true,
      plan: true
    }
  });

  if (!subscription) {
    throw new ApiError(404, "Subscription not found");
  }

  if (subscription.lines.length === 0) {
    throw new ApiError(400, "Subscription has no lines");
  }

  const at = new Date();
  const rawLines: Array<{
    productId: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxBps: number;
    subtotal: number;
    optionSelection: any;
    taxRuleId: string | null;
  }> = [];

  for (const line of subscription.lines) {
    const taxBps = await getTaxBpsTx(tx, line.taxRuleId, at);

    rawLines.push({
      productId: line.productId,
      description: line.product.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxBps,
      subtotal: line.unitPrice * line.quantity,
      optionSelection: line.optionSelection ?? undefined,
      taxRuleId: line.taxRuleId
    });
  }

  const subtotal = rawLines.reduce((acc, line) => acc + line.subtotal, 0);
  const quantity = rawLines.reduce((acc, line) => acc + line.quantity, 0);

  const discount = await chooseBestDiscountTx(tx, {
    currency: subscription.currency,
    subtotal,
    quantity,
    scope: "SUBSCRIPTION",
    at
  });

  const discountTotal = discount?.amount ?? 0;
  const allocations = allocateDiscount(
    rawLines.map((line) => line.subtotal),
    discountTotal
  );

  const calculatedLines = rawLines.map((line, index) =>
    calculateLineTotals({
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      taxBps: line.taxBps,
      discountAmount: allocations[index]
    })
  );

  const totals = calculateTotals(calculatedLines);
  const number = await nextSequence("invoice", "INV", tx);

  const invoice = await tx.invoice.create({
    data: {
      number,
      subscriptionId,
      customerId: subscription.customerId,
      status: InvoiceStatus.DRAFT,
      issueDate: at,
      dueDate: addDays(at, 30),
      periodStart,
      periodEnd,
      currency: subscription.currency,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      paidTotal: 0,
      balance: totals.total,
      discountRuleId: discount?.discountRuleId,
      lines: {
        create: rawLines.map((line, index) => ({
          productId: line.productId,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxAmount: calculatedLines[index].taxAmount,
          discountAmount: calculatedLines[index].discountAmount,
          total: calculatedLines[index].total,
          optionSelection: line.optionSelection,
          taxRuleId: line.taxRuleId
        }))
      }
    }
  });

  await audit(tx, actorId, "invoice", invoice.id, "draft-created", undefined, invoice);

  return { invoice, created: true };
}

export async function confirmInvoiceTx(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  actorId?: string | null
): Promise<any> {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId }
  });

  if (!invoice) {
    throw new ApiError(404, "Invoice not found");
  }

  if (invoice.status !== InvoiceStatus.DRAFT) {
    throw new ApiError(400, "Only draft invoices can be confirmed");
  }

  const updated = await tx.invoice.update({
    where: { id: invoiceId },
    data: { status: InvoiceStatus.CONFIRMED }
  });

  if (invoice.discountRuleId && invoice.discountTotal > 0) {
    await tx.discountRule.update({
      where: { id: invoice.discountRuleId },
      data: { usageCount: { increment: 1 } }
    });

    await tx.discountRedemption.create({
      data: {
        discountRuleId: invoice.discountRuleId,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        subscriptionId: invoice.subscriptionId ?? undefined,
        amount: invoice.discountTotal
      }
    });
  }

  await audit(tx, actorId, "invoice", invoice.id, "confirmed", invoice, updated);

  return updated;
}

export async function cancelInvoiceTx(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  reason: string,
  actorId?: string | null
): Promise<any> {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId }
  });

  if (!invoice) {
    throw new ApiError(404, "Invoice not found");
  }

  if (invoice.status !== InvoiceStatus.DRAFT && invoice.status !== InvoiceStatus.CONFIRMED) {
    throw new ApiError(400, "Only draft or confirmed invoices can be cancelled");
  }

  const updated = await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      status: InvoiceStatus.CANCELLED,
      notes: reason
    }
  });

  if (invoice.status === InvoiceStatus.CONFIRMED && invoice.discountRuleId && invoice.discountTotal > 0) {
    await tx.discountRule.updateMany({
      where: {
        id: invoice.discountRuleId,
        usageCount: { gt: 0 }
      },
      data: {
        usageCount: { decrement: 1 }
      }
    });
  }

  await audit(tx, actorId, "invoice", invoice.id, "cancelled", invoice, updated);

  return updated;
}