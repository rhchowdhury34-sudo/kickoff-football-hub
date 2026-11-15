# KickOff Football Hub — Live API update

This version connects the PWA frontend to the Cloudflare Worker backend:

`https://kickoff-api.callguard-shield.workers.dev`

## Included API routes
- `/api/health`
- `/api/live`
- `/api/fixtures?next=10`
- `/api/fixtures?last=10`
- `/api/standings?league=39&season=2026`

The API-Football key must remain stored as a Cloudflare Worker Secret named `API_FOOTBALL_KEY`. Never put the key in this repository or frontend JavaScript.

## Deploy on GitHub Pages
1. Extract this ZIP.
2. Upload the contents (not the containing folder) to the root of the existing `kickoff-football-hub` repository.
3. Commit changes to the `main` branch.
4. Wait for GitHub Pages to publish, then refresh the site. If the old app remains, clear the site cache or close/reopen the installed PWA.

## Notes
- Live scores, upcoming fixtures, recent results and standings are fetched from API-Football through the Worker.
- Provider coverage and request limits depend on the API plan.
- News is still a placeholder; a news provider has not been connected.
- Standings use the current calendar year as the season parameter; some leagues may use a different season or may not be available on the selected API plan.
