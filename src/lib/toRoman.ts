const ROMAN_MAP: [number, string][] = [
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

/** Small-number roman numeral formatter — landing chapters never exceed single digits. */
export function toRoman(n: number): string {
  if (n <= 0) return "";
  let remaining = n;
  let out = "";
  for (const [value, symbol] of ROMAN_MAP) {
    while (remaining >= value) {
      out += symbol;
      remaining -= value;
    }
  }
  return out;
}
