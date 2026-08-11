/*!
 * gallery-js — shared internals
 * Kenneth D'silva (Modracx), Copyright (c) 2026
 * Licensed under the MIT License – https://opensource.org/licenses/MIT
 */

/** Teardown handle stashed on the container element. */
export const GALLERY_KEY = Symbol.for("gallery-js.gallery");

export function createElement(tag, style = {}) {
  const el = document.createElement(tag);
  Object.assign(el.style, style);
  return el;
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Wrap `i` into [0, length). Handles negatives, unlike a bare `%`. */
export function wrapIndex(i, length) {
  if (!(length > 0)) return 0;
  return ((i % length) + length) % length;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function watchReducedMotion(callback) {
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
export function createEmitter() {
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
export function trapFocus(root) {
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
export function lockScroll() {
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
export function teardown(container, key) {
  if (container && container[key]) {
    container[key]();
    delete container[key];
  }
}
