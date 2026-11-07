import type { ReactNode } from "react";
import { ExternalLink, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { expertiseIsEmpty, type Expertise } from "@/lib/passport/expertise";

interface PassportExpertiseProps {
  expertise: Expertise;
  /**
   * The owner's edit action, passed only on the private Passport. It opens the Passport editor, which holds the roles; the skills,
   * credentials, awards and press are read from their own records and are not edited here.
   */
  onEditRoles?: () => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:pt-1">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  );
}

/**
 * Expertise, set out the way a CV does: roles, skills, interests, credentials, awards and where the work was featured, each a row with its
 * label on the left. One section instead of a skills strip, a credentials list and a separate Featured In / Awards band; a row with
 * nothing in it is not drawn, and with nothing at all a visitor sees no section (the owner sees what to add).
 */
export function PassportExpertise({ expertise, onEditRoles }: PassportExpertiseProps) {
  const empty = expertiseIsEmpty(expertise);
  if (empty && !onEditRoles) return null;

  return (
    <section aria-labelledby="passport-expertise" className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 id="passport-expertise" className="text-xs font-semibold uppercase text-muted-foreground">
          Expertise
        </h3>
        {onEditRoles && (
          <Button type="button" variant="ghost" size="sm" onClick={onEditRoles} className="h-7 gap-1.5 px-2 text-xs">
            <Pencil className="h-3 w-3" aria-hidden />
            Edit roles
          </Button>
        )}
      </div>

      {empty ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
          No roles, skills or recognition on your Passport yet. Add your roles so people know what to hire you for.
        </p>
      ) : (
        <dl className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card/40 px-4">
          {expertise.roles.length > 0 && <Row label="Roles">{expertise.roles.join(" · ")}</Row>}
          {expertise.skills.length > 0 && (
            <Row label="Skills">
              <ul className="flex flex-wrap gap-1.5" aria-label="Skills">
                {expertise.skills.map((skill) => (
                  <li key={skill}>
                    <Badge variant="secondary">{skill}</Badge>
                  </li>
                ))}
              </ul>
            </Row>
          )}
          {expertise.interests.length > 0 && <Row label="Interests">{expertise.interests.join(" · ")}</Row>}
          {expertise.credentials.length > 0 && (
            <Row label="Credentials">
              <ul className="space-y-1.5">
                {expertise.credentials.map((c) => (
                  <li key={c.id} className="break-words">
                    {c.value && <span className="font-semibold text-energy">{c.value} </span>}
                    <span className="font-medium">{c.title}</span>
                    {c.issuer && <span className="text-muted-foreground"> · {c.issuer}</span>}
                  </li>
                ))}
              </ul>
            </Row>
          )}
          {expertise.awards.length > 0 && (
            <Row label="Awards">
              <ul className="space-y-1.5">
                {expertise.awards.map((a) => (
                  <li key={a.id} className="break-words">
                    <span className="font-medium">{a.title}</span>
                    {(a.organization || a.year) && (
                      <span className="text-muted-foreground"> · {[a.organization, a.year].filter(Boolean).join(", ")}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Row>
          )}
          {expertise.featuredIn.length > 0 && (
            <Row label="Featured in">
              <ul className="space-y-1.5">
                {expertise.featuredIn.map((p) => (
                  <li key={p.id} className="break-words">
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-baseline gap-1 font-medium hover:underline">
                      {p.title}
                      <ExternalLink className="h-3 w-3 shrink-0 self-center text-muted-foreground" aria-hidden />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                    {p.publication && <span className="text-muted-foreground"> · {p.publication}</span>}
                  </li>
                ))}
              </ul>
            </Row>
          )}
        </dl>
      )}
    </section>
  );
}

export default PassportExpertise;
