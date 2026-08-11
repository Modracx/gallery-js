# @modracx/gallery-js

Image gallery for the web: a responsive thumbnail grid (or masonry), and an
accessible lightbox with zoom, pan, swipe, keyboard control and proper focus
trapping. Zero dependencies, no build step.

```bash
npm install @modracx/gallery-js
```

```js
import Gallery from "@modracx/gallery-js";

Gallery.create(document.querySelector("#photos"), {
  columns: "auto",
  minColumnWidth: 200,
  aspectRatio: 1,
  gap: 12,
});
```

It reads ordinary markup — a link wrapping a thumbnail is all it needs, and
that markup keeps working with JavaScript off:

```html
<div id="photos">
  <a href="beach-full.jpg" data-caption="Low tide, October">
    <img src="beach-thumb.jpg" alt="A wide empty beach" />
  </a>
</div>
```

---

## Contents

- [Where the data comes from](#where-the-data-comes-from)
- [Options](#options)
- [The controller](#the-controller)
- [Events](#events)
- [Layout](#layout)
- [The lightbox](#the-lightbox)
- [Declarative setup](#declarative-setup)
- [jQuery](#jquery)
- [Granular API](#granular-api)
- [Accessibility](#accessibility)
- [Browser support](#browser-support)

---

## Where the data comes from

Each item is read from its trigger element, in this order:

| Field | Looked for in |
| --- | --- |
| **Full-size src** | `data-src`, then the `href` of a wrapping `<a>`, then the thumbnail's own `src` |
| **Thumbnail** | the trigger's `<img>` (`currentSrc`, so responsive `srcset` is respected) |
| **Caption** | `data-caption`, then an enclosing `<figure>`'s `<figcaption>`, then the image's `alt` |
| **Alt text** | the thumbnail's `alt` |

Items with no resolvable source are skipped rather than rendered as a broken
frame. The `href` fallback is deliberate: it means the gallery degrades to
plain links when JavaScript does not run, and `create()` calls
`preventDefault()` only once it is in charge.

---

## Options

### Gallery

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `itemSelector` | string | `"a, [data-gallery-item]"` | Which descendants are items. |
| `lightbox` | boolean | `true` | Off means layout only — your own click handling. |
| `observeMutations` | boolean | `true` | `MutationObserver` re-scans when thumbnails are added or removed. |

### Layout

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `layout` | `"grid"` \| `"masonry"` \| `"none"` | `"grid"` | `"none"` leaves your CSS alone. |
| `columns` | number \| `"auto"` | `"auto"` | `"auto"` fits as many as `minColumnWidth` allows. |
| `minColumnWidth` | number | `200` | Px, for `columns: "auto"`. |
| `gap` | number | `12` | Px. |
| `aspectRatio` | number \| `null` | `null` | `1` crops to squares, `16/9` to widescreen. `null` keeps natural proportions. |
| `radius` | number | `6` | Thumbnail corner radius in px. |

### Lightbox

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `loop` | boolean | `true` | Wrap past the ends. |
| `counter` | boolean | `true` | The "3 / 12" readout. |
| `captions` | boolean | `true` | |
| `arrows` | boolean | `true` | |
| `thumbnails` | boolean | `false` | Strip along the bottom. |
| `closeOnBackdrop` | boolean | `true` | |
| `speed` | number | `200` | Fade ms. |
| `backdrop` | string | near-black | Any CSS colour. |
| `zoom` | boolean | `true` | |
| `zoomScale` | number | `2.5` | Double-click zoom level. |
| `maxZoom` | number | `6` | Ceiling for wheel and pinch. |
| `preload` | number | `1` | Images either side to fetch ahead. |
| `labels` | object | — | Accessible names for the dialog and its buttons. |

---

## The controller

```js
const g = Gallery.create(el);

g.open(2);        // open at an index
g.close();
g.next();
g.prev();
g.goTo(0);
g.update();       // re-scan after changing thumbnails
g.destroy();      // restores the original DOM exactly

g.items;          // [{ trigger, thumbEl, src, thumb, caption, alt }, …]
g.length;
g.isOpen;
g.index;          // active index while open, else -1
g.lightbox;       // the viewer, created lazily on first open
```

---

## Events

```js
const off = g.on("change", ({ index, item }) => console.log(item.caption));
off();
```

| Event | Fires when |
| --- | --- |
| `open` / `close` | The viewer opened or closed. |
| `change` | A different image became active. |
| `error` | An image failed to load. |
| `update` | The container was re-scanned. |

---

## Layout

`"grid"` uses CSS grid — `repeat(auto-fill, minmax(minColumnWidth, 1fr))` for
`columns: "auto"`, or a fixed count. With `aspectRatio` set, thumbnails are
cropped with `object-fit: cover`.

`"masonry"` uses CSS multi-column, which needs no measurement and no reflow
loop. The trade-off is **reading order**: columns fill top-to-bottom, so item 2
sits below item 1 rather than beside it. If order matters more than packing,
use `"grid"`.

`"none"` applies no layout at all — useful when you only want the lightbox:

```js
Gallery.create(el, { layout: "none" });
```

---

## The lightbox

The viewer is built on first open and then **kept in the DOM, hidden**, rather
than rebuilt each time — rebuilding it would drop the browser's decoded-image
cache along with it.

| Input | Does |
| --- | --- |
| `←` `→` | Previous / next |
| `Home` `End` | First / last |
| `Escape` | Close |
| Double-click, wheel | Zoom (toward the pointer) |
| Drag while zoomed | Pan, clamped to the image |
| Two-finger pinch | Zoom |
| Swipe left/right | Previous / next |
| Swipe down | Dismiss |
| Click the backdrop | Close |

`preload` fetches the neighbouring images so a left/right press shows something
immediately. A failed image reports an `error` event and shows alt text rather
than an empty frame.

---

## Declarative setup

The standalone `vanilla/` and `jquery/` builds call `autoInit(document)` on
`DOMContentLoaded`:

```html
<div data-gallery data-gallery-columns="4" data-gallery-aspect-ratio="1">
  <a href="1-full.jpg"><img src="1-thumb.jpg" alt="First" /></a>
</div>
```

Attribute names are option names in kebab-case, values are coerced, and a
valueless attribute reads as `true`. `data-gallery` may hold a JSON object,
and any `data-gallery-*` value starting with `{` or `[` is parsed as JSON too.

The npm package does not auto-run on import — call `Gallery.autoInit()`.

---

## jQuery

```js
import "@modracx/gallery-js/jquery";

$(".photos").Gallery("create", { columns: 3, aspectRatio: 1 });
$(".photos").Gallery("open", 2);
$(".photos").Gallery("close");
$(".photos").Gallery("destroy");

$(".photos").Gallery("get");     // controller from the first element
$(".photos").Gallery("length");  // number
$(".photos").Gallery("isOpen");  // boolean
```

With a bundled jQuery that is not on `window`:

```js
import registerGalleryPlugin from "@modracx/gallery-js/jquery";
registerGalleryPlugin($);
```

---

## Granular API

```js
import { createGallery, createLightbox, applyGrid } from "@modracx/gallery-js";
```

`applyGrid(container, items, options)` lays thumbnails out and returns a
cleanup. `createLightbox(items, options)` is the viewer on its own — hand it
any array of `{ src, thumb, caption, alt }` and it works without a gallery
container at all.

---

## Accessibility

- **The viewer is a real modal.** `role="dialog"`, `aria-modal="true"`, focus
  moved to the close button on open, Tab cycled inside it, and focus handed
  back on close — to the thumbnail you **landed on**, not the one you started
  from, so arrowing through images does not lose your place.
- **Page scroll is locked** while it is open, with the scrollbar's width
  compensated so the layout behind does not jump.
- **A polite live region** announces "Image 3 of 12" plus the caption, since
  swapping an `<img>` source is otherwise silent.
- **Non-link triggers** get `tabindex="0"` and `role="button"`, and respond to
  Enter and Space. Links are left alone — they already work.
- **Every control is a real `<button>`** with an accessible name.
- **Reduced motion** removes the fades and zoom transitions; everything still
  functions.

---

## Browser support

Chrome / Edge 88+, Firefox 78+, Safari 14+.

| Feature | If missing |
| --- | --- |
| `MutationObserver` | Auto re-scan is skipped; call `update()` yourself. |
| `matchMedia` | Reduced motion is treated as "not requested". |
| Pointer events | Swipe, pan and pinch are unavailable; buttons and keys still work. |

---

## License

MIT © [Kenneth D'silva (Modracx)](https://modracx.com/)
