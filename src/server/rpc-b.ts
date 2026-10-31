import { z } from "zod";
import {
  QuoteStatus,
  SubscriptionStatus,
  InvoiceStatus,
  PaymentMethod
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { requireRole, requireUser } from "@/lib/auth";
import { FINANCE_ROLES, INTERNAL_ROLES, SALES_ROLES } from "@/lib/permissions";
import { canTransition, QUOTE_TRANSITIONS, SUBSCRIPTION_TRANSITIONS } from "@/domain/state-machine";
import { nextSequence } from "@/domain/sequence";
import { createSubscriptionFromQuoteTx } from "@/domain/subscription";
import { confirmInvoiceTx, cancelInvoiceTx } from "@/domain/invoice";
import { recordPayment } from "@/domain/payment";
import { runBilling } from "@/domain/billing";
import { getFinanceSummary } from "@/domain/finance";
import { audit } from "@/lib/audit";

const createQuoteSchema = z.object({
  customerId: z.string().min(1),
  planId: z.string().min(1),
  templateId: z.string().optional().nullable(),
  validDays: z.number().int().min(1).default(30),
  paymentTerms: z.string().default("net-30"),
  currency: z.string().default("USD"),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1),
        unitPrice: z.number().int().min(0),
        taxRuleId: z.string().optional().nullable(),
        optionSelection: z.any().optional()
      })
    )
    .min(1)
});

const quoteTransitionSchema = z.object({
  id: z.string().min(1),
  to: z.nativeEnum(QuoteStatus)
});

const subscriptionTransitionSchema = z.object({
  id: z.string().min(1),
  to: z.nativeEnum(SubscriptionStatus),
  reason: z.string().optional().nullable()
});

const invoiceActionSchema = z.object({
  id: z.string().min(1),
  reason: z.string().optional().nullable()
});

const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  method: z.nativeEnum(PaymentMethod),
  amount: z.number().int().positive(),
  currency: z.string().default("USD"),
  paidAt: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  externalReference: z.string().optional().nullable()
});

const runBillingSchema = z.object({
  now: z.string().optional().nullable()
});

export async function handleRpcB(op: string, body: any): Promise<any> {
  if (op === "createQuote") {
    const user = await requireRole(SALES_ROLES);
    const input = createQuoteSchema.parse(body);
    const now = new Date();
    const validUntil = new Date(now);
    validUntil.setDate(validUntil.getDate() + input.validDays);

    const number = await nextSequence("quote", "QT");
    const total = input.lines.reduce((acc, line) => acc + line.unitPrice * line.quantity, 0);

    const quote = await prisma.quote.create({
      data: {
        number,
        customerId: input.customerId,
        planId: input.planId,
        templateId: input.templateId ?? undefined,
        status: QuoteStatus.DRAFT,
        validUntil,
        paymentTerms: input.paymentTerms,
        currency: input.currency,
        total,
        createdById: user.id,
        lines: {
          create: input.lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            optionSelection: line.optionSelection,
            taxRuleId: line.taxRuleId ?? undefined,
            amount: line.unitPrice * line.quantity
          }))
        }
      }
    });

    return { quote };
  }

  if (op === "quoteTransition") {
    const user = await requireRole(SALES_ROLES);
    const input = quoteTransitionSchema.parse(body);

    const quote = await prisma.quote.findUnique({
      where: { id: input.id }
    });

    if (!quote) {
      throw new ApiError(404, "Quote not found");
    }

    if (!canTransition(QUOTE_TRANSITIONS, quote.status, input.to)) {
      throw new ApiError(400, `Invalid quote transition from ${quote.status} to ${input.to}`);
    }

    if (input.to === QuoteStatus.CONFIRMED && quote.validUntil < new Date()) {
      throw new ApiError(400, "Quote cannot be confirmed after validUntil");
    }

    const result = await prisma.$transaction(async (tx) => {
      if (input.to === QuoteStatus.ACTIVE) {
        const subscription = await createSubscriptionFromQuoteTx(tx, quote.id, user.id);
        return { subscription };
      }

      const updated = await tx.quote.update({
        where: { id: quote.id },
        data: { status: input.to }
      });

      await audit(tx, user.id, "quote", quote.id, "transition", quote, updated);

      return { quote: updated };
    });

    return result;
  }

  if (op === "subscriptionTransition") {
    const user = await requireRole(SALES_ROLES);
    const input = subscriptionTransitionSchema.parse(body);

    const subscription = await prisma.subscription.findUnique({
      where: { id: input.id }
    });

    if (!subscription) {
      throw new ApiError(404, "Subscription not found");
    }

    if (!canTransition(SUBSCRIPTION_TRANSITIONS, subscription.status, input.to)) {
      throw new ApiError(400, `Invalid subscription transition from ${subscription.status} to ${input.to}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const data: any = { status: input.to };

      if (input.to === SubscriptionStatus.PAUSED) {
        data.pausedAt = new Date();
      }

      if (input.to === SubscriptionStatus.ACTIVE && subscription.status === SubscriptionStatus.PAUSED) {
        data.pausedAt = null;
      }

      if (input.to === SubscriptionStatus.CLOSED) {
        data.closedAt = new Date();
        data.closeReason = input.reason ?? "manual_close";
      }

      const next = await tx.subscription.update({
        where: { id: subscription.id },
        data
      });

      await audit(tx, user.id, "subscription", subscription.id, "transition", subscription, next);

      return next;
    });

    return { subscription: updated };
  }

  if (op === "invoiceConfirm") {
    const user = await requireRole(FINANCE_ROLES);
    const input = invoiceActionSchema.parse(body);

    const invoice = await prisma.$transaction((tx) =>
      confirmInvoiceTx(tx, input.id, user.id)
    );

    return { invoice };
  }

  if (op === "invoiceCancel") {
    const user = await requireRole(FINANCE_ROLES);
    const input = invoiceActionSchema.parse(body);

    const invoice = await prisma.$transaction((tx) =>
      cancelInvoiceTx(tx, input.id, input.reason ?? "manual_cancel", user.id)
    );

    return { invoice };
  }

  if (op === "recordPayment") {
    const user = await requireRole(FINANCE_ROLES);
    const input = recordPaymentSchema.parse(body);

    const result = await recordPayment(
      {
        invoiceId: input.invoiceId,
        method: input.method,
        amount: input.amount,
        currency: input.currency,
        paidAt: input.paidAt ? new Date(input.paidAt) : undefined,
        note: input.note,
        externalReference: input.externalReference
      },
      user.id
    );

    return result;
  }

  if (op === "runBilling") {
    const user = await requireRole(FINANCE_ROLES);
    const input = runBillingSchema.parse(body ?? {});
    const now = input.now ? new Date(input.now) : new Date();

    const result = await runBilling(now, user.id);

    return result;
  }

  if (op === "financeSummary") {
    await requireRole(INTERNAL_ROLES);
    const summary = await getFinanceSummary();
    return { summary };
  }

  throw new ApiError(404, "Unknown operation");
}