#!/usr/bin/env node
/*!
 * gallery-js build — generates the standalone script-tag builds from src/.
 *
 * The ES modules in gallery-js/src are written so they can be concatenated:
 * imports only ever appear at the top of a file, exports are only ever
 * `export function` / `export const` declarations, and every top-level name is
 * unique across the whole source tree. Stripping the module syntax and joining
 * the files in dependency order therefore produces valid script.
 *
 * Run: node build.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, "gallery-js", "src");

/** Dependency order. core has no imports; index composes all the layers. */
const MODULES = [
  "core.js",
  "grid.js",
  "lightbox.js",
  "gallery.js",
  "autoinit.js",
];

/** Drop the module syntax, keep the declarations. */
function stripModuleSyntax(code) {
  return (
    code
      // `import { a, b } from "./x.js";`, including multi-line forms
      .replace(/^import\s[\s\S]*?from\s*["'][^"']+["'];?[ \t]*$/gm, "")
      // `export function f(` / `export const x =` -> keep the declaration
      .replace(/^export\s+(?=(?:async\s+)?(?:function|const|let|var|class)\b)/gm, "")
      // `export { a, b };` re-export lists
      .replace(/^export\s*\{[\s\S]*?\}\s*;?[ \t]*$/gm, "")
      // `export default X;`
      .replace(/^export\s+default\s[\s\S]*?;[ \t]*$/gm, "")
      .trim()
  );
}

/** Strip the `/*! ... *\/` banner; the bundle carries its own. */
function stripBanner(code) {
  return code.replace(/^\/\*![\s\S]*?\*\/\s*/, "");
}

async function loadBody() {
  const parts = [];
  for (const name of MODULES) {
    const raw = await readFile(join(src, name), "utf8");
    const body = stripModuleSyntax(stripBanner(raw));
    parts.push(
      `  /* ---------------------------------------------------------------- *\n` +
        `   * ${name}\n` +
        `   * ---------------------------------------------------------------- */\n\n` +
        body
          .split("\n")
          .map((line) => (line.trim() ? "  " + line : ""))
          .join("\n")
    );
  }
  return parts.join("\n\n");
}

const SHARED_COMPOSE = `
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
`;

const VANILLA_TAIL = `
  window.Gallery = {
    create: create,
    clear: clear,
    get: getGallery,
    autoInit: autoInit,
    defaults: defaults,
    // granular control
    createGallery: createGallery,
    clearGallery: clearGallery,
    createLightbox: createLightbox,
    applyGrid: applyGrid,
    // helpers
    prefersReducedMotion: prefersReducedMotion,
    readGalleryOptions: readGalleryOptions,
  };
})();
`;

const JQUERY_TAIL = `
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
`;

function banner(title, note) {
  return (
    `/*!\n` +
    ` * ${title}\n` +
    ` * Kenneth D'silva (Modracx), Copyright (c) 2026\n` +
    ` * Licensed under the MIT License – https://opensource.org/licenses/MIT\n` +
    ` *\n` +
    ` * ${note}\n` +
    ` * GENERATED FROM gallery-js/src BY build.mjs — DO NOT EDIT BY HAND.\n` +
    ` */\n`
  );
}

const body = await loadBody();

await writeFile(
  join(root, "vanilla", "gallery-vanilla.js"),
  banner(
    "vanilla js gallery — thumbnail grid and lightbox",
    "Standalone script-tag build. Attaches window.Gallery."
  ) +
    "(function () {\n" +
    body +
    "\n" +
    SHARED_COMPOSE +
    VANILLA_TAIL,
  "utf8"
);

await writeFile(
  join(root, "jquery", "gallery-jquery.js"),
  banner(
    "jQuery gallery — thumbnail grid and lightbox",
    "Standalone script-tag build. Registers $.fn.Gallery."
  ) +
    "(function ($) {\n" +
    body +
    "\n" +
    SHARED_COMPOSE +
    JQUERY_TAIL,
  "utf8"
);

console.log("built vanilla/gallery-vanilla.js and jquery/gallery-jquery.js");
