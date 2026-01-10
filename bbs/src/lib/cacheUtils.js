/**
 * Media Cache Utilities
 */

const CACHE_NAME = 'espa-media-cache-v1';

/**
 * Normalizes a URL by removing query parameters (like SAS tokens).
 */
export function normalizeUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    return url.origin + url.pathname;
  } catch (e) {
    return urlStr;
  }
}

/**
 * Checks if a URL is already in the media cache.
 */
export async function isMediaCached(urlStr) {
  if (!('caches' in window)) return false;
  const normalizedUrl = normalizeUrl(urlStr);
  const cache = await caches.open(CACHE_NAME);
  const match = await cache.match(normalizedUrl);
  return !!match;
}

/**
 * Sends a message to the Service Worker to pre-cache a URL.
 */
export async function preCacheMedia(urlStr) {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    // If no SW controller, we can still fetch and cache manually
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      const normalizedUrl = normalizeUrl(urlStr);
      const response = await fetch(urlStr);
      if (response.ok && response.status === 200) {
        await cache.put(normalizedUrl, response);
      }
    }
    return;
  }

  navigator.serviceWorker.controller.postMessage({
    type: 'PRE_CACHE',
    url: urlStr
  });
}

/**
 * Removes a URL from the media cache.
 */
export async function removeFromCache(urlStr) {
  if (!('caches' in window)) return;
  const normalizedUrl = normalizeUrl(urlStr);
  const cache = await caches.open(CACHE_NAME);
  await cache.delete(normalizedUrl);
}

