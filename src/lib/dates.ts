import { addDays, addWeeks, addMonths, addYears, startOfMonth, endOfMonth } from "date-fns";
import { BillingInterval } from "@prisma/client";
export function addBillingInterval(
date: Date,
interval: BillingInterval,
count: number
): Date {
switch (interval) {
case BillingInterval.DAILY:
return addDays(date, count);
case BillingInterval.WEEKLY:
return addWeeks(date, count);
case BillingInterval.MONTHLY:
return addMonths(date, count);
case BillingInterval.YEARLY:
return addYears(date, count);
default:
return addMonths(date, count);
}
}
export function getStartOfMonth(date: Date): Date {
return startOfMonth(date);
}
export function getEndOfMonth(date: Date): Date {
return endOfMonth(date);
}