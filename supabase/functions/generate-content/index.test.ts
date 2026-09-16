import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
// A real user JWT (e.g. the access_token from a signInWithPassword call
// against a dedicated test account), not the public anon key. Optional --
// the happy-path test below is skipped without it, since this repo has no
// existing convention for provisioning one in CI yet.
const TEST_USER_JWT = Deno.env.get("TEST_USER_JWT");

// generate-content previously had no auth check at all: the platform's
// verify_jwt=true default is trivially satisfied by the public anon key
// shipped in the frontend bundle, so every test below originally sent
// `Authorization: Bearer ${SUPABASE_ANON_KEY}` and asserted 200 -- that
// was asserting the vulnerability (an unauthenticated open relay to a
// paid LLM gateway) was working as designed. Fixed in index.ts to require
// a real user session; these tests now assert the corrected behavior.

Deno.test("generate-content: rejects requests with no Authorization header", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-content`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
    body: JSON.stringify({ type: "text", prompt: "Say hello in one word" }),
  });
  assertEquals(response.status, 401);
  await response.body?.cancel();
});

Deno.test("generate-content: rejects the public anon key as a caller identity", async () => {
  // The anon key is a valid apikey but is not a user session -- it carries
  // no `sub` claim, so getClaims() must not treat it as an authenticated user.
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-content`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ type: "text", prompt: "Say hello in one word" }),
  });
  assertEquals(response.status, 401);
  await response.body?.cancel();
});

Deno.test({
  name: "generate-content: returns 200 with valid prompt for a real authenticated user",
  ignore: !TEST_USER_JWT,
  fn: async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-content`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${TEST_USER_JWT}`,
      },
      body: JSON.stringify({ type: "text", prompt: "Say hello in one word" }),
    });

    const body = await response.json();
    assertEquals(response.status, 200);
    assertExists(body.content);
  },
});

Deno.test({
  name: "generate-content: handles empty prompt gracefully for a real authenticated user",
  ignore: !TEST_USER_JWT,
  fn: async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-content`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${TEST_USER_JWT}`,
      },
      body: JSON.stringify({ type: "text", prompt: "" }),
    });

    const body = await response.json();
    assertEquals(response.status, 200);
    assertExists(body.content); // Should return fallback content
  },
});

Deno.test("generate-content: CORS preflight returns 200 (unauthenticated, unaffected by the auth check)", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-content`, {
    method: "OPTIONS",
    headers: {
      "Origin": "https://example.com",
      "Access-Control-Request-Method": "POST",
    },
  });

  await response.text(); // consume body
  assertEquals(response.status, 200);
});
