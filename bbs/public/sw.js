const CACHE_NAME = 'espa-media-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercept requests to Azure Blob Storage (music and video)
  if (url.hostname.endsWith('.blob.core.windows.net')) {
    event.respondWith(handleMediaRequest(event.request));
  }
});

async function handleMediaRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  // Normalize URL by removing SAS token for cache key
  const url = new URL(request.url);
  const normalizedUrl = url.origin + url.pathname;
  
  const cachedResponse = await cache.match(normalizedUrl);
  
  if (cachedResponse) {
    // console.log('[SW] Serving from cache:', normalizedUrl);
    return cachedResponse;
  }

  // console.log('[SW] Fetching from network:', request.url);
  try {
    // We want to fetch the full file to cache it, but the browser might be sending a range request.
    // If it's a range request, we'll fetch the full file anyway to cache it for next time,
    // but this might be inefficient for very large videos.
    // For now, we'll just fetch whatever the browser asked for.
    const response = await fetch(request);
    
    // Only cache successful full responses (200 OK)
    // We avoid caching partial content (206) because it's hard to reconstruct.
    if (response.ok && response.status === 200) {
      // console.log('[SW] Caching media:', normalizedUrl);
      cache.put(normalizedUrl, response.clone());
    }
    
    return response;
  } catch (error) {
    // console.error('[SW] Fetch failed:', error);
    return fetch(request); // Fallback
  }
}

// Handle pre-caching messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PRE_CACHE') {
    event.waitUntil(preCache(event.data.url));
  }
});

async function preCache(urlStr) {
  const cache = await caches.open(CACHE_NAME);
  const url = new URL(urlStr);
  const normalizedUrl = url.origin + url.pathname;
  
  const match = await cache.match(normalizedUrl);
  if (!match) {
    try {
      const response = await fetch(urlStr);
      if (response.ok && response.status === 200) {
        await cache.put(normalizedUrl, response);
      }
    } catch (e) {
      // Ignore errors
    }
  }
}

