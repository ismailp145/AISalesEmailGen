/**
 * URL normalization and validation utilities
 * Includes SSRF protection to prevent Server-Side Request Forgery attacks
 */

/**
 * Blocked hostnames and IP patterns that could be used for SSRF attacks
 */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

/**
 * Blocked IP ranges for private/internal networks
 */
const BLOCKED_IP_RANGES = [
  // Private IP ranges
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  // Link-local
  /^169\.254\./,
  // Loopback
  /^127\./,
  // IPv6 private ranges
  /^fc00:/i,
  /^fd00:/i,
  /^fe80:/i,
];

/**
 * Checks if a hostname is blocked (SSRF protection)
 */
function isBlockedHostname(hostname: string): boolean {
  if (!hostname) return true;
  
  const lowerHostname = hostname.toLowerCase().trim();
  
  // Check against blocked hostnames
  if (BLOCKED_HOSTNAMES.has(lowerHostname)) {
    return true;
  }
  
  // Check if hostname is an IP address and matches blocked ranges
  for (const pattern of BLOCKED_IP_RANGES) {
    if (pattern.test(hostname)) {
      return true;
    }
  }
  
  // Check for IPv6 loopback
  if (hostname === "[::1]" || hostname === "::1") {
    return true;
  }
  
  return false;
}

/**
 * Normalizes a URL string by:
 * 1. Trimming whitespace
 * 2. Adding https:// protocol if missing
 * 3. Validating the URL is safe (SSRF protection)
 * 
 * @param url - The URL string to normalize
 * @returns The normalized URL string, or empty string if invalid/unsafe
 * @throws Error if the URL is blocked (SSRF protection)
 */
export function normalizeUrl(url: string): string {
  // Handle null/undefined/non-string inputs
  if (!url || typeof url !== "string") {
    return "";
  }
  
  // Trim whitespace
  let normalized = url.trim();
  
  // Return empty string if empty after trimming
  if (!normalized) {
    return "";
  }
  
  // Add protocol if missing
  if (!normalized.match(/^https?:\/\//i)) {
    if (normalized.startsWith("www.")) {
      normalized = `https://${normalized}`;
    } else {
      normalized = `https://${normalized}`;
    }
  }
  
  // Validate URL format
  let urlObj: URL;
  try {
    urlObj = new URL(normalized);
  } catch {
    // Invalid URL format
    return "";
  }
  
  // Extract and validate hostname for SSRF protection
  const hostname = urlObj.hostname;
  if (!hostname || isBlockedHostname(hostname)) {
    throw new Error(`URL blocked: Access to internal/localhost addresses is not allowed for security reasons`);
  }
  
  // Ensure we only allow http/https protocols
  if (!["http:", "https:"].includes(urlObj.protocol.toLowerCase())) {
    throw new Error(`URL blocked: Only HTTP and HTTPS protocols are allowed`);
  }
  
  return normalized;
}

/**
 * Validates a URL without normalizing it (useful for validation-only checks)
 */
export function validateUrl(url: string): { valid: boolean; error?: string } {
  try {
    const normalized = normalizeUrl(url);
    if (!normalized) {
      return { valid: false, error: "Invalid URL format" };
    }
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : "URL validation failed" 
    };
  }
}

