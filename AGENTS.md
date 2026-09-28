<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep `desk-agent-watch` disabled while the production legacy backend is active, because that optional function cannot resolve current Studio project IDs.
- Keep Studio project cards in one scrollable, keyboard-accessible row with all filtered results mounted, because a capped grid hides projects and creates excessive page height.
- Keep Passport's action, trust and record in one compact overview, and read Reach only from connected-platform syncs, because separate panels and stale profile counters misrepresent the creator's status.
- Reuse the shared KretopiaQRCode for Passport QR previews and exports, because one branded generator preserves the same scannable code across surfaces.
- Keep Today focused on one combined Passport/Kreto card and a real next action; deeper Passport metrics belong in Passport, because duplicate dashboards obscure the creator's priority.
