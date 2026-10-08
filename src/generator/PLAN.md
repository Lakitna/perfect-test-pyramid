# Test Pyramid Generator — Implementation Plan

A dependency-free, static web app in `src/generator/`: vanilla TypeScript rendering the pyramid as
**SVG**, with a **WYSIWYG editor** (formatting toolbar above the canvas, click-to-select layers,
draggable width handles, single-click-to-edit text, drag-to-reorder layers, shape presets), a legend
beside the pyramid showing notes, `.png`/`.svg` export, and full pyramid state encoded as
**base64url JSON in the URL hash** (`#p=...`). Built by extending the existing Rollup config to emit
`dist/web/`, which can be served with any static file server.

## Design decisions (agreed with user)

- Vanilla TypeScript + SVG (no framework, no runtime dependencies)
- Notes display: legend beside the pyramid (notes only — labels/colors shown once, on the pyramid)
- Run: build only, serve manually (Rollup outputs `dist/web/`, no dev-server dependencies)
- URL: hash fragment `#p=<base64url JSON>`
- Location: `src/generator/` (entry `src/generator/index.ts`)
- **Revision (user feedback):** the initial side-panel editor placed controls far from the pyramid;
  the editor was reworked around WYSIWYG text-editor concepts — see "Editing model" below.
- **Revision 2 (user feedback):** the separate view mode was removed — the app is always in edit
  mode; explainer texts were dropped in favor of visual affordances; labels use contrasting
  background chips; Share/export buttons were unified into one Share dropdown.

## Editing model (WYSIWYG)

- **Toolbar** directly above the canvas (like a formatting ribbon): undo/redo, delete, **Shape…**
  preset dropdown, move up/down, layer color picker, and Top/Bottom width number fields for the
  selected layer. Selection-dependent controls disable without a selection. All canvas interactions
  run on **pointerdown** (not click) so switching targets mid-edit stays one-click.
- **Click to select** a layer (tint + dashed outline + four blue drag handles + two centered "+"
  insert handles on its top/bottom edges). Clicking empty space or `Esc` deselects. Nothing is shown
  on the pyramid while nothing is selected.
- **Toolbar visibility**: undo/redo, the Preset and Shape dropdowns are always visible; the move
  up/down, delete, color and Top/Bottom width controls appear **only while a layer is selected**,
  ordered `↶ ↷ | Preset… | Shape… | ↑ ↓ 🗑 | color | Top Bottom`.
- **Drag handles** resize an edge symmetrically around the pyramid center, with a live value badge;
  the width number fields in the toolbar stay in sync. The drag is **constrained to the horizontal
  middle**: each handle tracks its own side's signed distance, so crossing the center sticks the
  width at 0 (mirroring the 100 cap) instead of flipping to grow again.
- **Drag layers** vertically to reorder (6px threshold; dragged layer dims, a dashed drop indicator
  shows the target edge; the positional silhouette stays put, contents move).
- **Insert layers** inline via the centered "+" on the selected layer's top/bottom edges ("+
  Above"/"+ Below" toolbar buttons were removed once this worked). New layers cycle the palette to
  avoid duplicating their neighbors' colors.
- **Single click to edit text in place**: layer labels (in the shape), legend notes, and the
  model-level title (above the pyramid) / descriptor (below) open an overlay input/textarea
  positioned exactly over the SVG text (caret at end, not select-all). Notes and descriptor are
  multiline (`Shift+Enter` inserts a line); label and title are single-line. Clicking another text
  while editing commits the first and opens the second in the same click. Enter commits, `Escape`
  cancels, blur commits.
- **Shape presets** (`applyShape` in `model.ts`): pyramid, inverted-pyramid, honeycomb, rectangle,
  trophy (honeycomb cup with a flared base) — set all edge widths from a profile function; widths
  stay fully editable afterwards.
- **Keyboard**: `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` undo/redo, `Del`/`Backspace` delete selected,
  `Esc` deselect. Suppressed while typing in an inline editor.
- **Undo/redo history**: JSON snapshots (cap 100) pushed on every committed change; live changes
  during drags/typing don't pollute history.
