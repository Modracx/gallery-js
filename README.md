# gallery-js

Image gallery for the web — a responsive thumbnail grid or masonry, plus an
accessible lightbox with zoom, pan, swipe, keyboard control and focus
trapping. Zero dependencies.

Three ways to use it, one engine behind all three.

---

## Repository layout

| Path | What it is |
| --- | --- |
| `gallery-js/` | The npm package — ES modules, TypeScript types, demos. The source of truth. |
| `vanilla/` | Standalone `<script>` build. Attaches `window.Gallery`. |
| `jquery/` | Standalone `<script>` build. Registers `$.fn.Gallery`. |
| `build.mjs` | Generates both standalone builds from `gallery-js/src`. |
| `img/` | Placeholder images used by the test runners. |

The two standalone builds are **generated** — edit `gallery-js/src` and run
`node build.mjs`, never edit them by hand.

---

## Install

### npm

```bash
npm install @modracx/gallery-js
```

```js
import Gallery from "@modracx/gallery-js";

Gallery.create(document.querySelector("#photos"), {
  columns: "auto",
  minColumnWidth: 200,
  aspectRatio: 1,
});
```

### Vanilla, script tag

```html
<div id="photos">
  <a href="1-full.jpg" data-caption="Low tide"><img src="1-thumb.jpg" alt="Beach" /></a>
  <a href="2-full.jpg" data-caption="Dusk"><img src="2-thumb.jpg" alt="Hills" /></a>
</div>

<script src="vanilla/gallery-vanilla.js"></script>
<script>
  Gallery.create(document.getElementById("photos"), { columns: 3 });
</script>
```

### No JavaScript at all

```html
<div data-gallery data-gallery-columns="4" data-gallery-aspect-ratio="1">
  <a href="1-full.jpg"><img src="1-thumb.jpg" alt="First" /></a>
</div>
<script src="vanilla/gallery-vanilla.js"></script>
```

### jQuery, script tag

```html
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="jquery/gallery-jquery.js"></script>
<script>
  $("#photos").Gallery("create", { columns: 3, aspectRatio: 1 });
</script>
```

---

## It reads the markup you already have

A link wrapping a thumbnail is enough. Full-size source comes from `data-src`,
then the `<a href>`, then the thumbnail itself; captions from `data-caption`,
then a `<figcaption>`, then the image's `alt`.

That ordering is deliberate: the markup keeps working as plain links with
JavaScript off, and only becomes a gallery once `create()` runs.

---

## Options

```js
Gallery.create(el, {
  // gallery
  itemSelector: "a, [data-gallery-item]",
  lightbox: true,
  observeMutations: true,

  // layout
  layout: "grid",        // "grid" | "masonry" | "none"
  columns: "auto",       // or a number
  minColumnWidth: 200,
  gap: 12,
  aspectRatio: null,     // 1 for squares, 16/9 for widescreen
  radius: 6,

  // lightbox
  loop: true,
  counter: true,
  captions: true,
  arrows: true,
  thumbnails: false,
  closeOnBackdrop: true,
  speed: 200,
  zoom: true,
  zoomScale: 2.5,
  maxZoom: 6,
  preload: 1,
});
```

---

## Controlling it

```js
const g = Gallery.create(el);

g.open(2); g.close(); g.next(); g.prev(); g.goTo(0);
g.update();      // re-scan after changing thumbnails
g.destroy();     // restores the original DOM exactly

g.items; g.length; g.isOpen; g.index; g.lightbox;

g.on("change", ({ index, item }) => { /* ... */ });
```

Full API, layout notes and the accessibility details are in
[`gallery-js/README.md`](gallery-js/README.md).

---

## In the viewer

`←` `→` navigate, `Home`/`End` jump to the ends, `Escape` closes.
Double-click or wheel zooms toward the pointer, dragging pans while zoomed,
pinch zooms on touch, swiping left/right navigates and swiping down dismisses.

---

## Try it

```bash
python3 -m http.server 8000
```

- `vanilla/index-vanilla-js-test.html` — standalone build
- `jquery/index-jquery-test.html` — standalone build
- `gallery-js/demo/vanilla.html` — ES modules, straight from `src/`
- `gallery-js/demo/jquery.html` — ES modules, plugin entry point

---

## Accessibility

The viewer is a real modal: `role="dialog"`, `aria-modal`, focus moved in on
open, Tab trapped inside, and focus handed back on close — to the thumbnail you
**landed on**, not the one you started from. Page scroll is locked with
scrollbar-width compensation. A polite live region announces "Image 3 of 12"
plus the caption, since swapping an `<img>` source is otherwise silent to a
screen reader. Non-link triggers get `tabindex` and `role="button"` and respond
to Enter and Space.

---

## Building

```bash
node build.mjs
```

---

## License

MIT © [Kenneth D'silva (Modracx)](https://modracx.com/)
