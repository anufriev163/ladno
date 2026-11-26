# ladno

## Deploy and verify

The **AI connectivity smoke test** workflow deploys a version of the existing Cloudflare Worker `ladno` and generates one recipe. Set the repository Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Use a Cloudflare account API token with `Individual Workers Editor` for `ladno`. The workflow keeps the existing Worker secrets and bindings and does not change routes or create a Worker.

**Full weekly AI acceptance** automatically runs after a successful smoke test and can also be started manually. It generates 21 dishes with a synthetic profile and checks cooking steps, dietary exclusions, serving quantities, and the total cost of whole packages. Both workflows record sanitized results under `diagnostics/`.

The Worker renders AI cooking instructions from validated actions and ingredient IDs. To check the allergy regression locally, run `node --test`. The browser retains validated days for 30 minutes and reuses them when the profile, catalog, and backend match.
