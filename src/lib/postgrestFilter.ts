/**
 * Escapes a value for safe interpolation into a PostgREST filter string —
 * the argument to `.or()`/`.filter()`. PostgREST splits that string on
 * unescaped commas and treats `,.():"\` as syntax, so a raw user-typed
 * search term containing any of those characters can inject additional
 * filter clauses (e.g. an extra `,column.op.value` the caller never
 * intended). Wrapping the value in double quotes — with `"` and `\`
 * backslash-escaped inside — makes PostgREST treat the whole thing as one
 * opaque string literal instead of parsing it.
 *
 * Use for every value built from free-text user input before it goes into
 * an `ilike`/`eq`/etc. clause inside `.or()`. Plain `.eq()`/`.ilike()`
 * calls taking a value directly (not through a template string) are
 * unaffected — the client library parameterizes those safely already.
 */
export function escapePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
