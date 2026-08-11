/*!
 * gallery-js — type definitions
 * Kenneth D'silva (Modracx), Copyright (c) 2026
 * Licensed under the MIT License – https://opensource.org/licenses/MIT
 */

export type Layout = "grid" | "masonry" | "none";

export interface GalleryItem {
  /** The element that opens this image. */
  trigger: HTMLElement;
  /** The thumbnail `<img>`, if there is one. */
  thumbEl: HTMLImageElement | null;
  /** Full-size source. */
  src: string;
  /** Thumbnail source. */
  thumb: string | null;
  caption: string;
  alt: string;
}

export interface GalleryOptions {
  /** Which descendants are gallery items. Default "a, [data-gallery-item]". */
  itemSelector?: string;
  /** Open the lightbox when an item is activated. Default true. */
  lightbox?: boolean;
  /** Re-scan when the container's children change. Default true. */
  observeMutations?: boolean;
}

export interface GridOptions {
  /** Default "grid". */
  layout?: Layout;
  /** Column count, or "auto" to fit as many as `minColumnWidth` allows. */
  columns?: number | "auto";
  /** Narrowest a column may get, in px. Default 200. */
  minColumnWidth?: number;
  /** Px between thumbnails. Default 12. */
  gap?: number;
  /** Crop thumbnails to this width/height ratio. `null` keeps them natural. */
  aspectRatio?: number | null;
  /** Thumbnail corner radius, in px. Default 6. */
  radius?: number;
}

export interface LightboxOptions {
  /** Wrap past the ends. Default true. */
  loop?: boolean;
  /** Show the "3 / 12" counter. Default true. */
  counter?: boolean;
  /** Show the caption strip. Default true. */
  captions?: boolean;
  /** Show the prev/next arrows. Default true. */
  arrows?: boolean;
  /** Show the thumbnail strip. Default false. */
  thumbnails?: boolean;
  /** Close on backdrop click. Default true. */
  closeOnBackdrop?: boolean;
  /** Fade duration in ms. Default 200. */
  speed?: number;
  /** Backdrop colour. */
  backdrop?: string;
  /** Allow zooming. Default true. */
  zoom?: boolean;
  /** Double-click zoom level. Default 2.5. */
  zoomScale?: number;
  /** Ceiling for wheel and pinch zoom. Default 6. */
  maxZoom?: number;
  /** Images either side to fetch ahead. Default 1. */
  preload?: number;
  /** Accessible names. */
  labels?: Partial<{
    dialog: string;
    close: string;
    prev: string;
    next: string;
    zoomIn: string;
    zoomOut: string;
  }>;
}

export type Options = GalleryOptions & GridOptions & LightboxOptions;

export type GalleryEvent = "open" | "close" | "change" | "error" | "update";

export interface LightboxController {
  readonly root: HTMLElement;
  readonly index: number;
  readonly isOpen: boolean;
  readonly items: GalleryItem[];
  readonly scale: number;
  setItems(items: GalleryItem[]): LightboxController;
  open(index?: number): LightboxController;
  close(): LightboxController;
  goTo(index: number): LightboxController;
  next(): LightboxController;
  prev(): LightboxController;
  toggleZoom(e?: { clientX?: number; clientY?: number }): LightboxController;
  on(event: GalleryEvent, fn: (payload: any) => void): () => void;
  destroy(): void;
}

export interface GalleryController {
  readonly container: HTMLElement;
  readonly settings: Required<Options>;
  readonly items: GalleryItem[];
  readonly length: number;
  /** Created lazily on first open; null until then. */
  readonly lightbox: LightboxController | null;
  readonly isOpen: boolean;
  /** Active index while open, or -1. */
  readonly index: number;

  open(index?: number): GalleryController;
  close(): GalleryController;
  next(): GalleryController;
  prev(): GalleryController;
  goTo(index: number): GalleryController;
  /** Re-scan after adding or removing thumbnails. */
  update(): GalleryController;
  on(event: GalleryEvent, fn: (payload: any) => void): () => void;
  destroy(): void;
}

export declare const galleryDefaults: Required<GalleryOptions>;
export declare const gridDefaults: Required<GridOptions>;
export declare const lightboxDefaults: Required<LightboxOptions>;
export declare const defaults: Required<Options>;

export declare function create(
  container: HTMLElement,
  options?: Options
): GalleryController;
export declare function clear(container: HTMLElement): void;

export declare function createGallery(
  container: HTMLElement,
  options?: GalleryOptions & GridOptions & LightboxOptions
): GalleryController;
export declare function clearGallery(container: HTMLElement): void;
export declare function getGallery(
  container: HTMLElement
): GalleryController | null;

export declare function createLightbox(
  items: GalleryItem[],
  options?: LightboxOptions
): LightboxController;
export declare function applyGrid(
  container: HTMLElement,
  items: GalleryItem[],
  options?: GridOptions
): () => void;

export declare function prefersReducedMotion(): boolean;
export declare const AUTO_SELECTOR: string;
export declare function readGalleryOptions(el: Element): Options;
export declare function autoInit(root?: ParentNode): GalleryController[];

declare const Gallery: {
  create: typeof create;
  clear: typeof clear;
  get: typeof getGallery;
  autoInit: typeof autoInit;
  defaults: Required<Options>;
  createGallery: typeof createGallery;
  clearGallery: typeof clearGallery;
  createLightbox: typeof createLightbox;
  applyGrid: typeof applyGrid;
  prefersReducedMotion: typeof prefersReducedMotion;
  readGalleryOptions: typeof readGalleryOptions;
};

export default Gallery;
