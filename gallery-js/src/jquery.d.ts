/*!
 * gallery-js/jquery — type definitions
 * Kenneth D'silva (Modracx), Copyright (c) 2026
 * Licensed under the MIT License – https://opensource.org/licenses/MIT
 */
import type { GalleryController, Options } from "./index.js";

declare global {
  interface JQuery {
    Gallery(method: "create", options?: Options): JQuery;
    Gallery(method: "clear" | "destroy" | "close" | "next" | "prev" | "update"): JQuery;
    Gallery(method: "open" | "goTo", index?: number): JQuery;
    Gallery(method: "get"): GalleryController | null;
    Gallery(method: "index" | "length"): number;
    Gallery(method: "isOpen"): boolean;
  }
}

export declare function registerGalleryPlugin<T>($: T): T;
export default registerGalleryPlugin;
