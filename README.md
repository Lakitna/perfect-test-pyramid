# The Perfect Test Pyramid

The search for the perfect test pyramid. The pyramid that one everybody agrees with and works in
every situation.

## Build code

```
npm run build
```

Or, in watch mode

```
npm start
```

## Run code

```
node dist\pyramids.mjs
```

## Test pyramid generator (web app)

`npm run build` also compiles the web frontend to `dist/web/`. Serve that folder with any static
file server, for example:

```
npm run serve:web
```

Open the printed URL. The WYSIWYG editor lets you click a layer to select it, drag its blue edge
handles to resize, drag layers vertically to reorder, click the "+" on any edge to insert a layer,
and click any label or note to edit it in place. Export as `.png` or `.svg`, and share any pyramid
by copying the link — the full pyramid is encoded as base64 JSON in the URL hash (`#p=...`). See
`src/generator/PLAN.md` for design details.
