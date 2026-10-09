import { describe, expect, it } from "vitest";
import { explainCreditError } from "../creditErrors";

describe("explainCreditError", () => {
  it("turns the unique-index refusal into 'you already have this', not a retry", () => {
    for (const err of [
      { code: "23505", message: 'duplicate key value violates unique constraint "credits_dedup_idx"' },
      { message: "duplicate key value violates unique constraint" },
    ]) {
      const r = explainCreditError(err);
      expect(r.duplicate).toBe(true);
      expect(r.retryable).toBe(false);
      expect(r.message).toMatch(/already have this credit/);
      expect(r.message).not.toMatch(/constraint|credits_dedup_idx|duplicate key/i); // no internals
    }
  });

  it("says what to do when the session expired or the network dropped, and that the input is kept", () => {
    expect(explainCreditError({ message: "JWT expired" })).toMatchObject({ retryable: true, duplicate: false });
    expect(explainCreditError({ message: "JWT expired" }).message).toMatch(/Sign in again/);
    expect(explainCreditError(new Error("Not authenticated")).message).toMatch(/Sign in again/);
    expect(explainCreditError(new TypeError("Failed to fetch")).message).toMatch(/No connection/);
  });

  it("explains a permission refusal without leaking policy names", () => {
    const r = explainCreditError({ code: "42501", message: 'new row violates row-level security policy for table "credits"' });
    expect(r).toMatchObject({ duplicate: false, retryable: false });
    expect(r.message).not.toMatch(/row-level|policy|credits"/i);
  });

  it("never throws and never echoes an unknown raw message", () => {
    for (const weird of [undefined, null, "boom", 42, {}]) {
      const r = explainCreditError(weird);
      expect(r.retryable).toBe(true);
      expect(r.message).toMatch(/could not be added/);
    }
    expect(explainCreditError({ message: "relation public.secret_table does not exist" }).message).not.toMatch(/secret_table/);
  });
});
