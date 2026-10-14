import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GET_PAID_MESSAGE_MAX,
  GET_PAID_NAME_MAX,
  decideGetPaidLink,
} from "../../../supabase/functions/_shared/getPaidLink";
import {
  cleanFreeText,
  cleanRecipientEmail,
  escapeHtmlText,
  singleLine,
} from "../../../supabase/functions/_shared/outboundText";
import {
  GUEST_VERIFICATIONS_PER_EMAIL_PER_HOUR,
  decideGuestVerificationSend,
} from "../../../supabase/functions/_shared/guestVerification";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const money = { ok: true as const, canSeeMoney: true };

describe("decideGetPaidLink: who may email a get-paid link", () => {
  const base = { projectId: PROJECT, recipientEmail: "payee@example.com", access: money };

  it("allows a caller with money access on the project", () => {
    expect(decideGetPaidLink(base)).toEqual({ ok: true, recipientEmail: "payee@example.com" });
  });

  it("normalises the recipient address", () => {
    expect(decideGetPaidLink({ ...base, recipientEmail: "  Payee@Example.COM " })).toEqual({
      ok: true,
      recipientEmail: "payee@example.com",
    });
  });

  it("refuses an accepted client or guest, who do not see the money", () => {
    expect(decideGetPaidLink({ ...base, access: { ok: true, canSeeMoney: false } }))
      .toMatchObject({ ok: false, status: 403 });
  });

  it("refuses a caller with no access to the project (unrelated, pending, unknown project)", () => {
    expect(decideGetPaidLink({ ...base, access: { ok: false, status: 403 } })).toMatchObject({ ok: false, status: 403 });
  });

  it("answers 503 and sends nothing when the access lookup failed", () => {
    expect(decideGetPaidLink({ ...base, access: { ok: false, status: 503 } })).toMatchObject({ ok: false, status: 503 });
  });

  it("answers 401 for an unauthenticated lookup", () => {
    expect(decideGetPaidLink({ ...base, access: { ok: false, status: 401 } })).toMatchObject({ ok: false, status: 401 });
  });

  it("refuses a missing or malformed project id: the old call accepted none", () => {
    for (const projectId of [undefined, null, "", "not-a-uuid", 42]) {
      expect(decideGetPaidLink({ ...base, projectId })).toMatchObject({ ok: false, status: 400 });
    }
  });

  it("refuses anything that is not one plain address", () => {
    for (const e of [
      "",
      "no-at-sign",
      "a@b",
      "a@b.com, c@d.com",
      "a@b.com;c@d.com",
      "<script>@x.com",
      "a b@c.com",
      "a@b.com\r\nBcc: victim@x.com",
      `${"a".repeat(250)}@x.com`,
      null,
      undefined,
      ["a@b.com"],
    ]) {
      expect(cleanRecipientEmail(e)).toBeNull();
      expect(decideGetPaidLink({ ...base, recipientEmail: e })).toMatchObject({ ok: false, status: 400 });
    }
  });
});

describe("text that goes into the email", () => {
  it("escapes markup so a message cannot add its own HTML or links", () => {
    expect(escapeHtmlText('<a href="https://evil.example">Pay here</a>')).toBe(
      "&lt;a href=&quot;https://evil.example&quot;&gt;Pay here&lt;/a&gt;",
    );
    expect(escapeHtmlText("Tom & Jerry's")).toBe("Tom &amp; Jerry&#039;s");
  });

  it("removes control characters and clips to the limit", () => {
    expect(cleanFreeText("a\u0000b\u0007c", 10)).toBe("abc");
    expect(cleanFreeText("x".repeat(GET_PAID_MESSAGE_MAX + 50), GET_PAID_MESSAGE_MAX)).toHaveLength(GET_PAID_MESSAGE_MAX);
    expect(cleanFreeText("y".repeat(200), GET_PAID_NAME_MAX)).toHaveLength(GET_PAID_NAME_MAX);
  });

  it("returns null for empty or non-string text", () => {
    for (const v of ["", "   ", null, undefined, 5, {}]) expect(cleanFreeText(v, 10)).toBeNull();
  });
});

