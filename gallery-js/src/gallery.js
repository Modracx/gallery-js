/*!
 * gallery-js — thumbnail collection and lightbox wiring
 * Kenneth D'silva (Modracx), Copyright (c) 2026
 * Licensed under the MIT License – https://opensource.org/licenses/MIT
 */
import { GALLERY_KEY, createEmitter, teardown } from "./core.js";
import { applyGrid } from "./grid.js";
import { createLightbox } from "./lightbox.js";

export const galleryDefaults = {
  /** Which descendants are gallery items. */
  itemSelector: "a, [data-gallery-item]",
  /** Open the lightbox when an item is activated. */
  lightbox: true,
  /** Re-scan the container when its children change. */
  observeMutations: true,
};

/**
 * Read one item out of its trigger element.
 *
 * The full-size source is looked for in the order a marked-up gallery usually
 * provides it: an explicit `data-src`, then the href of a wrapping link, then
 * the thumbnail itself as a last resort.
 */
function readItem(trigger) {
  const thumbEl = trigger.matches("img") ? trigger : trigger.querySelector("img");
  const src =
    trigger.dataset.src ||
    (trigger.tagName === "A" ? trigger.getAttribute("href") : null) ||
    (thumbEl ? thumbEl.currentSrc || thumbEl.getAttribute("src") : null);

  const figure = trigger.closest("figure");
  const figcaption = figure ? figure.querySelector("figcaption") : null;
  const caption =
    trigger.dataset.caption ||
    (figcaption ? figcaption.textContent.trim() : "") ||
    (thumbEl ? thumbEl.getAttribute("alt") || "" : "");

  return {
    trigger,
    thumbEl,
    src,
    thumb: thumbEl ? thumbEl.currentSrc || thumbEl.getAttribute("src") : null,
    caption,
    alt: thumbEl ? thumbEl.getAttribute("alt") || "" : "",
  };
}

/**
 * Turn `container`'s thumbnails into a gallery.
 * Any gallery already on that container is torn down first.
 */
export function createGallery(container, options = {}) {
  if (!container) throw new TypeError("createGallery: container is required");
  clearGallery(container);

  const settings = { ...galleryDefaults, ...options };
  const emitter = createEmitter();
  const cleanups = [];

  let items = [];
  let gridCleanup = null;
  let lightbox = null;

  function scan() {
    const found = Array.prototype.slice
      .call(container.querySelectorAll(settings.itemSelector))
      // Never treat the lightbox's own chrome as a gallery item.
      .filter((el) => !el.closest("[data-gallery-lightbox]"));
    return found.map(readItem).filter((it) => it.src);
  }

  function prepareTriggers() {
    items.forEach((it, i) => {
      const t = it.trigger;
      t.dataset.galleryIndex = String(i);
      // A non-link trigger still has to be reachable and operable by keyboard.
      if (t.tagName !== "A" && t.tagName !== "BUTTON") {
        if (!t.hasAttribute("tabindex")) t.setAttribute("tabindex", "0");
        if (!t.hasAttribute("role")) t.setAttribute("role", "button");
      }
      if (!t.hasAttribute("aria-label") && it.caption && !it.thumbEl) {
        t.setAttribute("aria-label", it.caption);
      }
    });
  }

  function indexOfEvent(e) {
    const trigger = e.target.closest("[data-gallery-index]");
    if (!trigger || !container.contains(trigger)) return -1;
    return Number(trigger.dataset.galleryIndex);
  }

  function onClick(e) {
    if (!settings.lightbox) return;
    const i = indexOfEvent(e);
    if (i < 0) return;
    // The href is the fallback for a no-JS visitor; with JS it is ours.
    e.preventDefault();
    controller.open(i);
  }

  function onKeyDown(e) {
    if (!settings.lightbox) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    const i = indexOfEvent(e);
    if (i < 0) return;
    const trigger = e.target.closest("[data-gallery-index]");
    // Links already activate on Enter; only synthesise the missing cases.
    if (trigger.tagName === "A" && e.key === "Enter") return;
    e.preventDefault();
    controller.open(i);
  }

  container.addEventListener("click", onClick);
  container.addEventListener("keydown", onKeyDown);
  cleanups.push(() => container.removeEventListener("click", onClick));
  cleanups.push(() => container.removeEventListener("keydown", onKeyDown));

  function build() {
    if (gridCleanup) {
      gridCleanup();
      gridCleanup = null;
    }
    items = scan();
    prepareTriggers();
    gridCleanup = applyGrid(container, items, settings);
    if (lightbox) lightbox.setItems(items);
    emitter.emit("update", { items });
  }

  build();

  if (settings.observeMutations && typeof MutationObserver !== "undefined") {
    let queued = false;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        build();
      });
    });
    mo.observe(container, { childList: true, subtree: true });
    cleanups.push(() => mo.disconnect());
  }

  function ensureLightbox() {
    if (!lightbox) {
      lightbox = createLightbox(items, settings);
      ["open", "close", "change", "error"].forEach((name) =>
        lightbox.on(name, (payload) => emitter.emit(name, payload))
      );
      lightbox.on("close", () => {
        // Send focus back to the thumbnail the viewer landed on, not the one
        // it started from — otherwise arrowing through images loses your place.
        const item = items[lightbox.index];
        if (item && item.trigger.focus) item.trigger.focus({ preventScroll: true });
      });
    }
    return lightbox;
  }

  const controller = {
    container,
    settings,
    get items() {
      return items.slice();
    },
    get length() {
      return items.length;
    },
    get lightbox() {
      return lightbox;
    },
    get isOpen() {
      return !!lightbox && lightbox.isOpen;
    },
    get index() {
      return lightbox ? lightbox.index : -1;
    },

    open(i) {
      if (!items.length) return controller;
      ensureLightbox().open(i || 0);
      return controller;
    },
    close() {
      if (lightbox) lightbox.close();
      return controller;
    },
    next() {
      if (lightbox) lightbox.next();
      return controller;
    },
    prev() {
      if (lightbox) lightbox.prev();
      return controller;
    },
    goTo(i) {
      if (lightbox) lightbox.goTo(i);
      return controller;
    },

    /** Re-scan the container after adding or removing thumbnails. */
    update() {
      build();
      return controller;
    },

    on(name, fn) {
      const off = emitter.on(name, fn);
      cleanups.push(off);
      return off;
    },

    destroy() {
      teardown(container, GALLERY_KEY);
    },
  };

  const cleanup = function () {
    cleanups.forEach((fn) => fn());
    emitter.clear();
    if (gridCleanup) gridCleanup();
    if (lightbox) lightbox.destroy();
    items.forEach((it) => {
      delete it.trigger.dataset.galleryIndex;
    });
  };

  cleanup.controller = controller;
  container[GALLERY_KEY] = cleanup;
  return controller;
}

/** Get the controller for a container, or null if it has no gallery. */
export function getGallery(container) {
  const handle = container && container[GALLERY_KEY];
  return handle ? handle.controller : null;
}

/** Tear down the gallery on `container` and restore its original DOM. */
export function clearGallery(container) {
  teardown(container, GALLERY_KEY);
}
