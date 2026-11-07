import { CartTotals } from "./types";

export function calculateCartTotals(
  lines: Array<{ price: number; quantity: number }>
): CartTotals {
  let subtotal = 0;
  let itemCount = 0;

  for (const line of lines) {
    const lineTotal = Math.round(line.price * line.quantity * 100) / 100;
    subtotal += lineTotal;
    itemCount += line.quantity;
  }

  subtotal = Math.round(subtotal * 100) / 100;
  const taxTotal = Math.round(subtotal * 0.08 * 100) / 100;
  const grandTotal = Math.round((subtotal + taxTotal) * 100) / 100;

  return {
    subtotal,
    taxTotal,
    grandTotal,
    itemCount,
  };
}
