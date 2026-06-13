# SDOH ART Fellowship — website

A one-page, app-style site for Emory NHWSN's **Advanced Research Training in Social Determinants of Health (SDOH ART)** fellowship. Static (vanilla HTML/CSS/JS), content managed through **Decap CMS**, hosted on **Netlify** with **Netlify Forms** for applications.

## Structure

```
index.html              App shell (sidebar + top tabs) + hidden Netlify form
assets/css/styles.css   Emory design system (navy #012169 / gold #f2a900)
assets/js/app.js        Hash router + all views, rendered from data/*.json
data/*.json             Content the CMS edits (fellows, faculty, news, gallery, pages, apply)
assets/img/             Framework SVG + gallery photos + CMS uploads
admin/                  Decap CMS (config.yml + loader)
netlify.toml            Hosting config
```

No build step: the app fetches `data/*.json` directly, and Decap writes those same files.

## Run locally

From this folder, serve over HTTP (the app uses `fetch`, so `file://` will not work):

```
npx serve .
# or
python -m http.server 8080
```

Then open the served URL.

## Routes

`#/about` · `#/framework` · `#/news` · `#/apply` · `#/inquiry` · `#/faculty` · `#/gallery` · `#/fellows/2025` · `#/fellows/2026` · `#/fellows/2027` · `#/fellows/2026/<id>` (fellow detail)

## Deploy + CMS (Netlify)

1. Push this folder to a GitHub repo and **Add new site → Import** in Netlify.
2. Build command: *(none)*. Publish directory: `.`
3. Enable **Identity** (Netlify Identity) and **Git Gateway** (Identity → Services).
4. Set Identity registration to **Invite only** and invite admin emails (you, Dr. Hamilton, coordinator).
5. Edit `admin/config.yml` → set `site_url` / `display_url` to your live URL.
6. Admins log in at `/admin` to manage fellows, faculty, news, photos, pages, and the application form.

Applications submit via Netlify **Forms** (form name `application`, incl. CV + headshot uploads). View/download submissions in Netlify → Forms.

## Adding a fellow (admin)

`/admin` → **Fellows** → add an item → fill fields → upload a headshot → **Publish**. A navy monogram shows automatically until a photo is added. Deleting an item removes the fellow.

## Still to finalize

- 2026 polished bios (currently concise research statements)
- Emory mentor full names: Ethan, Octavia, Nick G., Emily
- Faculty page scope + titles/photos
- Apply: eligibility, deadline, submissions email
- Inquiry contact email
- Decap admin accounts + custom domain
