import { applyBps, sum } from "@/lib/money";
export type PricingLineInput = {
unitPrice: number;
quantity: number;
taxBps: number;
discountAmount: number;
};
export type PricingLineResult = {
subtotal: number;
discountAmount: number;
taxAmount: number;
total: number;
};
export function calculateLineTotals(line: PricingLineInput): PricingLineResult {
const subtotal = line.unitPrice * line.quantity;
const discountAmount = Math.min(line.discountAmount, subtotal);
const taxable = subtotal - discountAmount;
const taxAmount = applyBps(taxable, line.taxBps);
const total = taxable + taxAmount;
return {
subtotal,
discountAmount,
taxAmount,
total
};
}
export function calculateTotals(lines: PricingLineResult[]): {
subtotal: number;
discountTotal: number;
taxTotal: number;
total: number;
} {
const subtotal = sum(lines.map((line) => line.subtotal));
const discountTotal = sum(lines.map((line) => line.discountAmount));
const taxTotal = sum(lines.map((line) => line.taxAmount)); const total = sum(lines.map((line) => line.total));
return {
subtotal,
discountTotal,
taxTotal,
total
};
}
export function allocateDiscount(subtotals: number[], discountTotal: number): number[] {
const totalSubtotal = sum(subtotals);
if (totalSubtotal === 0 || discountTotal === 0) {
return subtotals.map(() => 0);
}
const allocations = subtotals.map((subtotal) =>
Math.floor((subtotal * discountTotal) / totalSubtotal)
);
const allocated = sum(allocations);
const remainder = discountTotal - allocated;
if (remainder > 0 && allocations.length > 0) {
allocations[0] += remainder;
}
return allocations;
}