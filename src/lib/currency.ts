export function formatCurrencyAmount(amount: number, currency?: string | null) {
  const code = currency?.trim().toUpperCase();
  if (!Number.isFinite(amount) || !code || !/^[A-Z]{3}$/.test(code)) return null;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(amount);
  } catch {
    return null;
  }
}
