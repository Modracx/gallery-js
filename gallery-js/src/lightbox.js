/*!
 * gallery-js/lightbox — the fullscreen viewer
 * Kenneth D'silva (Modracx), Copyright (c) 2026
 * Licensed under the MIT License – https://opensource.org/licenses/MIT
 */
import {
  clamp,
  createElement,
  createEmitter,
  lockScroll,
  prefersReducedMotion,
  trapFocus,
  wrapIndex,
} from "./core.js";

export const lightboxDefaults = {
  /** Wrap from the last image back to the first. */
  loop: true,
  /** Show the "3 / 12" counter. */
  counter: true,
  /** Show the caption strip. */
  captions: true,
  /** Show the prev/next arrows. */
  arrows: true,
  /** Show the thumbnail strip along the bottom. */
  thumbnails: false,
  /** Close when the backdrop behind the image is clicked. */
  closeOnBackdrop: true,
  /** Fade duration in ms. Ignored under reduced motion. */
  speed: 200,
  /** Backdrop colour. */
  backdrop: "rgba(8, 8, 10, 0.94)",
  /** Allow zooming into the image. */
  zoom: true,
  /** How far a double-click or zoom button goes. */
  zoomScale: 2.5,
  /** Ceiling for wheel and pinch zoom. */
  maxZoom: 6,
  /** Images either side of the current one to fetch ahead of time. */
  preload: 1,
  /** Accessible names. */
  labels: {
    dialog: "Image gallery",
    close: "Close gallery",
    prev: "Previous image",
    next: "Next image",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
  },
};

/** Drag further than this and a release navigates rather than springs back. */
const SWIPE_RATIO = 0.18;
/** Vertical drag past this closes the viewer. */
const DISMISS_PX = 110;

const BTN = {
  position: "absolute",
  zIndex: "3",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "44px",
  height: "44px",
  padding: "0",
  borderRadius: "50%",
  border: "1px solid rgba(255, 255, 255, 0.18)",
  background: "rgba(0, 0, 0, 0.42)",
  color: "#fff",
  font: "inherit",
  fontSize: "18px",
  lineHeight: "1",
  cursor: "pointer",
};

/**
 * Build a reusable lightbox over `items`. The DOM is created once and kept
 * hidden between openings — rebuilding it every time would drop the browser's
 * decoded-image cache along with it.
 */
