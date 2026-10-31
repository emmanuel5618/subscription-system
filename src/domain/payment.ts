import { Prisma, InvoiceStatus, PaymentStatus } from "@prisma/client";
import { audit } from "@/lib/audit";
import { ApiError } from "@/lib/api-error";

export type RecordPaymentInput = {
  invoiceId: string;
  method: any;
  amount: number;
  currency: string;
  paidAt?: Date;
  note?: string | null;
  externalReference?: string | null;
};

export async function recordPaymentTx(
  tx: Prisma.TransactionClient,
  input: RecordPaymentInput,
  actorId?: string | null
): Promise<any> {
  const invoice = await tx.invoice.findUnique({
    where: { id: input.invoiceId }
  });

  if (!invoice) {
    throw new ApiError(404, "Invoice not found");
  }

  if (invoice.status === InvoiceStatus.CANCELLED) {
    throw new ApiError(400, "Cannot pay a cancelled invoice");
  }

  if (invoice.status === InvoiceStatus.DRAFT) {
    throw new ApiError(400, "Confirm invoice before recording payment");
  }

  const payment = await tx.payment.create({
    data: {
      method: input.method,
      amount: input.amount,
      currency: input.currency,
      paidAt: input.paidAt ?? new Date(),
      note: input.note,
      externalReference: input.externalReference,
      status: PaymentStatus.COMPLETED,
      recordedById: actorId ?? undefined
    }
  });

  await tx.paymentAllocation.create({
    data: {
      paymentId: payment.id,
      invoiceId: invoice.id,
      amount: input.amount
    }
  });

  const paidTotal = invoice.paidTotal + input.amount;
  const balance = invoice.total - paidTotal;
  const status = paidTotal >= invoice.total ? InvoiceStatus.PAID : invoice.status;

  const updatedInvoice = await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      paidTotal,
      balance,
      status
    }
  });

  await audit(tx, actorId, "payment", payment.id, "recorded", invoice, updatedInvoice);

  return {
    payment,
    invoice: updatedInvoice
  };
}

export async function recordPayment(input: RecordPaymentInput, actorId?: string | null) {
  return prisma.$transaction(async (tx) => recordPaymentTx(tx, input, actorId));
}

import { prisma } from "@/lib/prisma";