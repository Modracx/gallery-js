/*!
 * gallery-js/autoinit — declarative setup from data attributes
 * Kenneth D'silva (Modracx), Copyright (c) 2026
 * Licensed under the MIT License – https://opensource.org/licenses/MIT
 */

/** Elements carrying this attribute are picked up by autoInit(). */
export const AUTO_SELECTOR = "[data-gallery]";

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
export function readGalleryOptions(el) {
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
export function autoTargets(root, hasGallery) {
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
