# Lutra 3D — implementation design

## 1. Scope and constraints

A small, content-focused website with a Gallery, project details, and an upcoming-job Queue. GitHub Pages serves static files; there are no API endpoints, database, authentication, or browser-side editing.

- Content and configuration: JSON files only.
- Layout: HTML files only.
- Styling: CSS files only; no inline styles.
- Behavior: JavaScript files only; no inline scripts or event handlers.
- Assets: local images and a logo. No remote fonts, scripts, or runtime dependencies.
- Content updates are file edits committed to `main`; GitHub Actions validates and publishes them automatically.
- Repository-only exception: `.github/workflows/pages.yml` configures publishing. YAML is not website content.

Use plain HTML, CSS, and JavaScript with no frontend compilation. A dependency-free Node.js publishing script generates the gallery index and prepares the deployment folder. Replace the existing React/gh-pages package scripts during implementation; those tools are unnecessary.

## 2. File structure

```text
.github/workflows/pages.yml    # validation and Pages publishing
scripts/build-site.js          # Node.js validation, discovery, staging
dist/                          # generated Pages artifact; ignored by Git
website/                       # deployed website root
  index.html                   # shared shell, gallery, queue, detail templates
  projects.json                # generated index; ignored by Git
  queue.json                   # ordered upcoming jobs
  assets/
    brand/                     # plum otter brand assets, all outlined SVG
      logo.svg                 # supplied square artwork
      logo-horizontal.svg      # horizontal logo with outlined lettering
      symbol.svg               # otter favicon and footer mark
  css/
    styles.css
  js/
    app.js                     # routing, rendering, interaction
    data.js                    # static JSON loading and validation
  projects/                    # all project metadata and photos
    desk-organizer/
      project.json
      front.webp
      side.webp
      parts.webp
    lamp-shade/
      project.json
      overview.jpg
```

Project folders use unique lowercase names with letters, digits, and hyphens. Reserve `assets`, `css`, and `js` for site resources. All resource URLs are relative to the website root so deployment also works beneath a URL prefix.

**Discovery rule:** the publishing script scans immediate subfolders of `website/projects/` for `project.json`. Each matching folder is a published project; folders without that file are ignored. Keep each project's JSON and referenced photos together under `website/projects/<folder>/`. Keep the generated gallery index at `website/projects.json`. A browser cannot reliably enumerate static folders, so each successful build regenerates `projects.json` in both the website root and the deployment artifact. Never edit the generated index manually. To unpublish a project, remove its folder from `website/projects/` or move it outside that directory. The deployment preserves the `projects/<folder>/` paths.

## 3. JSON contracts

### Gallery index: `projects.json`

```json
{
  "projects": ["desk-organizer", "lamp-shade"]
}
```

`projects` is an array of unique folder names sorted by `publishedDate` descending (newest first). Equal dates sort by folder name ascending, using ASCII lexical order. The browser preserves this order. An empty array is valid.

### Project: `projects/<folder>/project.json`

```json
{
  "title": "Desk organizer",
  "publishedDate": "2026-10-05",
  "description": "A modular organizer for tools and stationery.\n\nPrinted in PLA.",
  "photos": [
    { "file": "front.webp", "alt": "Organizer viewed from the front" },
    { "file": "side.webp", "alt": "Organizer viewed from the side" },
    { "file": "parts.webp", "alt": "Individual organizer modules" }
  ],
  "tilePhotos": ["front.webp", "side.webp"],
  "links": [
    { "label": "GitHub", "url": "https://github.com/example/organizer" },
    { "label": "Printables", "url": "https://www.printables.com/model/123456" }
  ]
}
```

- `title`: required nonblank string; recommended maximum 80 characters.
- `publishedDate`: required valid calendar date in `YYYY-MM-DD` format. Represents original publication, not last modification; editing a project does not change it automatically. Future dates do not schedule publication: all discovered projects publish immediately.
- `description`: required nonblank plain-text string. Preserve paragraphs/newlines; no HTML or Markdown interpretation.
- `photos`: required nonempty ordered array. Each entry has a unique `file` and meaningful `alt` text. All entries appear in project detail.
- `tilePhotos`: required ordered array of 1–4 unique filenames selected from `photos`. Controls tile composition and order independently of detail order.
- `links`: optional array, default `[]`. Each entry has a nonblank label and an absolute HTTPS URL. Supports GitHub, Thingiverse, Printables, and other project resources.
- Photo filenames refer to files inside this project folder. Reject absolute paths, backslashes, `..`, query strings, and fragment identifiers. Use simple filenames with letters, digits, hyphens, underscores, and extensions.
- Extra images in the folder are not displayed until added to `photos`. Publishing copies only `project.json` and referenced photos from project folders.

### Queue: `queue.json`

```json
{
  "items": [
    {
      "id": "job-001",
      "commissionedDate": "2026-10-05",
      "title": "Replacement enclosure",
      "customer": "Example customer"
    }
  ]
}
```

