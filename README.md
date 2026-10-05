# Lutra Design

A static 3D printing portfolio and upcoming-job queue, implemented from [DESIGN.md](DESIGN.md) with plain HTML, CSS, and JavaScript. There are no runtime or npm dependencies.

Use Node.js 24 LTS or newer:

```sh
npm test
npm run build
npm run preview
```

Preview opens at `http://localhost:4173/lutra3d/` (the prefix also verifies repository-style GitHub Pages hosting). The preview command builds first; restart it after editing content. Set `PORT` to use a different port. Opening the HTML through `file://` is unsupported.

## Content

The included projects, illustrations, logo, and queue are demonstration content. Replace them with your own work before sharing the site. Four sample projects cover all tile layouts; the organizer has an additional detail image. The optional `node scripts/generate-samples.js` command recreates these samples and overwrites their JSON and images.

Add an immediate subfolder of `website/projects/` with a lowercase letters/digits/hyphens name and a `project.json`. For example, put metadata in `website/projects/desk-organizer/project.json` and its referenced local photos beside it. See the full contracts in the design document and the sample JSON files. Choose 1–4 `tilePhotos`, and optionally supply HTTPS resource links. Remove the folder or move it outside `website/projects/` to unpublish it. Publication dates determine gallery order, not scheduled publication.

Optional `links` appear as labeled icon badges on gallery cards and directly below project detail titles. GitHub, Thingiverse, and Printables URLs select their own local icons; other HTTPS resources use a link icon. Labels and order come from JSON. Omitted or empty links hide the badge row. Badges open resources in the same tab, while a card's photos and title open its project details.

Edit `website/queue.json` to add or remove jobs. Names are public. Queue dates are commission dates and the display order does not indicate job priority. Use `{"items":[]}` for an empty queue. Remove all project folders for an empty gallery.

Never edit `projects.json` or `dist/`: the build discovers projects, validates content and local paths, generates a deterministic index, and copies only website resources and referenced project files. CSS and JS URLs receive content versions automatically, including module imports. Validation errors include the relevant file and field; validation finishes before replacing an existing local artifact.

The website root contains the page, `queue.json`, and generated `projects.json`. All project folders, including their `project.json` and photos, live under `website/projects/`. Shared site resources stay in `assets/`, `css/`, and `js/`. Each successful build regenerates the gallery index in both `website/` and `dist/`; it remains a generated, Git-ignored file. The deployment preserves the same folder structure, and existing `#/project/<folder>` routes still work.

## Publishing

In the GitHub repository select **Settings → Pages → Source → GitHub Actions**. Commit changes to `main` to validate and publish. Pull requests targeting `main` run tests and build without deployment. Manual workflow dispatch can retry publication. The workflow grants deployment permissions only to the deployment job and cancels superseded runs on the same branch. Failed validation prevents deployment and leaves the published site available.

The implementation includes hash navigation, direct project URLs, responsive photo collages, accessible loading and retry messages, partial-data warnings, broken-image fallbacks, and plain-text rendering. Tests exercise shared contracts, loader caching and retry, sorting, and publishing safety.

The visual theme is a pastel pixel workshop: lavender grid background, cream panels, plum borders, bold monospace title bars, pink Queue cards, and mint action buttons. Descriptions remain in a readable system font, photographs keep their original colors, and all decorations are local HTML/CSS.
