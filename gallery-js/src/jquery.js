/*!
 * gallery-js/jquery — jQuery plugin wrapper
 * Kenneth D'silva (Modracx), Copyright (c) 2026
 * Licensed under the MIT License – https://opensource.org/licenses/MIT
 */
import { create, clear, autoInit } from "./index.js";
import { getGallery } from "./gallery.js";

/** Methods that read from the first element instead of iterating the set. */
const READERS = {
  get: (el) => getGallery(el),
  index: (el) => {
    const c = getGallery(el);
    return c ? c.index : -1;
  },
  length: (el) => {
    const c = getGallery(el);
    return c ? c.length : 0;
  },
  isOpen: (el) => {
    const c = getGallery(el);
    return c ? c.isOpen : false;
  },
};

/** Methods forwarded to the controller on every matched element. */
const ACTIONS = {
  open: (c, a) => c.open(a || 0),
  close: (c) => c.close(),
  next: (c) => c.next(),
  prev: (c) => c.prev(),
  goTo: (c, a) => c.goTo(a),
  update: (c) => c.update(),
};

/**
 * Register `$.fn.Gallery` on a jQuery instance.
 * Call this yourself when jQuery is loaded from a CDN as a global instead of
 * being installed as a dependency.
 */
export function registerGalleryPlugin($) {
  if (!$ || !$.fn) {
    throw new TypeError("gallery-js/jquery: a jQuery instance is required");
  }

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
        `gallery-js: unknown method "${method}" — expected one of "create", ` +
          `"clear", ${Object.keys(ACTIONS).concat(Object.keys(READERS)).map((k) => `"${k}"`).join(", ")}`
      );
    });
  };

  // Also exposed as a plain object for callers that skip the plugin wrapper.
  $.Gallery = { create, clear, get: getGallery, autoInit };

  return $;
}

// Auto-register against a global jQuery when one is present (CDN / script tag).
const globalJQuery =
  typeof window !== "undefined" ? window.jQuery || window.$ : undefined;

if (globalJQuery && globalJQuery.fn) {
  registerGalleryPlugin(globalJQuery);
}

export default registerGalleryPlugin;
