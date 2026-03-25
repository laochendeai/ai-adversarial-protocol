/**
 * SWR API Cache Configuration
 * Provides caching and request deduplication for API calls
 */

import useSWR, { SWRConfiguration } from 'swr';

// Default SWR configuration for the app
export const swrConfig: SWRConfiguration = {
  // Revalidate on focus (when user switches back to tab)
  revalidateOnFocus: false,

  // Revalidate on reconnect (when internet reconnects)
  revalidateOnReconnect: true,

  // Deduplicate parallel requests
  dedupingInterval: 2000,

  // Error retry configuration
  shouldRetryOnError: (error) => {
    // Don't retry on 4xx errors (client errors)
    if (error.status === 401 || error.status === 403 || error.status === 404) {
      return false;
    }
    // Retry on 5xx errors and network errors
    return true;
  },
  errorRetryCount: 3,
  errorRetryInterval: 5000,

  // Refresh interval (for auto-refreshing data)
  // undefined = no auto-refresh
  refreshInterval: 0,
};

/**
 * Fetcher wrapper for API calls
 * Converts standard fetch calls to SWR-compatible format
 */
export const fetcher = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

/**
 * Cache key generator for API requests
 * Creates consistent keys based on URL and request body
 */
export function getCacheKey(url: string, body?: any): string {
  if (body) {
    return `${url}:${JSON.stringify(body)}`;
  }
  return url;
}
