#!/usr/bin/env node

/**
 * Network utilities for HTTP requests with timeout and retry logic
 */
class NetworkUtils {
  /**
   * Centralized HTTP request utility with timeout and retry logic
   */
  static async httpRequest(url, options = {}, retryConfig = {}) {
    const {
      maxRetries = 3,
      timeoutMs = 10000,
      retryDelayMs = 2000,
      shouldRetry = () => true,
      method = 'GET',
      ...fetchOptions
    } = retryConfig;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        console.log(`🌐 HTTP ${method} ${url} (attempt ${attempt}/${maxRetries}, ${timeoutMs}ms timeout)`);

        const response = await fetch(url, {
          method,
          signal: controller.signal,
          ...options,
          ...fetchOptions
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          console.log(`✅ HTTP ${method} ${url} successful (${response.status})`);
          return response;
        } else {
          console.log(`⚠️ HTTP ${method} ${url} returned ${response.status}`);

          // Check if we should retry based on response
          if (!shouldRetry(response) || attempt === maxRetries) {
            return response; // Return error response
          }
        }
      } catch (error) {
        clearTimeout(timeoutId);
        console.log(`⚠️ HTTP ${method} ${url} attempt ${attempt} failed: ${error.message}`);

        if (attempt === maxRetries) {
          throw error; // Re-throw on last attempt
        }
      }

      // Wait before retry (except on last attempt)
      if (attempt < maxRetries) {
        const delay = typeof retryDelayMs === 'function' ? retryDelayMs(attempt) : retryDelayMs;
        console.log(`⏳ Retrying HTTP ${method} in ${delay}ms...`);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Sleep utility
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = NetworkUtils;