- Surgical DOM updates during drags/color picking/width typing keep focused toolbar inputs and the
  OS color picker alive; finished changes trigger a full re-render.
- Exports render a **fresh** SVG from the model, so selection UI never leaks into files.
- **Discoverability affordances (visual only — no explainer texts):**
  - hovering a layer brightens it slightly (1.12) and draws a dashed accent border with an inner
    solid background-colored border; both are overlay polygons inside the editing-UI group, which
    always paints above every layer — so no neighbor can ever obscure the border (and hovering the
    chip/label/legend row counts as hovering the layer)
  - the selected layer gets a **solid** accent border with the same inner background border, plus
    the translucent tint and drag handles
  - hovering labels/legend notes shows a dotted underline + text cursor
  - empty labels/notes show a subtle dashed blank line (edit mode only) that is itself clickable
- **Label layout:** horizontally centered chips on each layer band; always **black text on a white
  chip** (uniform style, independent of layer color), sized via canvas text measurement, with the
  baseline tuned so the text sits vertically centered in the chip.
- **Legend layout:** notes only (the label appears once — on the layer; the color swatch was
  redundant), one row per layer, vertically centered inside the layer's 64px band.
- **Share:** a single header dropdown ("Share ▾") groups Copy link, Download .svg and Download .png;
  it closes on outside click or after an action.

## Data model

Generator-local model — the existing `Layer` in `src/data.d.ts` (`label[]`, `size`, `position`) does
not fit this spec, so it is intentionally not reused or modified.

```ts
interface GeneratorLayer {
  label: string; // shown inside the layer and in the legend
  notes: string; // shown in the legend
  color: string; // #rrggbb fill
}

interface PyramidModel {
  version: 1;
  title?: string; // optional heading above the pyramid
  descriptor?: string; // optional line below the pyramid (e.g. crediting a preset's creator)  layers: GeneratorLayer[]; // index 0 = TOP layer; 1..20 entries
  widths: number[]; // length = layers.length + 1; widths[i] = top edge of layer i,
  // widths[layers.length] = bottom edge; each 0..100 (relative units)
}
```

- Every layer has equal height; its shape is a trapezoid drawn with straight lines between its top
  width and bottom width, horizontally centered. Non-triangular silhouettes are intentional.
- **Aspect-ratio-aware sizing** (`layerHeightFor`/`unitFor` in `render.ts`): layer height scales
  inversely with the layer count (430px total-height anchor at 5 layers, clamped 46–110px) and the
  px-per-width-unit shrinks so the pyramid keeps roughly a 1.4 width:height ratio for 1–10 layers.
  The 46px floor guarantees clickable space around the 21px label chip (clickable without hitting
  the label); 20 layers is intentionally taller than wide.
- Missing/invalid hash → first preset (`PRESETS[0].data`, cloned via `cloneModel`) + warning banner.
- **Title & descriptor:** optional model-level texts rendered above/below the pyramid (reserved
  `TITLE_SPACE`/`DESCRIPTOR_SPACE` bands, so band geometry is stable whether or not they are
  filled). Single-click to edit like layer labels/notes (dashed hint line when empty in edit mode);
  included in exports and the URL hash. Presets carry their own title/descriptor — the descriptor is
  the place to credit a preset's creator.
- **Presets are static data:** the editor and initial load always apply them through `cloneModel()`
  — assigning `PRESETS[i].data` directly would let edits mutate the preset.
- Layer ops keep `widths` consistent: insert = new border at average of neighbors, remove = collapse
  the border below the removed layer, move = swap layer contents only (the silhouette is
  positional).

## Files

