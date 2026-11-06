# Application intake (Cloudflare Worker)

Receives the Apply form from sdohartfellowship.org at
`https://apply.sdohartfellowship.org/apply`. For each applicant it:

1. Checks the answers against the live `data/apply.json` (same fields as the form).
2. Saves them to the R2 bucket `sdoh-art-applications`, one folder per person:
   `2027/<date>_<First-Last>_<id>/application.txt`, `cv.pdf`, `photo.jpg`.
3. Emails the answers and files to everyone in `NOTIFY_TO` (wrangler.toml).

## One-time setup (Cloudflare dashboard, account that owns the domain)

1. **R2**: enable R2 (free tier), create bucket `sdoh-art-applications`.
2. **Email Routing** on sdohartfellowship.org: enable it, then add and verify
   each address in `NOTIFY_TO` as a destination. Each person must click the
   verification link Cloudflare sends them.
3. Deploy from this folder (needs Node):
   ```
   npx wrangler login
   npx wrangler deploy
   ```
   This also creates the `apply.sdohartfellowship.org` subdomain.

## Reading applications

Emails arrive per applicant. The full archive is in Cloudflare dashboard →
R2 → `sdoh-art-applications`; download any folder from there.

## Changing recipients

Edit `NOTIFY_TO` in wrangler.toml, verify the new address in Email Routing,
then `npx wrangler deploy`.