export function createLightbox(items, options = {}) {
  const settings = { ...lightboxDefaults, ...options };
  const emitter = createEmitter();

  let index = 0;
  let open = false;
  let releaseFocus = null;
  let unlockScroll = null;
  let scale = 1;
  let panX = 0;
  let panY = 0;
  let drag = null;
  let hideTimer = null; // pending display:none from a fade-out
  let pointers = new Map();
  let pinchStart = 0;
  const preloaded = new Set();

  const reduced = () => prefersReducedMotion();
  const ms = () => (reduced() ? 0 : settings.speed);

  /* ------------------------------------------------------------------ *
   * DOM
   * ------------------------------------------------------------------ */

  const root = createElement("div", {
    position: "fixed",
    inset: "0",
    zIndex: "2147483000",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    opacity: "0",
    // The backdrop lives on the root so the whole thing fades as one.
    background: settings.backdrop,
    touchAction: "none",
    userSelect: "none",
  });
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", settings.labels.dialog);
  root.dataset.galleryLightbox = "";

  const stage = createElement("div", {
    position: "absolute",
    inset: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  });
  root.appendChild(stage);

  const figure = createElement("figure", {
    margin: "0",
    maxWidth: "92vw",
    maxHeight: "88vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  });
  stage.appendChild(figure);

  const image = createElement("img", {
    display: "block",
    maxWidth: "92vw",
    maxHeight: "88vh",
    objectFit: "contain",
    transformOrigin: "center center",
    willChange: "transform",
    cursor: "zoom-in",
    // The browser's own drag would fight the pan gesture.
    webkitUserDrag: "none",
  });
  image.draggable = false;
  figure.appendChild(image);

  const spinner = createElement("div", {
    position: "absolute",
    width: "34px",
    height: "34px",
    border: "3px solid rgba(255, 255, 255, 0.25)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    display: "none",
    animation: "gallery-js-spin 700ms linear infinite",
  });
  stage.appendChild(spinner);

  // One stylesheet for the only thing inline styles cannot express.
  const style = createElement("style");
  style.textContent = "@keyframes gallery-js-spin{to{transform:rotate(360deg)}}";
  root.appendChild(style);

  const closeBtn = createElement("button", { ...BTN, top: "12px", right: "12px" });
  closeBtn.type = "button";
  closeBtn.textContent = "✕";
  closeBtn.setAttribute("aria-label", settings.labels.close);
  root.appendChild(closeBtn);

  let prevBtn = null;
  let nextBtn = null;
  if (settings.arrows) {
    prevBtn = createElement("button", { ...BTN, left: "12px", top: "50%", marginTop: "-22px" });
    prevBtn.type = "button";
    prevBtn.textContent = "‹";
    prevBtn.setAttribute("aria-label", settings.labels.prev);
    root.appendChild(prevBtn);

    nextBtn = createElement("button", { ...BTN, right: "12px", top: "50%", marginTop: "-22px" });
    nextBtn.type = "button";
    nextBtn.textContent = "›";
    nextBtn.setAttribute("aria-label", settings.labels.next);
    root.appendChild(nextBtn);
  }

  let counterEl = null;
  if (settings.counter) {
    counterEl = createElement("div", {
      position: "absolute",
      top: "18px",
      left: "18px",
      zIndex: "3",
      color: "rgba(255, 255, 255, 0.82)",
      font: "13px/1 ui-monospace, SFMono-Regular, Menlo, monospace",
    });
    root.appendChild(counterEl);
  }

  let captionEl = null;
  if (settings.captions) {
    captionEl = createElement("figcaption", {
      position: "absolute",
      left: "0",
      right: "0",
      bottom: "0",
      zIndex: "3",
      padding: "16px 64px",
      textAlign: "center",
      color: "#fff",
      font: "14px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)",
      pointerEvents: "none",
    });
    root.appendChild(captionEl);
  }

  let thumbBar = null;
  if (settings.thumbnails) {
    thumbBar = createElement("div", {
      position: "absolute",
      left: "0",
      right: "0",
      bottom: "0",
      zIndex: "4",
      display: "flex",
      gap: "8px",
      padding: "10px",
      justifyContent: "center",
      overflowX: "auto",
      background: "rgba(0, 0, 0, 0.35)",
    });
    thumbBar.setAttribute("role", "tablist");
    thumbBar.setAttribute("aria-label", "Choose image");
    root.appendChild(thumbBar);
    if (captionEl) captionEl.style.bottom = "84px";
  }

  // A polite live region: the image itself is swapped, which a screen reader
  // has no other way of noticing.
  const live = createElement("div", {
    position: "absolute",
    width: "1px",
    height: "1px",
    margin: "-1px",
    overflow: "hidden",
    clipPath: "inset(50%)",
  });
  live.setAttribute("aria-live", "polite");
  root.appendChild(live);

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */

  function current() {
    return items[index];
  }

  function applyTransform(instant) {
    image.style.transition =
      instant || reduced() ? "none" : `transform ${ms()}ms ease-out`;
    image.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${scale})`;
    image.style.cursor = !settings.zoom
      ? "default"
      : scale > 1
      ? "grab"
      : "zoom-in";
  }

  function resetZoom(instant) {
    scale = 1;
    panX = 0;
    panY = 0;
    applyTransform(instant);
  }

  /** Keep the image from being panned entirely outside the viewport. */
  function clampPan() {
    const rect = image.getBoundingClientRect();
    const overX = Math.max(0, (rect.width - window.innerWidth) / 2);
    const overY = Math.max(0, (rect.height - window.innerHeight) / 2);
    panX = clamp(panX, -overX, overX);
    panY = clamp(panY, -overY, overY);
  }

  function preloadAround(i) {
    for (let d = 1; d <= settings.preload; d++) {
      [i - d, i + d].forEach((n) => {
        const at = settings.loop ? wrapIndex(n, items.length) : n;
        if (at < 0 || at >= items.length) return;
        const src = items[at].src;
        if (!src || preloaded.has(src)) return;
        preloaded.add(src);
        const pre = new Image();
        pre.src = src;
      });
    }
  }

  function render() {
    const item = current();
    if (!item) return;

    resetZoom(true);
    spinner.style.display = "block";
    image.style.opacity = "0";

    image.onload = function () {
      spinner.style.display = "none";
      image.style.transition = reduced() ? "none" : `opacity ${ms()}ms ease-out`;
      image.style.opacity = "1";
    };
    image.onerror = function () {
      spinner.style.display = "none";
      image.style.opacity = "1";
      image.alt = "This image could not be loaded";
      emitter.emit("error", { index, item });
    };

    image.src = item.src;
    image.alt = item.alt || item.caption || "";

    if (counterEl) counterEl.textContent = `${index + 1} / ${items.length}`;
    if (captionEl) {
      captionEl.textContent = item.caption || "";
      captionEl.style.display = item.caption ? "block" : "none";
    }
    live.textContent = `Image ${index + 1} of ${items.length}${
      item.caption ? ": " + item.caption : ""
    }`;

    if (prevBtn) {
      const atStart = !settings.loop && index === 0;
      const atEnd = !settings.loop && index === items.length - 1;
      prevBtn.disabled = atStart;
      nextBtn.disabled = atEnd;
      prevBtn.style.opacity = atStart ? "0.3" : "1";
      nextBtn.style.opacity = atEnd ? "0.3" : "1";
    }

    syncThumbs();
    preloadAround(index);
    emitter.emit("change", { index, item });
  }

  function buildThumbs() {
    if (!thumbBar) return;
    thumbBar.textContent = "";
    items.forEach((item, i) => {
      const t = createElement("button", {
        flex: "0 0 auto",
        width: "56px",
        height: "42px",
        padding: "0",
        border: "2px solid transparent",
        borderRadius: "4px",
        overflow: "hidden",
        cursor: "pointer",
        background: "#222",
      });
      t.type = "button";
      t.setAttribute("role", "tab");
      t.setAttribute("aria-label", `Image ${i + 1}`);
      const img = createElement("img", {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
      });
      img.src = item.thumb || item.src;
      img.alt = "";
      t.appendChild(img);
      t.addEventListener("click", () => controller.goTo(i));
      thumbBar.appendChild(t);
    });
  }

  function syncThumbs() {
    if (!thumbBar) return;
    Array.prototype.slice.call(thumbBar.children).forEach((t, i) => {
      const on = i === index;
      t.style.borderColor = on ? "#fff" : "transparent";
      t.style.opacity = on ? "1" : "0.55";
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
  }

  /* ------------------------------------------------------------------ *
   * Gestures
   * ------------------------------------------------------------------ */

  function pointerDistance() {
    const pts = Array.from(pointers.values());
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      pinchStart = pointerDistance() / scale;
      drag = null;
      return;
    }
    drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      panX,
      panY,
      moved: false,
      zoomed: scale > 1,
    };
    stage.setPointerCapture(e.pointerId);
  });

  stage.addEventListener("pointermove", (e) => {
    if (pointers.has(e.pointerId)) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pointers.size === 2 && settings.zoom && pinchStart) {
      scale = clamp(pointerDistance() / pinchStart, 1, settings.maxZoom);
      clampPan();
      applyTransform(true);
      return;
    }

    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;

    if (drag.zoomed) {
      // Zoomed in, so the gesture pans the image instead of navigating.
      panX = drag.panX + dx;
      panY = drag.panY + dy;
      clampPan();
      applyTransform(true);
      return;
    }

    // Not zoomed: horizontal drags preview the next image, vertical drags
    // preview dismissal, and the dominant axis wins.
    const horizontal = Math.abs(dx) > Math.abs(dy);
    image.style.transition = "none";
    if (horizontal) {
      image.style.transform = `translate3d(${dx}px, 0, 0) scale(1)`;
      root.style.opacity = "1";
    } else {
      const fade = clamp(1 - Math.abs(dy) / (DISMISS_PX * 3), 0.35, 1);
      image.style.transform = `translate3d(0, ${dy}px, 0) scale(${fade})`;
      root.style.opacity = String(fade);
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = 0;
    if (!drag || e.pointerId !== drag.id) return;

    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    const wasMoved = drag.moved;
    const wasZoomed = drag.zoomed;
    drag = null;
    if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);

    if (wasZoomed) return;

    if (!wasMoved) {
      // A clean tap: zoom if it landed on the image, close if on the backdrop.
      if (e.target === image && settings.zoom) controller.toggleZoom(e);
      else if (settings.closeOnBackdrop && e.target !== image) controller.close();
      return;
    }

    const horizontal = Math.abs(dx) > Math.abs(dy);
    if (!horizontal && Math.abs(dy) > DISMISS_PX) {
      controller.close();
      return;
    }
    if (horizontal && Math.abs(dx) > window.innerWidth * SWIPE_RATIO) {
      dx < 0 ? controller.next() : controller.prev();
      return;
    }
    root.style.opacity = "1";
    applyTransform(false);
  }

  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);

  stage.addEventListener(
    "wheel",
    (e) => {
      if (!settings.zoom || !open) return;
      e.preventDefault();
      const next = clamp(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, settings.maxZoom);
      scale = next;
      if (scale === 1) {
        panX = 0;
        panY = 0;
      }
      clampPan();
      applyTransform(true);
    },
    { passive: false }
  );

  image.addEventListener("dblclick", (e) => {
    if (settings.zoom) controller.toggleZoom(e);
  });

  /* ------------------------------------------------------------------ *
   * Wiring
   * ------------------------------------------------------------------ */

  closeBtn.addEventListener("click", () => controller.close());
  if (prevBtn) {
    prevBtn.addEventListener("click", () => controller.prev());
    nextBtn.addEventListener("click", () => controller.next());
  }

  function onKeyDown(e) {
    if (!open) return;
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        controller.close();
        break;
      case "ArrowLeft":
        e.preventDefault();
        controller.prev();
        break;
      case "ArrowRight":
        e.preventDefault();
        controller.next();
        break;
      case "Home":
        e.preventDefault();
        controller.goTo(0);
        break;
      case "End":
        e.preventDefault();
        controller.goTo(items.length - 1);
        break;
      default:
    }
  }

  document.addEventListener("keydown", onKeyDown);

  const controller = {
    root,
    get index() {
      return index;
    },
    get isOpen() {
      return open;
    },
    get items() {
      return items;
    },
    get scale() {
      return scale;
    },

    /** Replace the item list, e.g. after the gallery's DOM changed. */
    setItems(next) {
      items = next;
      buildThumbs();
      if (open) {
        index = clamp(index, 0, Math.max(0, items.length - 1));
        render();
      }
      return controller;
    },

    open(at) {
      if (!items.length) return controller;
      index = clamp(at || 0, 0, items.length - 1);
      if (!root.isConnected) document.body.appendChild(root);

      // A close still fading out has a display:none queued behind it. Reopening
      // inside that window would otherwise be hidden by the stale timer.
      if (hideTimer !== null) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }

      open = true;
      root.style.display = "flex";
      unlockScroll = lockScroll();
      render();

      // Fade in on the next frame so the display change has committed.
      requestAnimationFrame(() => {
        root.style.transition = reduced() ? "none" : `opacity ${ms()}ms ease-out`;
        root.style.opacity = "1";
      });

      releaseFocus = trapFocus(root);
      closeBtn.focus({ preventScroll: true });
      emitter.emit("open", { index, item: current() });
      return controller;
    },

    close() {
      if (!open) return controller;
      open = false;
      root.style.transition = reduced() ? "none" : `opacity ${ms()}ms ease-out`;
      root.style.opacity = "0";

      const finish = function () {
        hideTimer = null;
        root.style.display = "none";
        resetZoom(true);
      };
      if (reduced() || !settings.speed) finish();
      else hideTimer = setTimeout(finish, settings.speed);

      if (unlockScroll) {
        unlockScroll();
        unlockScroll = null;
      }
      if (releaseFocus) {
        releaseFocus();
        releaseFocus = null;
      }
      emitter.emit("close", { index });
      return controller;
    },

    goTo(i) {
      if (!items.length) return controller;
      const next = settings.loop ? wrapIndex(i, items.length) : clamp(i, 0, items.length - 1);
      if (next === index) return controller;
      index = next;
      root.style.opacity = "1";
      render();
      return controller;
    },
    next() {
      if (!settings.loop && index === items.length - 1) {
        applyTransform(false);
        return controller;
      }
      return controller.goTo(index + 1);
    },
    prev() {
      if (!settings.loop && index === 0) {
        applyTransform(false);
        return controller;
      }
      return controller.goTo(index - 1);
    },

    toggleZoom(e) {
      if (!settings.zoom) return controller;
      if (scale > 1) {
        resetZoom(false);
        return controller;
      }
      scale = settings.zoomScale;
      if (e && e.clientX != null) {
        // Zoom toward the point that was clicked rather than the centre.
        const rect = image.getBoundingClientRect();
        const cx = e.clientX - (rect.left + rect.width / 2);
        const cy = e.clientY - (rect.top + rect.height / 2);
        panX = -cx * (scale - 1);
        panY = -cy * (scale - 1);
      }
      clampPan();
      applyTransform(false);
      return controller;
    },

    on(name, fn) {
      return emitter.on(name, fn);
    },

    destroy() {
      if (hideTimer !== null) clearTimeout(hideTimer);
      document.removeEventListener("keydown", onKeyDown);
      if (unlockScroll) unlockScroll();
      if (releaseFocus) releaseFocus();
      emitter.clear();
      root.remove();
    },
  };

  buildThumbs();
  return controller;
}
