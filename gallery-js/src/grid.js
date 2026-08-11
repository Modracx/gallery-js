/*!
 * gallery-js/grid — thumbnail layout
 * Kenneth D'silva (Modracx), Copyright (c) 2026
 * Licensed under the MIT License – https://opensource.org/licenses/MIT
 */

export const gridDefaults = {
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
export function applyGrid(container, items, options = {}) {
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
