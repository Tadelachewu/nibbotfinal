import { NextRequest, NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/session';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { Agent, fetch as undiciFetch } from 'undici';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Server-side proxy to bypass CORS restrictions for external API calls.
 * This route forwards requests to external systems and returns the response.
 */
export async function POST(req: NextRequest) {
  let fetchTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (!isSameOriginRequest(req)) {
      return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
    }

    const body = await req.json();
    const { url, method, headers, payload } = body;

    if (!url) {
      return NextResponse.json({
        status: 'error',
        message: 'The "url" parameter is required.'
      }, { status: 400 });
    }

    const allowlistRaw = String(process.env.PROXY_ALLOWED_HOSTS || process.env.ALLOWED_API_DOMAINS || '').trim();
    const allowlist = allowlistRaw
      .split(/[,\s]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const allowHttpInDev = process.env.ALLOW_HTTP === 'true';
    const devAllowed = [
      'localhost',
      '127.0.0.1',
      'placehold.co',
      'images.unsplash.com',
      'picsum.photos',
    ];

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(String(url));
    } catch {
      return NextResponse.json({ status: 'error', message: 'Invalid URL.' }, { status: 400 });
    }

    const protocol = parsedUrl.protocol.toLowerCase();
    if (protocol !== 'https:' && !(allowHttpInDev && protocol === 'http:')) {
      return NextResponse.json({
        status: 'error',
        message: 'Invalid URL. Only HTTPS URLs are supported.'
      }, { status: 400 });
    }

    if (parsedUrl.username || parsedUrl.password) {
      return NextResponse.json({ status: 'error', message: 'Invalid URL.' }, { status: 400 });
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    const port = parsedUrl.port ? Number(parsedUrl.port) : undefined;

    const blockedHostnames = new Set<string>([
      'localhost',
      'localhost.localdomain',
      'metadata.google.internal',
      'metadata.google',
      'metadata',
    ]);
    if (blockedHostnames.has(hostname) || hostname.endsWith('.localhost')) {
      return NextResponse.json({ status: 'error', message: 'Destination not allowed.' }, { status: 403 });
    }

    const matchAllowlist = (u: URL): { allowed: boolean; explicit: boolean } => {
      const host = u.hostname.toLowerCase();
      const hostPort = u.port ? `${host}:${u.port}` : host;
      if (process.env.NODE_ENV !== 'production') {
        if (devAllowed.includes(host)) return { allowed: true, explicit: true };
      }
      if (allowlist.length === 0) return { allowed: false, explicit: false };

      for (const entryRaw of allowlist) {
        const entry = entryRaw.toLowerCase();
        if (!entry) continue;

        if (entry.startsWith('http://') || entry.startsWith('https://')) {
          try {
            const e = new URL(entry);
            if (e.hostname.toLowerCase() !== host) continue;
            if (e.port) {
              if (e.port === u.port) return { allowed: true, explicit: true };
              continue;
            }
            return { allowed: true, explicit: true };
          } catch {
            continue;
          }
        }

        if (entry.startsWith('*.')) {
          const base = entry.slice(2);
          if (base.length > 0 && host.endsWith(`.${base}`)) return { allowed: true, explicit: false };
          continue;
        }

        if (entry.includes(':')) {
          if (entry === hostPort) return { allowed: true, explicit: true };
          continue;
        }

        if (host === entry) return { allowed: true, explicit: true };
        if (host.endsWith(`.${entry}`)) return { allowed: true, explicit: false };
      }

      return { allowed: false, explicit: false };
    };

    const allowMatch = matchAllowlist(parsedUrl);
    if (!allowMatch.allowed) {
      const msg =
        process.env.NODE_ENV === 'production' && allowlist.length === 0
          ? 'Proxy allowlist not configured.'
          : 'Destination not allowed.';
      return NextResponse.json({ status: 'error', message: msg }, { status: 403 });
    }

    const blockedIpv4 = new Set<string>([
      '0.0.0.0',
      '127.0.0.1',
      '169.254.169.254',
      '169.254.170.2',
      '100.100.100.200',
      '168.63.129.16',
    ]);

    const isBlockedEvenIfAllowlisted = (ip: string): boolean => {
      const kind = isIP(ip);
      if (kind === 4) {
        if (blockedIpv4.has(ip)) return true;
        const parts = ip.split('.').map(n => Number(n));
        if (parts.length !== 4 || parts.some(n => !Number.isFinite(n) || n < 0 || n > 255)) return true;
        const [a, b] = parts;
        if (a === 127) return true;
        if (a === 0) return true;
        if (a === 169 && b === 254) return true;
        return false;
      }
      if (kind === 6) {
        const normalized = ip.toLowerCase();
        if (normalized === '::' || normalized === '::1') return true;
        if (normalized.startsWith('fe80:')) return true;
        if (normalized.startsWith('::ffff:')) {
          const v4 = normalized.slice('::ffff:'.length);
          return isBlockedEvenIfAllowlisted(v4);
        }
        return false;
      }
      return true;
    };

    const isPrivateOrLocalIp = (ip: string): boolean => {
      const kind = isIP(ip);
      if (kind === 4) {
        if (blockedIpv4.has(ip)) return true;
        const parts = ip.split('.').map(n => Number(n));
        if (parts.length !== 4 || parts.some(n => !Number.isFinite(n) || n < 0 || n > 255)) return true;
        const [a, b] = parts;
        if (a === 10) return true;
        if (a === 127) return true;
        if (a === 0) return true;
        if (a === 169 && b === 254) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        if (a === 100 && b >= 64 && b <= 127) return true;
        return false;
      }
      if (kind === 6) {
        const normalized = ip.toLowerCase();
        if (normalized === '::' || normalized === '::1') return true;
        if (normalized.startsWith('fe80:')) return true;
        if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
        if (normalized.startsWith('::ffff:')) {
          const v4 = normalized.slice('::ffff:'.length);
          return isPrivateOrLocalIp(v4);
        }
        return false;
      }
      return true;
    };

    if (isIP(hostname)) {
      if (isBlockedEvenIfAllowlisted(hostname)) {
        return NextResponse.json({ status: 'error', message: 'Destination not allowed.' }, { status: 403 });
      }
      if (isPrivateOrLocalIp(hostname) && !allowMatch.explicit && !allowlist.includes(hostname)) {
        return NextResponse.json({ status: 'error', message: 'Destination not allowed.' }, { status: 403 });
      }
    } else {
      const results = await lookup(hostname, { all: true, verbatim: true }).catch(() => []);
      if (Array.isArray(results) && results.some(r => isBlockedEvenIfAllowlisted(r.address))) {
        return NextResponse.json({ status: 'error', message: 'Destination not allowed.' }, { status: 403 });
      }
      if (Array.isArray(results) && results.some(r => isPrivateOrLocalIp(r.address)) && !allowMatch.explicit) {
        return NextResponse.json({ status: 'error', message: 'Destination not allowed.' }, { status: 403 });
      }
    }

    const requestedMethod = String(method || 'GET').toUpperCase();
    const allowedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
    if (!allowedMethods.has(requestedMethod)) {
      return NextResponse.json({ status: 'error', message: 'Method not allowed.' }, { status: 405 });
    }

    const disallowedHeaderNames = new Set([
      'host',
      'connection',
      'content-length',
      'transfer-encoding',
      'expect',
      'upgrade',
      'proxy-authorization',
      'proxy-authenticate',
      'sec-websocket-key',
      'sec-websocket-version',
      'sec-websocket-protocol',
      'sec-websocket-extensions',
    ]);

    const outHeaders = new Headers();
    outHeaders.set('Accept', 'application/json, text/plain, */*');
    if (headers && typeof headers === 'object') {
      for (const [k, v] of Object.entries(headers as Record<string, any>)) {
        const key = String(k || '').trim();
        if (!key) continue;
        const keyLower = key.toLowerCase();
        if (disallowedHeaderNames.has(keyLower)) continue;
        if (keyLower.startsWith('sec-') || keyLower.startsWith('proxy-')) continue;
        if (typeof v === 'string') outHeaders.set(key, v);
      }
    }

    const timeoutMsRaw = Number(process.env.PROXY_TIMEOUT_MS ?? 30_000);
    const timeoutMs =
      Number.isFinite(timeoutMsRaw) && timeoutMsRaw >= 1_000 && timeoutMsRaw <= 300_000
        ? Math.floor(timeoutMsRaw)
        : 30_000;

    const controller = new AbortController();
    fetchTimer = setTimeout(() => controller.abort(), timeoutMs);

    const allowSelfSigned =
      process.env.ALLOW_SELF_SIGNED_CERTS === 'true';
    const dispatcher = allowSelfSigned
      ? new Agent({ connect: { rejectUnauthorized: false } })
      : undefined;

    const fetchOptions: RequestInit = {
      method: requestedMethod,
      headers: outHeaders,
      cache: 'no-store',
      redirect: 'manual',
      signal: controller.signal,
    };

    if (payload && (requestedMethod === 'POST' || requestedMethod === 'PUT' || requestedMethod === 'PATCH')) {
      fetchOptions.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
      if (!outHeaders.has('Content-Type')) {
        outHeaders.set('Content-Type', 'application/json');
      }
    }

    if (dispatcher) {
      (fetchOptions as any).dispatcher = dispatcher;
    }

    const fetchWithRedirects = async (initial: URL, options: RequestInit) => {
      let current = new URL(initial.toString());
      let currentOptions: RequestInit = { ...options };
      const visited = new Set<string>();

      for (let i = 0; i <= 3; i++) {
        const key = current.toString();
        if (visited.has(key)) {
          return { error: 'Redirect loop detected.' as const };
        }
        visited.add(key);

        if (dispatcher) (currentOptions as any).dispatcher = dispatcher;
        const res = await undiciFetch(current.toString(), currentOptions as any);
        if (res.status < 300 || res.status > 399) return { response: res };

        const location = res.headers.get('location');
        if (!location) return { response: res };

        const next = new URL(location, current);
        const nextAllow = matchAllowlist(next);
        if (!nextAllow.allowed) {
          return { error: 'Redirect destination not allowed.' as const };
        }

        const rHost = next.hostname.toLowerCase();
        if (blockedHostnames.has(rHost) || rHost.endsWith('.localhost')) {
          return { error: 'Redirect destination not allowed.' as const };
        }
        if (isIP(rHost)) {
          if (isBlockedEvenIfAllowlisted(rHost)) {
            return { error: 'Redirect destination not allowed.' as const };
          }
          if (isPrivateOrLocalIp(rHost) && !nextAllow.explicit) {
            return { error: 'Redirect destination not allowed.' as const };
          }
        } else {
          const rDns = await lookup(rHost, { all: true, verbatim: true }).catch(() => []);
          if (Array.isArray(rDns) && rDns.some(r => isBlockedEvenIfAllowlisted(r.address))) {
            return { error: 'Redirect destination not allowed.' as const };
          }
          if (Array.isArray(rDns) && rDns.some(r => isPrivateOrLocalIp(r.address)) && !nextAllow.explicit) {
            return { error: 'Redirect destination not allowed.' as const };
          }
        }

        current = next;
        const m = String(currentOptions.method || 'GET').toUpperCase();
        const shouldDropBody = res.status === 303 || ((res.status === 301 || res.status === 302) && m !== 'GET' && m !== 'HEAD');
        if (shouldDropBody) {
          currentOptions = { ...currentOptions, method: 'GET', body: undefined };
          const nextHeaders = new Headers(currentOptions.headers);
          nextHeaders.delete('content-type');
          currentOptions.headers = nextHeaders;
        }
      }

      return { error: 'Too many redirects.' as const };
    };

    const result = await fetchWithRedirects(parsedUrl, fetchOptions);
    clearTimeout(fetchTimer);
    if (dispatcher) dispatcher.close().catch(() => undefined);

    if ('error' in result) {
      return NextResponse.json({ status: 'error', message: result.error }, { status: 400 });
    }

    const response = result.response;

    const MAX_RESPONSE_SIZE = 10 * 1024 * 1024;
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
      return NextResponse.json({ status: 'error', message: 'Response too large.' }, { status: 502 });
    }

    const contentType = response.headers.get('content-type') || '';

    let responseData;
    if (contentType.includes('application/json')) {
      responseData = await response.json().catch(() => null);
    } else {
      responseData = await response.text().catch(() => '');
    }

    return NextResponse.json({
      status: 'success',
      data: responseData,
      statusCode: response.status,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

  } catch (error: any) {
    clearTimeout(fetchTimer);
    console.error('[Proxy Error]:', error);

    let errorMessage = error.message || 'An error occurred while proxying the request.';
    if (error.name === 'AbortError') {
      errorMessage = 'Request timed out.';
      return NextResponse.json({
        status: 'error',
        message: errorMessage,
        debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, { status: 504 });
    }
    if (error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || error.message?.includes('self-signed certificate')) {
      errorMessage = 'The external API is using a self-signed certificate. To allow this, set ALLOW_SELF_SIGNED_CERTS=true in your .env file.';
    }

    return NextResponse.json({
      status: 'error',
      message: errorMessage,
      debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
