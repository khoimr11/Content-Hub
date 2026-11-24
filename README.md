# Content Hub · Lignarc (Global) & Living Furniture (Local)

Marketing, social and seeding hub. Live: https://khoimr11.github.io/Content-Hub/

- **Login** with your Dashboard Global (Lignarc) or Dashboard Local (Living Furniture) account. The hub decrypts the dashboards in the browser so the COO engine can read CastleGate free-storage days, inventory, 30-day sales and the monthly KPI.
- **Global posts are in English, Local posts are in Vietnamese.**
- **“Đã đăng” (Posted)** writes `data/state.json` through the GitHub API. Each device needs a fine-grained token for this repo with *Contents: Read and write* (Settings ⚙︎ in the hub).

## Files
| Path | What |
|---|---|
| `data/hub.json` | Agents, posts, calendar to 31/12/2027, Gemini Studio briefs, seeding directory |
| `data/state.json` | Posted / approvals / uploads (written by the hub) |
| `media/g`, `media/l`, `media/v` | New creatives (Global, Local, video) |
| `media/ref` | Product reference images for Gemini |
| `media/up` | Files uploaded from the hub |
| `scripts/agents.mjs` + `.github/workflows/agents.yml` | Daily agent run (06:13 VN) |

## Zero extra cost
- GitHub Pages + Actions are free for public repos.
- Agents use the **Gemini API free tier** (text models only). Create the key at https://aistudio.google.com/apikey in a project **without billing**, then add it as repo secret `GEMINI_API_KEY`. Free-tier prompts may be used by Google to improve its products.
- Photoreal lifestyle images/videos are made in the **Gemini app (Pro plan)** from the Studio tab — the API’s image/video models are paid-only, so they are not called automatically.