| File                       | Purpose                                                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model.ts`                 | Types, constants, default pyramid, palette, validation (`parseModel`), layer/width ops                                                                                     |
| `urlState.ts`              | base64url encode/decode (Unicode-safe), read/write `#p=` via `history.replaceState`                                                                                        |
| `render.ts`                | Pure model → single SVG (pyramid trapezoids + legend with wrapped notes); shared geometry helpers (`edgeGeometry`, `layerPolygonPoints`), serialization helper for exports |
| `editor.ts`                | WYSIWYG editing: toolbar, click-selection, drag handles, inline text-edit overlays                                                                                         |
| `export.ts`                | `.svg` via `XMLSerializer` → Blob download; `.png` via SVG data-URL → `Image` → canvas at 2× (both render a fresh SVG from the model)                                      |
| `index.ts`                 | Entry: init from URL (data present → view mode; absent → edit mode), undo/redo history, keyboard shortcuts, debounced URL sync, `hashchange` handling                      |
| `index.html`               | Page shell: header (mode toggle, Copy link, Export .svg/.png), toolbar, pyramid canvas                                                                                     |
| `styles.css`               | Layout + styling (system fonts — required for faithful PNG export)                                                                                                         |
| `../scripts/serve-web.mjs` | Optional zero-dependency static server for `dist/web/`                                                                                                                     |

## Build integration

- `rollup.config.js`: second bundle config — input `src/generator/index.ts` →
  `dist/web/generator.js` (format `es`), plugins: `del('dist/web/*')`, `typescript` (same tsconfig;
  DOM types available via default `esnext` lib), `cleanup`, `terser` (JS minify), `copy` (HTML +
  CSS + `fonts/*.woff2`), `minifyStaticAssets` (clean-css + html-minifier-terser on the copied
  files, in `writeBundle`). No `externals()` for the web bundle.
- Fonts load lazily per style: `@font-face` rules are injected only for styles in use
  (`ensureFontFaces`, called by `loadStyleFonts`) — browsers eagerly fetch the src of every rule
  present, so boot downloads just the active style's few woff2 files, and a style switch pulls in
  its faces on first use.
- `package.json`: `rollup-plugin-copy` recorded in devDependencies (it was imported by
  `rollup.config.js` but missing from the manifest). No other dependencies.
- `npm run build` builds both the library and the web app.
- `../scripts/serve-web.mjs` sends `cache-control: no-store` so rebuilt bundles are served fresh;
  `fonts/` files are content-hashed by `npm run build:fonts`, so they are served `immutable` and
  stay cacheable across bundle changes (the JS bundle no longer embeds font bytes).

## Export behavior

- Export captures the full view representation (pyramid + legend) as one SVG.
- SVG: standalone file with `xmlns` and explicit width/height.
- PNG: rendered from the SVG data-URL onto a canvas at 2× with a white background. Export fonts are
  fetched from the static `fonts/` files on demand and embedded as data URIs, which keeps the canvas
  untainted and the export offline-faithful.

## URL behavior

- The hash always contains the complete pyramid data: `#p=<base64url(JSON)>`, updated (debounced) on
  every change via `history.replaceState`.
- Opening a URL that contains `#p=` starts in view mode; an empty hash starts in edit mode.
- Mode toggle is UI-only (not part of the shared URL).
- Corrupt/incompatible hash → warning banner + default pyramid, no crash.

## Verification checklist

1. `npm run build` → `dist/web/` contains `generator.js`, `index.html`, `styles.css`.
2. Serve `dist/web` → edit a layer → hash updates live → reload restores exactly.
3. Paste a shared URL in a new tab toolbar buttons disable appropriately.
4. Export `.svg` opens standalone in a browser (no selection UI inside); `.png` shows pyramid +
   legend at 2×.
5. Garbage hash → warning banner + default pyramid.
6. WYSIWYG: click selects (outline + handles), drag handle resizes edge with live badge,
   double-click label/notes edits in place, `Ctrl+Z`/`Ctrl+Y` walk the history, `Del` removes the
   selected layerpng` shows pyramid + legend at 2×.
7. Garbage hash → warning banner + default pyramid.

## Known pre-existing quirks (not in scope)

- `rollup.config.js` first config: `del({ targets: package_.files })` — `package.json` has no
  `files` field (no-op today).
- `src/report/statistics.ts` imports `handlebars` (not in `package.json`) but isn't in the bundle
  graph from `src/index.ts`.
