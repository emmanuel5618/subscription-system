
import {
  QuoteStatus,
  SubscriptionStatus,
  InvoiceStatus,
  PaymentStatus
} from "@prisma/client";

export const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  [QuoteStatus.DRAFT]: [QuoteStatus.QUOTATION, QuoteStatus.CLOSED],
  [QuoteStatus.QUOTATION]: [QuoteStatus.CONFIRMED, QuoteStatus.CLOSED],
  [QuoteStatus.CONFIRMED]: [QuoteStatus.ACTIVE, QuoteStatus.CLOSED],
  [QuoteStatus.ACTIVE]: [QuoteStatus.CLOSED],
  [QuoteStatus.CLOSED]: []
};

export const SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  [SubscriptionStatus.DRAFT]: [SubscriptionStatus.CONFIRMED, SubscriptionStatus.CLOSED],
  [SubscriptionStatus.CONFIRMED]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CLOSED],
  [SubscriptionStatus.ACTIVE]: [SubscriptionStatus.PAUSED, SubscriptionStatus.CLOSED],
  [SubscriptionStatus.PAUSED]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CLOSED],
  [SubscriptionStatus.CLOSED]: []
};

export const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.CONFIRMED, InvoiceStatus.CANCELLED],
  [InvoiceStatus.CONFIRMED]: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
  [InvoiceStatus.PAID]: [],
  [InvoiceStatus.CANCELLED]: []
};

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [PaymentStatus.COMPLETED, PaymentStatus.FAILED],
  [PaymentStatus.COMPLETED]: [PaymentStatus.REFUNDED],
  [PaymentStatus.FAILED]: [],
  [PaymentStatus.REFUNDED]: []
};

export function canTransition<T extends string>(
  machine: Record<T, T[]>,
  from: T,
  to: T
): boolean {
  return machine[from]?.includes(to) ?? false;
}