describe("singleLine", () => {
  it("removes line breaks so a value cannot split a header, and clips", () => {
    expect(singleLine("Hello\r\nBcc: victim@x.com", 100)).toBe("Hello Bcc: victim@x.com");
    expect(singleLine("x".repeat(500), 80)).toHaveLength(80);
    expect(singleLine(null, 10)).toBe("");
  });
});

describe("decideGuestVerificationSend: a public form is not a mail relay", () => {
  it("allows the first mails for an address", () => {
    expect(decideGuestVerificationSend({ email: "Guest@Example.com", recentCount: 0 }))
      .toEqual({ ok: true, email: "guest@example.com" });
    expect(decideGuestVerificationSend({ email: "guest@example.com", recentCount: GUEST_VERIFICATIONS_PER_EMAIL_PER_HOUR - 1 }))
      .toMatchObject({ ok: true });
  });

  it("refuses with 429 once the hourly cap for that address is reached", () => {
    expect(decideGuestVerificationSend({ email: "guest@example.com", recentCount: GUEST_VERIFICATIONS_PER_EMAIL_PER_HOUR }))
      .toMatchObject({ ok: false, status: 429 });
  });

  it("refuses anything that is not one plain address", () => {
    for (const e of [undefined, "", "x", "a@b.com,c@d.com", "<x>@y.com"]) {
      expect(decideGuestVerificationSend({ email: e, recentCount: 0 })).toMatchObject({ ok: false, status: 400 });
    }
  });

  it("answers 503 and sends nothing when the count failed: unknown is not zero", () => {
    expect(decideGuestVerificationSend({ email: "guest@example.com", recentCount: null }))
      .toMatchObject({ ok: false, status: 503 });
  });
});

describe("outbound senders: wiring", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../../../supabase/functions", p), "utf8");

  for (const fn of ["send-activity-digest", "send-streak-warning", "send-reengagement"]) {
    it(`${fn} requires cron or admin before it reads or sends anything`, () => {
      const source = read(`${fn}/index.ts`);
      const guard = source.indexOf("requireAdminOrCron(req)");
      expect(guard).toBeGreaterThan(-1);
      expect(guard).toBeLessThan(source.indexOf(".from("));
      expect(source).not.toContain("No auth check needed");
    });
  }

  it("send-get-paid-link decides before it notifies or sends, and from the database title", () => {
    const source = read("send-get-paid-link/index.ts");
    const decision = source.indexOf("decideGetPaidLink({");
    expect(decision).toBeGreaterThan(-1);
    expect(decision).toBeLessThan(source.indexOf(".from('notifications')"));
    expect(decision).toBeLessThan(source.indexOf("resend.emails.send("));
    expect(source).toContain("requireProjectAccess(supabaseAdmin, projectId, user.id)");
    expect(source).not.toMatch(/projectTitle\s*\}\s*=\s*await req\.json/);
  });

  it("send-get-paid-link escapes every value it puts into the HTML", () => {
    const source = read("send-get-paid-link/index.ts");
    expect(source).not.toMatch(/\$\{(message|recipientName)\}/);
    expect(source).not.toContain("<strong>${senderName}</strong>");
    expect(source).toContain("escapeHtmlText(message)");
    expect(source).toContain("escapeHtmlText(recipientName)");
    expect(source).toContain("escapeHtmlText(projectTitle)");
    expect(source).toContain("escapeHtmlText(senderName)");
  });

  it("verify-guest-opportunity caps and validates before it stores or sends, and escapes the mail", () => {
    const source = read("verify-guest-opportunity/index.ts");
    const decision = source.indexOf("decideGuestVerificationSend({");
    expect(decision).toBeGreaterThan(-1);
    expect(decision).toBeLessThan(source.indexOf('.from("opportunities")\n        .insert('));
    expect(decision).toBeLessThan(source.indexOf("https://api.resend.com/emails"));
    expect(source).toContain("to: [guestEmail]");
    expect(source).toContain("escapeHtmlText(company_name)");
    expect(source).toContain("escapeHtmlText(title)");
    expect(source).not.toContain("to: [email]");
  });
});
