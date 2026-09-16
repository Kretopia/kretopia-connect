---
name: EP Design Engine Phase 1
description: Thrive doc engine upgraded from writing-only to presentation-quality. Design styles, rich layouts, image library, self-scored quality grade.
type: feature
---

**Engine** `supabase/functions/thrive-document-engine/index.ts`
- Pipeline: Brief → Content Strategy → Brand → Audience → Visual Direction → Layout Selection → Image Selection → Render → Self-Critique (all in one tool call w/ structured output).
- `design_style` enum: startup / luxury / creative / editorial / hospitality / corporate / investor. Each maps to baseline theme + voice + visual direction. Auto-inferred from brief+audience when caller omits.
- Image library assembled server-side from brand logo + projects.moodboard + project_files (images/link thumbnails). Passed in ctx as `image_library`. EP instructed to PREFER `image_ref` (real URL) over `image_prompt`.
- New tool-schema fields on slide: `image_ref`, `team`, `timeline`, `process`, `financial{columns,rows,summary}`, `chart{type:bar|donut|line,data,caption}`, `gallery[{image_ref,caption}]`. Quote extended with `role`+`avatar_url` for testimonials.
- Doc-level: `strategy_summary`, `design_style`, `cover_image_ref`, `design_quality{visual_hierarchy,storytelling,brand_alignment,image_use,overall,notes}` (1-10 self-score, honest).

**Renderer** `src/components/thrive/DeckRenderer.tsx`
- New layouts: hero (now supports image_ref), pull_quote, testimonial (avatar), team (avatar grid w/ initials fallback), timeline (vertical accent rail), process (numbered cards), financial (table), chart (zero-dep SVG bar/donut/line), gallery (image_ref grid).
- `<DesignQualityBadge>` rendered above deck (data-export-hidden so PDF/share strips it). Grade A+/A/B/C/D from overall score.
- standard layout now also honours `image_ref`.

**Target**: Gamma / Beautiful.ai / Canva Magic Design quality without manual design work. Success metric: "Would the user send this immediately?"
