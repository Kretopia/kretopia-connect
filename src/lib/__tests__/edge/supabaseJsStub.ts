// Stand-in target for the `npm:@supabase/supabase-js@...` alias in
// vitest.config.ts. Edge-function tests replace it with vi.mock().
export const createClient = () => {
  throw new Error("supabase-js is stubbed in tests; mock it with vi.mock()");
};
