/**
 * Security utilities for the TalkTree system.
 */

/**
 * Validates a URL against an allowlist of domains to prevent SSRF.
 * In production, it checks against the ALLOWED_API_DOMAINS env var.
 */
export function validateApiUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol;
    
    // Only allow http/https
    if (protocol !== 'http:' && protocol !== 'https:') return false;

    // In development, allow localhost and common test APIs
    if (process.env.NODE_ENV !== 'production') {
      const devAllowed = ['localhost', '127.0.0.1', 'placehold.co', 'images.unsplash.com', 'picsum.photos'];
      if (devAllowed.some(d => parsed.hostname === d)) return true;
    }

    // Check against configured allowlist
    const rawAllowlist = process.env.ALLOWED_API_DOMAINS || '';
    if (!rawAllowlist) {
      // If no allowlist is set in production, we default to blocking everything 
      // except 'self' (which is handled by the caller or proxy)
      return false;
    }

    const allowedDomains = rawAllowlist.split(/[,\s]+/).filter(Boolean).map(d => d.toLowerCase());
    return allowedDomains.some(domain => {
      // Match exact domain or subdomains
      return parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`);
    });
  } catch (e) {
    return false;
  }
}

/**
 * Sanitizes a template string to prevent injection in dynamic API calls.
 */
export function sanitizeTemplate(tpl: string): string {
  // Prevent common injection characters in sensitive contexts
  return tpl.replace(/[<>"`]/g, '');
}
