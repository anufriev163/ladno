# ladno

## Deploy and verify

The **AI connectivity smoke test** workflow deploys a version of the existing Cloudflare Worker `ladno` and generates one recipe. Set the repository Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Use a Cloudflare account API token with `Individual Workers Editor` for `ladno`. The workflow keeps the existing Worker secrets and bindings and does not change routes or create a Worker.

After the smoke test passes, run **Full weekly AI acceptance** against the deployed Worker. It generates 21 dishes with a synthetic profile and checks the dietary exclusions, serving quantities, and the total cost of whole packages. Both workflows record sanitized results under `diagnostics/`.
