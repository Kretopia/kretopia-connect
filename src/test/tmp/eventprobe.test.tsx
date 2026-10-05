import { render } from "@testing-library/react";
import { vi, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
vi.mock("@/integrations/supabase/client", () => {
  const q: any = new Proxy(function(){}, { get: (_t, p) => p === "then" ? (r: any) => r({ data: [], error: null, count: 0 }) : () => q, apply: () => q });
  return { supabase: new Proxy({}, { get: (_t, p) => p === "auth" ? { getUser: async () => ({ data: { user: null } }), getSession: async()=>({data:{session:null}}), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } : p === "channel" ? () => { const c: any = { on: () => c, subscribe: () => c, unsubscribe(){} }; return c; } : p==="removeChannel"? ()=>{} : () => q }) };
});
const mods = import.meta.glob("@/components/project/studio/Event*.tsx", { eager: true });
const project: any = { id: "p1", title: "T", workspace_type: "event", owner_id: "u1", metadata: null, event_date: null };
for (const [path, m] of Object.entries(mods)) {
  for (const [name, C] of Object.entries(m as any)) {
    if (typeof C !== "function" || !/^Event/.test(name)) continue;
    it(path + " " + name, async () => {
      render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><C project={project} currentUserId="u1" kind="supplier" projectId="p1" /></MemoryRouter></QueryClientProvider>);
      await new Promise(r => setTimeout(r, 300));
    });
  }
}
