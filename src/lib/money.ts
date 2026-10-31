export function add(amountA: number, amountB: number): number {
return amountA + amountB;
}
export function multiply(unitAmount: number, quantity: number): number {
return unitAmount * quantity;
}
export function applyBps(amount: number, bps: number): number {
return Math.round((amount * bps) / 10000);
}
export function sum(amounts: number[]): number {
return amounts.reduce((acc, amount) => acc + amount, 0);
}