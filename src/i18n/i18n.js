// src/i18n/i18n.js — Internationalization engine for Pokémon Arena
//
// Usage:
//   import { t, initLocale, setLocale, getLocale, onChange } from './i18n/i18n.js';
//   await initLocale();               // detect browser language & load
//   t('ui.brand')                     // => 'Pokémon Arena' or '포켓몬 아레나'
//   t('msg.switchCooldown',{sec:5})   // => 'Switch ready in 5s'
//   await setLocale('ja');            // switch locale at runtime
//
// Adding a new language:
//   1. Create src/i18n/<code>.js exporting the same shape as ko.js
//   2. Add the code to SUPPORTED below

import ko from './ko.js';

const SUPPORTED = ['ko', 'en', 'ja', 'es', 'zh'];
const FALLBACK = 'en';
const STORAGE_KEY = 'mt-silver-lang';

const cache = { ko };
let current = 'ko';
let strings = ko;
const listeners = [];

/** Pick the best supported locale from browser preferences or saved setting. */
function detect() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
  } catch { /* private browsing */ }
  for (const tag of (navigator.languages || [navigator.language || FALLBACK])) {
    const code = tag.split('-')[0].toLowerCase();
    if (SUPPORTED.includes(code)) return code;
  }
  return FALLBACK;
}

/** Dynamically import & cache a locale module. */
async function load(locale) {
  if (cache[locale]) return cache[locale];
  const mod = await import(`./${locale}.js`);
  cache[locale] = mod.default;
  return cache[locale];
}

/**
 * Translate a dot-separated key.
 *   - Strings are returned as-is (with optional {param} interpolation).
 *   - Functions are called with `params` and their return value is used.
 *   - Missing keys fall back to English or Korean, or fallback param / key.
 */
export function t(key, params, fallback) {
  if (!key) return '';
  let val = key.split('.').reduce((o, k) => o?.[k], strings);
  if (val === undefined || val === null) {
    val = key.split('.').reduce((o, k) => o?.[k], cache['en'] || ko);
  }
  if (val === undefined || val === null) return fallback !== undefined ? fallback : key;
  if (typeof val === 'function') {
    if (params === undefined) return val;
    return val(params, fallback);
  }
  if (typeof val === 'string' && params && typeof params === 'object') {
    for (const [k, v] of Object.entries(params))
      val = val.replaceAll(`{${k}}`, String(v ?? ''));
  }
  return val;
}

/** Scan the DOM for data-i18n* attributes and apply translations. */
export function applyDOM() {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const v = t(el.dataset.i18n);
    if (v !== el.dataset.i18n) el.textContent = v;
  }
  for (const el of document.querySelectorAll('[data-i18n-aria]')) {
    const v = t(el.dataset.i18nAria);
    if (v !== el.dataset.i18nAria) el.setAttribute('aria-label', v);
  }
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    const v = t(el.dataset.i18nPlaceholder);
    if (v !== el.dataset.i18nPlaceholder) el.placeholder = v;
  }
  for (const el of document.querySelectorAll('[data-i18n-html]')) {
    const v = t(el.dataset.i18nHtml);
    if (v !== el.dataset.i18nHtml) el.innerHTML = v;
  }
}

/** Detect browser language and load it. Call once at startup. */
export async function initLocale() {
  return setLocale(detect());
}

/** Switch to a new locale. Returns the resolved locale code. */
export async function setLocale(locale) {
  if (!SUPPORTED.includes(locale)) locale = FALLBACK;
  strings = await load(locale);
  current = locale;
  try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* quota */ }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale === 'zh' ? 'zh-Hans' : locale;
    applyDOM();
  }
  for (const fn of listeners) fn(locale);
  return locale;
}

export function getLocale() { return current; }
export function getSupported() { return [...SUPPORTED]; }

/** Register a callback for locale changes. Returns an unsubscribe function. */
export function onChange(fn) {
  listeners.push(fn);
  return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
}

/** Locale-aware name formatting helpers. */
export const LOCALE_NAMES = Object.freeze({
  ko: '한국어', en: 'English', ja: '日本語', es: 'Español', zh: '中文'
});