- `items`: required array; empty is valid. The browser sorts by `commissionedDate` descending, newest commissions first; equal dates retain their original JSON order. Display order does not imply execution priority.
- `id`: required unique nonblank string; stable across edits.
- `commissionedDate`: required valid calendar date in `YYYY-MM-DD` format; this is the date commissioned, not a scheduled completion date.
- `title` and `customer`: required nonblank strings.
- Completed or cancelled jobs are removed manually. No status workflow is included.
- Customer names are displayed as supplied in this public website's JSON.

## 4. Navigation and page behavior

Use one HTML shell with hash routing. Normal anchor links provide navigation and browser Back/Forward support without server rewrite rules.

| Route | Content |
| --- | --- |
| `#/gallery` | Gallery; default when the hash is absent |
| `#/queue` | Upcoming-job cards |
| `#/project/<folder>` | Project detail for a folder listed in the index |

The header appears on every view: logo and “Lutra 3D” home link on the left, Gallery and Queue links on the right. Gallery remains active on project details; active navigation uses `aria-current="page"`. Clicking the logo opens Gallery. Unknown routes show a short not-found message and a Gallery link.

### Gallery

- Load the index, then load listed project files concurrently. Preserve index order regardless of response order.
- Render each project as a card with a project anchor containing a photo collage and its title, plus optional resource badges below the title. Keep resource anchors outside the project anchor.
- Collage layouts: one photo fills the tile; two use equal columns; three use a large left photo and two stacked right photos; four use a 2×2 grid.
- Use CSS Grid with a 4px gap. For three photos, the first spans both rows of the left column; the remaining two fill the right column from top to bottom. Other layouts use JSON order, left to right then top to bottom. Apply a photo-count class in JavaScript; all layout rules stay in CSS. Photos do not overlap.
- Use a consistent 4:3 collage frame and `object-fit: cover`. Show the complete title above it in a bold candy-pink pixel-style title bar, wrapping when necessary. Use consistent 2px muted purple borders, small decorative pixel icons, and a hard offset shadow on gallery cards.
- Clicking the photos or title opens its detail route. Optional resource badges open their HTTPS destinations in the same tab. No description appears on the tile.
- Empty gallery: “No projects yet.”

### Project detail

- Show “Back to Gallery,” title, optional resource badges directly under the title, description, and all photos in JSON order.
- Each resource badge has its JSON label and a decorative local icon. Select GitHub, Thingiverse, or Printables icons by URL hostname, including subdomains; use a generic link icon for other resources. Preserve JSON order and hide the badge row when links are absent or empty.
- Display photos at their natural aspect ratio without cropping, in a responsive grid; one column on small screens, two on wider screens.
- Resource links open in the same tab with descriptive labels. Do not embed third-party content.
- Unknown or unlisted folder: “Project not found.” A listed project with unavailable/invalid data shows “This project could not be loaded” and a retry action.
- Detail can be opened directly by URL; it does not depend on having visited Gallery first.
- No lightbox, carousel, or image-upload interface is required.

### Queue

- Render one simple card per job with title, “Customer,” and “Date commissioned.”
- Sort newest commissions first, retaining JSON order for equal dates. Use a `<time datetime="YYYY-MM-DD">` element and display dates as `5 Oct 2026`. Format a date-only value without timezone conversion.
- Empty queue: “No upcoming jobs.”

## 5. Visual and accessibility rules

