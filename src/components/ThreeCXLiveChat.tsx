'use client';

// Official 3CX "Call Us" widget embed for this PBX (party "LiveChat854959"),
// per the platform-agnostic snippet from the 3CX admin console:
//
//   <call-us-selector phonesystem-url="https://nibbank.3cx.sc" party="LiveChat854959"></call-us-selector>
//   <script defer src="https://downloads-global.3cx.com/downloads/livechatandtalk/v1/callus.js" id="tcx-callus-js"></script>
//
// The widget's config/chat requests go straight from the browser to
// `phonesystem-url` (the PBX itself, not the public callcenter.nibbank.com.et
// site). The PBX only answers those cross-origin requests for origins listed
// in its own admin console (Admin > Voice & Chat > Live Chat > "Your
// Website") — that whitelist step happens in the 3CX admin console, not in
// this app. If the widget silently fails to render or connect, check the
// browser console for a CORS/network error against nibbank.3cx.sc first.
//
// CSP: the loader script's host and the PBX host are allowlisted in
// server.js's buildContentSecurityPolicy() (script-src / connect-src /
// frame-src). Keep PHONESYSTEM_URL here in sync with that file.

import { useEffect, useRef } from 'react';
import { getCspNonce } from '@/lib/csp';

const PHONESYSTEM_URL = 'https://nibbank.3cx.sc';
const PARTY = 'LiveChat854959';
const WIDGET_SCRIPT_SRC = '/vendor/3cx/callus';
const WIDGET_SCRIPT_ID = 'tcx-callus-js';

// React 19's JSX namespace lives under the `react` module (not the global
// scope), so augmenting it here — rather than `declare global { namespace JSX }`
// — is what actually merges into IntrinsicElements.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'call-us-selector': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        'phonesystem-url'?: string;
        party?: string;
      };
    }
  }
}

export default function ThreeCXLiveChat() {
  const injected = useRef(false);

  useEffect(() => {
    if (injected.current || document.getElementById(WIDGET_SCRIPT_ID)) return;
    injected.current = true;

    const script = document.createElement('script');
    script.id = WIDGET_SCRIPT_ID;
    script.src = WIDGET_SCRIPT_SRC;
    script.defer = true;
    // Matches the CSP script-src allowlist entry for this host — required
    // for this externally-hosted script to load under the app's strict CSP.
    const nonce = getCspNonce();
    if (nonce) script.setAttribute('nonce', nonce);
    document.body.appendChild(script);
  }, []);

  return (
    <call-us-selector
      phonesystem-url={PHONESYSTEM_URL}
      party={PARTY}
      style={{
        position: 'fixed',
        right: '12px',
        bottom: '12px',
        zIndex: 2147483647,
        transform: 'scale(0.9)',
        transformOrigin: 'bottom right',
      }}
    />
  );
}
