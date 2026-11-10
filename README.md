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

The download section covers Windows, Linux, macOS DMGs, and FreeBSD. Homebrew is an alternative macOS installation
method. Donations link to LizardByte's GitHub Sponsors, PayPal, and Patreon funding options.

The color theme follows the device preference until the visitor uses the header switcher. An explicit light/dark
choice is stored locally; the control still works for the current page when browser storage is unavailable.

Sunshine's existing repository and product page stay in place until the repository migration. Its old GitHub URLs
continue to provide fallback redirects after transfer; the optional ownership lookup uses the stable repository ID.

Repository Pages sites in SunshineStream inherit this organization's Pages hostname when they do not set their own
custom domain. Their published paths use the repository name.

## Assets and licensing

The original website code and illustration are licensed under [AGPL-3.0-only](LICENSE). Source is available through
the website footer. See [ASSETS.md](ASSETS.md) for the existing image and font licenses and attributions.
