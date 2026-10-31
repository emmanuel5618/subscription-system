import { z } from "zod";
import {
Role,
ProductType,
BillingInterval,
QuoteStatus,
SubscriptionStatus,
InvoiceStatus,
PaymentMethod,
PaymentStatus,
DiscountType,
DiscountScope
} from "@prisma/client";
import { INTERNAL_ROLES, ADMIN_ONLY, FINANCE_ROLES, SALES_ROLES } from "@/lib/permissions";
const s = z.string().min(1);
const os = z.string().optional().nullable();
const i = z.number().int();
const oi = z.number().int().optional().nullable();
const json = z.any().optional();
const d = z.preprocess((value) => {
if (value === null || value === undefined || value === "") {
return null;
}
const date = new Date(value as string);
return Number.isNaN(date.getTime()) ? null : date;
}, z.date().nullable().optional());
const email = z
.string()
.email()
.transform((value) => value.trim().toLowerCase());
const customerCreate = z.object({
userId: os,
name: s,
email, billingAddress: os,
taxInfo: os,
notes: os
});
const productCreate = z.object({
name: s,
type: z.nativeEnum(ProductType),
salesPrice: i.min(0),
costPrice: i.min(0),
notes: os,
availableFrom: d,
availableUntil: d,
active: z.boolean().default(true)
});
const productOptionCreate = z.object({
productId: s,
name: s
});
const productOptionValueCreate = z.object({
optionId: s,
value: s,
priceDelta: i.default(0),
costDelta: i.default(0)
});
const planCreate = z.object({
name: s,
description: os,
billingInterval: z.nativeEnum(BillingInterval),
billingIntervalCount: i.min(1).default(1),
minimumQuantity: i.min(1).default(1),
currency: s.default("USD"),
availableFrom: d,
availableUntil: d,
autoCloseOnEnd: z.boolean().default(false),
allowPause: z.boolean().default(true),
allowEarlyClose: z.boolean().default(true),
allowRenewal: z.boolean().default(true),
active: z.boolean().default(true)
}); const planLineCreate = z.object({
planId: s,
productId: s,
quantity: i.min(1),
unitPriceOverride: oi,
optionSelection: json
});
const quoteTemplateCreate = z.object({
name: s,
validityDays: i.min(1).default(30),
paymentTerms: s.default("net-30"),
active: z.boolean().default(true)
});
const quoteTemplateLineCreate = z.object({
templateId: s,
productId: s,
quantity: i.min(1),
unitPrice: oi
});
const quoteCreate = z.object({
customerId: s,
templateId: os,
planId: os,
status: z.nativeEnum(QuoteStatus).default(QuoteStatus.DRAFT),
validUntil: d,
paymentTerms: s.default("net-30"),
currency: s.default("USD"),
total: i.default(0),
createdById: os
});
const quoteLineCreate = z.object({
quoteId: s,
productId: s,
quantity: i.min(1),
unitPrice: i.min(0),
optionSelection: json,
taxRuleId: os,
amount: i.default(0) });
const subscriptionCreate = z.object({
customerId: s,
planId: s,
quoteId: os,
status: z.nativeEnum(SubscriptionStatus).default(SubscriptionStatus.DRAFT),
startDate: d,
expiryDate: d,
paymentTerms: s.default("net-30"),
currency: s.default("USD"),
nextBillingAt: d
});
const subscriptionLineCreate = z.object({
subscriptionId: s,
productId: s,
quantity: i.min(1),
unitPrice: i.min(0),
optionSelection: json,
taxRuleId: os
});
const taxRuleCreate = z.object({
name: s,
rateBps: i.min(0),
productScope: os,
regionScope: os,
priority: i.default(0),
active: z.boolean().default(true),
validFrom: d,
validTo: d,
inclusive: z.boolean().default(false)
});
const discountRuleCreate = z.object({
name: s,
type: z.nativeEnum(DiscountType),
value: i.min(0),
minimumPurchase: oi,
minimumQuantity: oi,
startsAt: d,
endsAt: d, usageLimit: oi,
usageCount: i.default(0),
scope: z.nativeEnum(DiscountScope).default(DiscountScope.SUBSCRIPTION),
active: z.boolean().default(true),
priority: i.default(0)
});
const invoiceCreate = z.object({
subscriptionId: os,
customerId: s,
status: z.nativeEnum(InvoiceStatus).default(InvoiceStatus.DRAFT),
issueDate: d,
dueDate: d,
periodStart: d,
periodEnd: d,
currency: s.default("USD"),
subtotal: i.default(0),
discountTotal: i.default(0),
taxTotal: i.default(0),
total: i.default(0),
paidTotal: i.default(0),
balance: i.default(0),
discountRuleId: os,
notes: os
});
const invoiceLineCreate = z.object({
invoiceId: s,
productId: s,
description: s,
quantity: i.min(1),
unitPrice: i.min(0),
taxAmount: i.default(0),
discountAmount: i.default(0),
total: i.default(0),
optionSelection: json,
taxRuleId: os
});
const paymentCreate = z.object({
method: z.nativeEnum(PaymentMethod),
amount: i.min(0),
currency: s.default("USD"), paidAt: d,
note: os,
externalReference: os,
status: z.nativeEnum(PaymentStatus).default(PaymentStatus.COMPLETED),
recordedById: os
});
const paymentAllocationCreate = z.object({
paymentId: s,
invoiceId: s,
amount: i.min(0)
});
export type ModuleConfig = {
table: string;
read: Role[];
write: Role[];
create: z.ZodObject<any>;
update: z.ZodObject<any>;
};
export const moduleRegistry: Record<string, ModuleConfig> = {
customers: {
table: "customer",
read: INTERNAL_ROLES,
write: SALES_ROLES,
create: customerCreate,
update: customerCreate.partial()
},
products: {
table: "product",
read: INTERNAL_ROLES,
write: ADMIN_ONLY,
create: productCreate,
update: productCreate.partial()
},
productOptions: {
table: "productOption",
read: INTERNAL_ROLES,
write: ADMIN_ONLY,
create: productOptionCreate,
update: productOptionCreate.partial()
}, productOptionValues: {
table: "productOptionValue",
read: INTERNAL_ROLES,
write: ADMIN_ONLY,
create: productOptionValueCreate,
update: productOptionValueCreate.partial()
},
plans: {
table: "plan",
read: INTERNAL_ROLES,
write: ADMIN_ONLY,
create: planCreate,
update: planCreate.partial()
},
planLines: {
table: "planLine",
read: INTERNAL_ROLES,
write: ADMIN_ONLY,
create: planLineCreate,
update: planLineCreate.partial()
},
quoteTemplates: {
table: "quoteTemplate",
read: INTERNAL_ROLES,
write: SALES_ROLES,
create: quoteTemplateCreate,
update: quoteTemplateCreate.partial()
},
quoteTemplateLines: {
table: "quoteTemplateLine",
read: INTERNAL_ROLES,
write: SALES_ROLES,
create: quoteTemplateLineCreate,
update: quoteTemplateLineCreate.partial()
},
quotes: {
table: "quote",
read: INTERNAL_ROLES,
write: SALES_ROLES,
create: quoteCreate,
update: quoteCreate.partial()
},
quoteLines: { table: "quoteLine",
read: INTERNAL_ROLES,
write: SALES_ROLES,
create: quoteLineCreate,
update: quoteLineCreate.partial()
},
subscriptions: {
table: "subscription",
read: INTERNAL_ROLES,
write: ADMIN_ONLY,
create: subscriptionCreate,
update: subscriptionCreate.partial()
},
subscriptionLines: {
table: "subscriptionLine",
read: INTERNAL_ROLES,
write: ADMIN_ONLY,
create: subscriptionLineCreate,
update: subscriptionLineCreate.partial()
},
taxRules: {
table: "taxRule",
read: INTERNAL_ROLES,
write: ADMIN_ONLY,
create: taxRuleCreate,
update: taxRuleCreate.partial()
},
discountRules: {
table: "discountRule",
read: [...INTERNAL_ROLES],
write: ADMIN_ONLY,
create: discountRuleCreate,
update: discountRuleCreate.partial()
},
invoices: {
table: "invoice",
read: INTERNAL_ROLES,
write: FINANCE_ROLES,
create: invoiceCreate,
update: invoiceCreate.partial()
},
invoiceLines: {
table: "invoiceLine", read: INTERNAL_ROLES,
write: FINANCE_ROLES,
create: invoiceLineCreate,
update: invoiceLineCreate.partial()
},
payments: {
table: "payment",
read: INTERNAL_ROLES,
write: FINANCE_ROLES,
create: paymentCreate,
update: paymentCreate.partial()
},
paymentAllocations: {
table: "paymentAllocation",
read: INTERNAL_ROLES,
write: FINANCE_ROLES,
create: paymentAllocationCreate,
update: paymentAllocationCreate.partial()
},
auditLogs: {
table: "auditLog",
read: ADMIN_ONLY,
write: ADMIN_ONLY,
create: z.object({}),
update: z.object({})
}
};