- Pastel moodboard palette: plum (#76518f) is the primary logo and link color. Use a lilac (#e6d9f0) desktop background with a faint white grid, pink-white (#fff8fc) content panels, candy-pink (#efc3dd) Gallery and Queue card bars, lavender (#d9c8ef) section bars, and mint (#d2eee8) controls and date badges. Keep dark plum text, muted purple borders, 20px rounded corners on panels and 14px rounded corners on controls, lavender card shadows, and small decorative pixel folders and sparkles; no animation.
- System font stack; body text 16px or larger and line height around 1.6. Use bold system monospace for headings, title bars, navigation, and badges, keeping descriptions and job details in a readable system sans-serif. No remote fonts or image filters.
- Apply the same visual language to the framed header and footer, view headings, project descriptions and photos, resource badges, Queue cards, loading/error panels, and empty states. Decorative icons have no interaction or meaning and are hidden from assistive technology.
- Center content in a maximum-width 1120px container, with 16px mobile and 24px desktop padding.
- Gallery: one column below 600px, two from 600px, three from 960px; 20px gaps. Queue uses the same responsive card grid.
- Header wraps on narrow screens without horizontal scrolling. Use a horizontal outlined logo around 280px wide on desktop and the supplied square outlined logo at 72px on mobile. Preserve artwork proportions and recolor the website versions to the primary plum, with no remote font dependencies. Use the otter symbol for the favicon and footer. Keep the editable source logos unchanged.
- Use semantic `header`, `nav`, `main`, headings, lists, anchors, and buttons; define reusable view/card markup in HTML `<template>` elements.
- Include a skip-to-content link, visible keyboard focus, sufficient contrast, image alt text, and accessible loading/error announcements.
- On route changes, update the document title, scroll to the start of the view, and focus its main heading. Browser Back/Forward follows the same behavior.
- Include an HTML `<noscript>` message explaining that JavaScript is needed to display content.

## 6. Loading, rendering, and failure handling

`data.js` fetches static JSON with `fetch`, checks HTTP status, parses JSON, and validates the contracts before returning data. These requests retrieve files; they are not API calls. Use `cache: "no-cache"` for JSON to revalidate content on page loads. Cache validated results in memory for the current session; retry clears the relevant cached failure.

`app.js` listens to `hashchange`, clones HTML templates, populates text with `textContent`, assigns validated URLs, and swaps the active view. Never inject content through `innerHTML`. Use a navigation token to prevent an older asynchronous request from replacing a newer route.

Keep JSON schema checks and date/sort utilities as pure exported functions in `data.js`, without DOM access. The browser loader calls them; `build-site.js` imports the same checks and adds filesystem existence/path checks, preventing disagreement between publishing and runtime validation. Before a detail fetch, validate the folder against the index. Import paths and fetch URLs resolve relative to the site, never to `/`, so the GitHub repository URL prefix works.

- Show a loading message while a view's required data is pending.
- Index or queue fetch failure: show an error and a Retry button; do not present it as an empty result.
- Invalid project data: skip that tile, render valid projects, and show a concise partial-gallery warning. If all listed projects fail, show an error rather than the empty-gallery message.
- Invalid queue item: skip it and show a partial-data warning. If all entries in a nonempty queue fail, show an error. A missing/invalid top-level array fails the whole file.
- Broken image: retain its frame and show “Photo unavailable,” preserving the rest of the page.
- Log actionable file-specific validation errors to the console without showing raw technical errors to visitors.
- Lazy-load images below the initial viewport; load the first visible tile/detail image normally. Reserve tile dimensions to prevent layout shifts.

## 7. Automated publishing and maintenance

Enable **Settings → Pages → Source → GitHub Actions**. Run the workflow on pushes to `main`, pull requests targeting `main`, and manual dispatch. Pull requests only validate/build; deployment is restricted to `main`. Use the official Pages configuration, artifact upload, and deployment actions; pin supported action versions when implementing. Deployment depends on a successful build, uses the `github-pages` environment, and requires `pages: write` and `id-token: write`; checkout requires `contents: read`. Serialize production deployments so older runs cannot overwrite newer releases. See [GitHub's workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

The publishing script runs locally and in CI using the same command, `node scripts/build-site.js`:

1. Discover project folders, enforcing the folder-name contract.
2. Validate all project/queue schemas, actual calendar dates, unique IDs, photo selections, and referenced photo existence. Reject symbolic links and paths escaping the source root. Missing required site assets also fail validation.
3. Sort projects newest first and generate `projects.json` in the website root and deployment artifact.
4. Create a clean `dist/` containing only the HTML entry point, CSS/JS, site assets, `queue.json`, the generated index, and discovered project JSON/referenced photos. Documentation, workflow files, tooling, and unreferenced project files are excluded.
5. Upload `dist/` as the Pages artifact and deploy it only after validation succeeds. Any validation failure reports the file/field and exits nonzero; the previous published site remains available. Browser fallbacks still handle network or runtime failures.

Use a supported Node.js LTS release with standard-library filesystem operations and ES modules; no npm dependencies are needed. The minimal `package.json` declares `"type": "module"` and a `build` script. Load browser modules using an external `<script type="module" src="js/app.js">`. Local preview runs the same build, then serves `dist/` over HTTP. Opening through `file://` is unsupported because JSON loading requires HTTP/HTTPS.

To publish a project: add its folder, photos, and valid `project.json` under `website/projects/`, then commit to `main`. To update the queue: edit `queue.json` and commit. A manual workflow dispatch can retry publication. Version CSS/JS URLs when their contents change to prevent stale cached assets. No service worker is required.

## 8. Implementation sequence and acceptance

1. Create the HTML shell and templates, stylesheet, logo asset, and representative JSON content.
2. Implement file loading/validation and hash routing, then Gallery, detail, and Queue rendering.
3. Add responsive layouts, accessibility, loading/retry states, and image fallbacks.
4. Implement publishing validation and staging; preview `dist/` using a local static server and verify before deployment:

- Tiles with each of 1, 2, 3, and 4 photos render correctly; detail shows additional referenced photos.
- Gallery and Queue both sort newest first with their specified tie-breakers; optional links and multiline descriptions are preserved.
- Direct detail URLs, refresh, logo navigation, tabs, Back/Forward, and unknown routes work.
- Empty data, missing JSON, malformed JSON, invalid records, and missing photos produce the specified states.
- Rapid navigation cannot display stale results. Text resembling HTML renders as literal text.
- Keyboard navigation, visible focus, heading focus, alt text, and loading announcements work.
- Layout has no horizontal overflow at 320px, 768px, and 1280px widths.
- Deployment beneath a URL prefix works; network requests only retrieve static site files and explicitly clicked external links.
- Build verification covers invalid/missing dates, duplicate job IDs, invalid photo selections, missing photos, path escapes, empty content, and deterministic index generation.
- Pull requests validate without deploying; valid `main` changes deploy; invalid changes leave the previous site available. The artifact contains no repository tooling or unreferenced project files.
