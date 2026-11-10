<div align="center">
  <img src="assets/sunshine.svg" width="128" alt="Sunshine logo">
  <h1>Sunshine website</h1>
  <p>The Sunshine product page at <a href="https://sunshine.lizardbyte.dev/">sunshine.lizardbyte.dev</a>.</p>
</div>

GitHub Pages publishes `master` from the repository root. This is a static HTML, CSS, and JavaScript site with no
build step or runtime dependencies. Keep `.nojekyll` and `CNAME` at the repository root.

## Development

Serve the repository with a local static web server, for example `python -m http.server 8000`, then visit
`http://localhost:8000/`. Run the regression checks with `npm test` (Node.js 24 or newer).

The core downloads, documentation links, and featured Moonlight clients work without JavaScript. Optional enhancements
load the current Sunshine repository owner using GitHub repository ID `438803890`, display its latest stable release,
and populate additional clients from the shared
[app-directory catalog](https://app.lizardbyte.dev/app-directory/sunshine.json). Catalog tools are excluded from the
client list. An API failure preserves the static fallback links.

Sunshine's existing repository and product page stay in place until the repository migration. Its old GitHub URLs
continue to provide fallback redirects after transfer; the optional ownership lookup uses the stable repository ID.

Repository Pages sites in SunshineStream inherit this organization's Pages hostname when they do not set their own
custom domain. Their published paths use the repository name.

## Assets and licensing

See [ASSETS.md](ASSETS.md) for image and font sources. The website is licensed under GPL-3.0-only; existing branding
and font attribution remain applicable.
