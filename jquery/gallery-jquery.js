/*!
 * jQuery gallery — thumbnail grid and lightbox
 * Kenneth D'silva (Modracx), Copyright (c) 2026
 * Licensed under the MIT License – https://opensource.org/licenses/MIT
 *
 * Standalone script-tag build. Registers $.fn.Gallery.
 * GENERATED FROM gallery-js/src BY build.mjs — DO NOT EDIT BY HAND.
 */
(function ($) {
  /* ---------------------------------------------------------------- *
   * core.js
   * ---------------------------------------------------------------- */

  /** Teardown handle stashed on the container element. */
  const GALLERY_KEY = Symbol.for("gallery-js.gallery");

  function createElement(tag, style = {}) {
    const el = document.createElement(tag);
    Object.assign(el.style, style);
    return el;
  }

  function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  }

  /** Wrap `i` into [0, length). Handles negatives, unlike a bare `%`. */
  function wrapIndex(i, length) {
    if (!(length > 0)) return 0;
    return ((i % length) + length) % length;
  }

  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

  function prefersReducedMotion() {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  }

  function watchReducedMotion(callback) {
    if (typeof window === "undefined" || !window.matchMedia) return function () {};
    const mq = window.matchMedia(REDUCED_MOTION_QUERY);
    const handler = (e) => callback(e.matches);
    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }

  /** The smallest event emitter that does the job. */
  function createEmitter() {
    const handlers = Object.create(null);
    return {
      on(name, fn) {
        (handlers[name] || (handlers[name] = [])).push(fn);
        return function off() {
          const list = handlers[name];
          if (!list) return;
          const i = list.indexOf(fn);
          if (i !== -1) list.splice(i, 1);
        };
      },
      emit(name, payload) {
        const list = handlers[name];
        if (!list) return;
        // Copy first: a handler is allowed to unsubscribe itself.
        list.slice().forEach((fn) => fn(payload));
      },
      clear() {
        Object.keys(handlers).forEach((k) => delete handlers[k]);
      },
    };
  }

  const FOCUSABLE = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");

  /**
   * Keep Tab inside `root` while it is open, and hand focus back to whatever had
   * it when the trap is released. A modal that leaks focus to the page behind is
   * unusable with a screen reader.
   */
  function trapFocus(root) {
    const previouslyFocused = document.activeElement;

    function onKeyDown(e) {
      if (e.key !== "Tab") return;
      const items = Array.prototype.slice
        .call(root.querySelectorAll(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    root.addEventListener("keydown", onKeyDown);

    return function release() {
      root.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused && previouslyFocused.focus) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }

  /**
   * Stop the page behind a modal from scrolling, compensating for the
   * scrollbar's width so the layout does not jump as it disappears.
   */
  function lockScroll() {
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (gap > 0) {
      const current = parseFloat(getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = current + gap + "px";
    }

    return function unlock() {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }

  /** Run and drop the teardown stored under `key`, if any. */
  function teardown(container, key) {
    if (container && container[key]) {
      container[key]();
      delete container[key];
    }
  }

  /* ---------------------------------------------------------------- *
   * grid.js
   * ---------------------------------------------------------------- */

  const gridDefaults = {
    /** "grid" lays the thumbnails out in even columns, "masonry" packs them by
     *  height, "none" leaves your own CSS alone. */
    layout: "grid",
    /** Column count, or "auto" to fit as many as `minColumnWidth` allows. */
    columns: "auto",
    /** Narrowest a column may get before the count drops, in px. */
    minColumnWidth: 200,
    /** Px between thumbnails. */
    gap: 12,
    /**
     * Crop thumbnails to this width/height ratio — `1` for squares, `16/9` for
     * widescreen. `null` keeps each image's natural proportions.
     */
    aspectRatio: null,
    /** Round the thumbnail corners, in px. */
    radius: 6,
  };

  const LAYOUTS = ["grid", "masonry", "none"];

  /**
   * Lay the gallery's triggers out. Returns a cleanup that restores whatever the
   * container and items looked like first.
   */
  function applyGrid(container, items, options = {}) {
    const settings = { ...gridDefaults, ...options };
    if (LAYOUTS.indexOf(settings.layout) === -1) {
      throw new TypeError(
        `applyGrid: layout must be one of ${LAYOUTS.join(", ")}, got "${settings.layout}"`
      );
    }
    if (settings.layout === "none") return function () {};

    const savedContainer = container.getAttribute("style");
    const savedItems = items.map((it) => it.trigger.getAttribute("style"));
    const savedImages = items.map((it) =>
      it.thumbEl ? it.thumbEl.getAttribute("style") : null
    );

    if (settings.layout === "masonry") {
      // CSS multi-column is the only masonry that needs no measurement. The
      // trade-off is reading order: columns fill top-to-bottom, so item 2 sits
      // below item 1 rather than beside it.
      Object.assign(container.style, {
        columnCount: settings.columns === "auto" ? "" : String(settings.columns),
        columnWidth: settings.columns === "auto" ? settings.minColumnWidth + "px" : "",
        columnGap: settings.gap + "px",
      });
    } else {
      Object.assign(container.style, {
        display: "grid",
        gap: settings.gap + "px",
        gridTemplateColumns:
          settings.columns === "auto"
            ? `repeat(auto-fill, minmax(${settings.minColumnWidth}px, 1fr))`
            : `repeat(${settings.columns}, minmax(0, 1fr))`,
      });
    }

    items.forEach((it) => {
      Object.assign(it.trigger.style, {
        display: "block",
        position: "relative",
        overflow: "hidden",
        borderRadius: settings.radius + "px",
        cursor: "zoom-in",
        ...(settings.layout === "masonry"
          ? { breakInside: "avoid", marginBottom: settings.gap + "px" }
          : null),
        ...(settings.aspectRatio && settings.layout === "grid"
          ? { aspectRatio: String(settings.aspectRatio) }
          : null),
      });

      if (it.thumbEl) {
        Object.assign(it.thumbEl.style, {
          display: "block",
          width: "100%",
          height: settings.aspectRatio && settings.layout === "grid" ? "100%" : "auto",
          objectFit: "cover",
        });
      }
    });

    return function cleanup() {
      if (savedContainer === null) container.removeAttribute("style");
      else container.setAttribute("style", savedContainer);

      items.forEach((it, i) => {
        if (savedItems[i] === null) it.trigger.removeAttribute("style");
        else it.trigger.setAttribute("style", savedItems[i]);
        if (it.thumbEl) {
          if (savedImages[i] === null) it.thumbEl.removeAttribute("style");
          else it.thumbEl.setAttribute("style", savedImages[i]);
        }
      });
    };
  }

  /* ---------------------------------------------------------------- *
   * lightbox.js
   * ---------------------------------------------------------------- */

  const lightboxDefaults = {
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
  function createLightbox(items, options = {}) {
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

  /* ---------------------------------------------------------------- *
   * gallery.js
   * ---------------------------------------------------------------- */

  const galleryDefaults = {
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
  function createGallery(container, options = {}) {
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
  function getGallery(container) {
    const handle = container && container[GALLERY_KEY];
    return handle ? handle.controller : null;
  }

  /** Tear down the gallery on `container` and restore its original DOM. */
  function clearGallery(container) {
    teardown(container, GALLERY_KEY);
  }

  /* ---------------------------------------------------------------- *
   * autoinit.js
   * ---------------------------------------------------------------- */

  /** Elements carrying this attribute are picked up by autoInit(). */
  const AUTO_SELECTOR = "[data-gallery]";

  /** Our own markers, which must never be read back as options. */
  const RESERVED = ["gallery", "galleryItem", "galleryIndex", "galleryLightbox"];

  /** "3" -> 3, "false" -> false, "" -> true, JSON -> object, "auto" -> "auto". */
  function coerce(raw) {
    if (raw === "") return true; // bare `data-gallery-thumbnails` reads as on
    if (raw === "true") return true;
    if (raw === "false") return false;
    if (raw === "null") return null;

    // Structured values such as breakpoints have to survive a data attribute.
    const trimmed = raw.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        throw new SyntaxError(`gallery-js: expected JSON in a data attribute, got ${raw}`);
      }
    }

    const n = Number(raw);
    return trimmed !== "" && !Number.isNaN(n) ? n : raw;
  }

  /** galleryMinColumnWidth -> minColumnWidth */
  function optionName(datasetKey) {
    const rest = datasetKey.slice("gallery".length);
    return rest.charAt(0).toLowerCase() + rest.slice(1);
  }

  /**
   * Read options off an element's data attributes.
   *
   * `data-gallery` may hold a JSON object; individual `data-gallery-*` attributes
   * are merged over it, which is easier to produce from a CMS field than
   * embedded JSON:
   *
   *   <div data-gallery='{"columns":4}' data-gallery-thumbnails>
   *   <div data-gallery data-gallery-columns="3" data-gallery-aspect-ratio="1">
   */
  function readGalleryOptions(el) {
    const options = {};

    const json = el.getAttribute("data-gallery");
    if (json && json.trim() && json.trim() !== "true") {
      try {
        Object.assign(options, JSON.parse(json));
      } catch (e) {
        throw new SyntaxError(
          `gallery-js: data-gallery is not valid JSON on <${el.tagName.toLowerCase()}> — ` +
            `received ${json}`
        );
      }
    }

    Object.keys(el.dataset).forEach((key) => {
      if (!key.startsWith("gallery") || RESERVED.indexOf(key) !== -1) return;
      options[optionName(key)] = coerce(el.dataset[key]);
    });

    return options;
  }

  /** Elements under `root` that want a gallery and do not already have one. */
  function autoTargets(root, hasGallery) {
    const scope = root || document;
    const found = [];
    if (scope.matches && scope.matches(AUTO_SELECTOR)) found.push(scope);
    if (scope.querySelectorAll) {
      Array.prototype.push.apply(
        found,
        Array.prototype.slice.call(scope.querySelectorAll(AUTO_SELECTOR))
      );
    }
    // Skip anything already initialised so autoInit is safe to call repeatedly.
    return found.filter((el) => !hasGallery(el));
  }

  const defaults = Object.assign({}, galleryDefaults, gridDefaults, lightboxDefaults);

  function create(container, options) {
    const opts = options || {};
    const settings = Object.assign({}, defaults, opts);

    return createGallery(container, settings);
  }

  function clear(container) {
    clearGallery(container);
  }

  function autoInit(root) {
    return autoTargets(root, getGallery).map(function (el) {
      return create(el, readGalleryOptions(el));
    });
  }

  // Declarative setup: anything with [data-gallery] starts on its own.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      autoInit(document);
    });
  } else {
    autoInit(document);
  }

  const READERS = {
    get: function (el) {
      return getGallery(el);
    },
    index: function (el) {
      const c = getGallery(el);
      return c ? c.index : -1;
    },
    length: function (el) {
      const c = getGallery(el);
      return c ? c.length : 0;
    },
    isOpen: function (el) {
      const c = getGallery(el);
      return c ? c.isOpen : false;
    },
  };

  const ACTIONS = {
    open: function (c, a) {
      c.open(a || 0);
    },
    close: function (c) {
      c.close();
    },
    next: function (c) {
      c.next();
    },
    prev: function (c) {
      c.prev();
    },
    goTo: function (c, a) {
      c.goTo(a);
    },
    update: function (c) {
      c.update();
    },
  };

  $.fn.Gallery = function (method, a) {
    if (READERS[method]) {
      return this.length ? READERS[method](this[0]) : null;
    }

    return this.each(function () {
      if (method === "create" || method === undefined) {
        create(this, a);
        return;
      }
      if (method === "clear" || method === "destroy") {
        clear(this);
        return;
      }
      if (ACTIONS[method]) {
        const controller = getGallery(this);
        if (!controller) {
          throw new Error(
            'gallery-js: no gallery on this element — call .Gallery("create") first'
          );
        }
        ACTIONS[method](controller, a);
        return;
      }
      throw new Error(
        'gallery-js: unknown method "' + method + '" — expected one of "create", ' +
          '"clear", ' +
          Object.keys(ACTIONS)
            .concat(Object.keys(READERS))
            .map(function (k) {
              return '"' + k + '"';
            })
            .join(", ")
      );
    });
  };

  // Also exposed as a plain object for callers that skip the plugin wrapper.
  $.Gallery = {
    create: create,
    clear: clear,
    get: getGallery,
    autoInit: autoInit,
    defaults: defaults,
    createGallery: createGallery,
    clearGallery: clearGallery,
    createLightbox: createLightbox,
    applyGrid: applyGrid,
    prefersReducedMotion: prefersReducedMotion,
    readGalleryOptions: readGalleryOptions,
  };
})(jQuery);
