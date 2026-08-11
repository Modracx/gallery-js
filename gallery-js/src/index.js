/*!
 * gallery-js
 * Kenneth D'silva (Modracx), Copyright (c) 2026
 * Licensed under the MIT License – https://opensource.org/licenses/MIT
 */
import {
  createGallery,
  clearGallery,
  getGallery,
  galleryDefaults,
} from "./gallery.js";
import { applyGrid, gridDefaults } from "./grid.js";
import { createLightbox, lightboxDefaults } from "./lightbox.js";
import { AUTO_SELECTOR, autoTargets, readGalleryOptions } from "./autoinit.js";
import { prefersReducedMotion } from "./core.js";

export {
  createGallery,
  clearGallery,
  getGallery,
  createLightbox,
  applyGrid,
  prefersReducedMotion,
  readGalleryOptions,
  AUTO_SELECTOR,
  galleryDefaults,
  gridDefaults,
  lightboxDefaults,
};

export const defaults = {
  ...galleryDefaults,
  ...gridDefaults,
  ...lightboxDefaults,
};

/**
 * Build a gallery inside `container`: lay the thumbnails out and wire them to
 * a lightbox. Any gallery already on that container is torn down first.
 */
export function create(container, options = {}) {
  return createGallery(container, { ...defaults, ...options });
}

/** Tear down the gallery on `container` and restore its original DOM. */
export function clear(container) {
  clearGallery(container);
}

/**
 * Build a gallery on every `[data-gallery]` element under `root`, reading its
 * options from data attributes. Already-initialised elements are skipped.
 */
export function autoInit(root) {
  return autoTargets(root, getGallery).map((el) =>
    create(el, readGalleryOptions(el))
  );
}

const Gallery = {
  create,
  clear,
  get: getGallery,
  autoInit,
  defaults,
  // granular control
  createGallery,
  clearGallery,
  createLightbox,
  applyGrid,
  // helpers
  prefersReducedMotion,
  readGalleryOptions,
};

export default Gallery;
