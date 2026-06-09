import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Server-side proxy to bypass CORS restrictions for external API calls.
 * This route forwards requests to external systems and returns the response.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, method, headers, payload } = body;

    if (!url) {
      return NextResponse.json({
        status: 'error',
        message: 'The "url" parameter is required.'
      }, { status: 400 });
    }

    // Safety check: ensure it's an absolute URL
    if (!url.startsWith('http')) {
      return NextResponse.json({
        status: 'error',
        message: 'Invalid URL. Only absolute HTTP/HTTPS URLs are supported.'
      }, { status: 400 });
    }

    const fetchOptions: RequestInit = {
      method: method || 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        ...(headers || {})
      },
      cache: 'no-store'
    };

    if (payload && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      fetchOptions.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
      if (!fetchOptions.headers || !('Content-Type' in (fetchOptions.headers as any))) {
        (fetchOptions.headers as any)['Content-Type'] = 'application/json';
      }
    }

    // If we are in development or explicitly allowing self-signed certs
    if (process.env.ALLOW_SELF_SIGNED_CERTS === 'true') {
      // Note: This is a Node.js specific global setting for the current process
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    const response = await fetch(url, fetchOptions);
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
    console.error('[Proxy Error]:', error);

    // Provide a more helpful message for SSL errors
    let errorMessage = error.message || 'An error occurred while proxying the request.';
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
