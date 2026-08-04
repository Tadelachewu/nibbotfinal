'use client';

// Official 3CX "Call Us" widget embed for this PBX (party "LiveChat854959"),
// per the platform-agnostic snippet from the 3CX admin console:
//
//   <call-us-selector phonesystem-url="https://nibbank.3cx.sc" party="LiveChat854959"></call-us-selector>
//   <script defer src="https://downloads-global.3cx.com/downloads/livechatandtalk/v1/callus.js" id="tcx-callus-js"></script>
//
// The loader script is proxied same-origin through /vendor/3cx/callus (see
// src/app/vendor/3cx/callus/route.ts) — loading it directly from
// downloads-global.3cx.com hit a COEP block (the 3CX CDN doesn't send a
// Cross-Origin-Resource-Policy header). The widget's own config/chat
// requests still go straight from the browser to `phonesystem-url`, which
// only answers cross-origin requests for origins whitelisted in the 3CX
// admin console (Admin > Voice & Chat > Live Chat > "Your Website") — that
// whitelist step happens there, not in this app. If the widget silently
// fails to render or connect, check the browser console for a CORS/network
// error against the PBX first.
//
// CSP: the PBX host is allowlisted in server.js's buildContentSecurityPolicy()
// (connect-src / frame-src). Keep PHONESYSTEM_URL here in sync with that file.
//
// POSITIONING — read before touching this file:
// The `style` prop below only positions the light-DOM <call-us-selector>
// host, which renders nothing itself (it's a 0x0 box). The actual bubble
// and chat panel render inside an OPEN shadow root, in a container the
// widget's own bundle hardcodes to `position: fixed; right: 20px;
// bottom: 20px; z-index: 99999` (id="wp-live-chat-by-3CX") — confirmed by
// reading callus.js directly. There is no attribute or config option that
// overrides this; it ignores whatever style/position we set on the host.
// The WIDGET_ROOT_OVERRIDE_CSS below reaches into that (open) shadow root
// and injects a scoped `!important` rule, which beats the widget's plain
// inline style regardless of how many times its own script re-applies it.
// Because the host element is `position: absolute` (anchored to the footer
// — see ChatInterface.tsx) and the override switches the widget's root from
// `fixed` to `absolute`, the widget's root resolves its containing block up
// through the shadow boundary to the host, so `right: 0; bottom: 0` there
// lands exactly at the host's own anchored point instead of the viewport
// corner. If 3CX ships a widget update that renames that id, this override
// silently stops applying and the bubble reverts to floating at the
// viewport corner — that's the risk of overriding an undocumented,
// unversioned third-party bundle instead of a supported API.

import { useEffect, useRef, useState } from 'react';
import { getCspNonce } from '@/lib/csp';

const PHONESYSTEM_URL = 'https://callcenter.nibbank.com.et';
const PARTY = 'LiveChat854959';
const WIDGET_SCRIPT_SRC = '/vendor/3cx/callus';
const WIDGET_SCRIPT_ID = 'tcx-callus-js';

type LiveBadgePosition = { top: number; left: number; visible: boolean };

const WIDGET_ROOT_OVERRIDE_CSS = `
  #wp-live-chat-by-3CX {
    position: absolute !important;
    right: 0 !important;
    bottom: 0 !important;
    left: auto !important;
    top: auto !important;
    z-index: 30 !important;
    overflow: visible !important;
  }
`;

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
  const hostRef = useRef<HTMLElement | null>(null);
  const liveBadgeRef = useRef<HTMLSpanElement | null>(null);
  const [liveBadgePosition, setLiveBadgePosition] = useState<LiveBadgePosition>({ top: 0, left: 0, visible: false });

  useEffect(() => {
    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;
    let observer: MutationObserver | null = null;
    let docObserver: MutationObserver | null = null;

    // Idempotent: re-appends the override style tag only if it's not
    // already present, so it's safe to call repeatedly from the observer
    // below without piling up duplicate <style> tags.
    const ensureOverride = (shadowRoot: ShadowRoot) => {
      if (shadowRoot.getElementById('nib-3cx-position-override')) return;
      const style = document.createElement('style');
      style.id = 'nib-3cx-position-override';
      style.textContent = WIDGET_ROOT_OVERRIDE_CSS;
      shadowRoot.appendChild(style);
    };

    const ensureGlobalOverride = () => {
      if (document.getElementById('nib-3cx-position-override-global')) return;
      const style = document.createElement('style');
      style.id = 'nib-3cx-position-override-global';
      style.textContent = WIDGET_ROOT_OVERRIDE_CSS;
      document.head.appendChild(style);
    };

    function updateLiveBadgePosition(root: HTMLElement) {
      const badge = liveBadgeRef.current;
      if (!badge) return;

      const candidate =
        (root.querySelector('.minimized-button') as HTMLElement | null) ??
        (root.querySelector('button, [role="button"], a') as HTMLElement | null);
      if (!candidate) {
        setLiveBadgePosition(prev => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      const bubbleRect = candidate.getBoundingClientRect();
      if (bubbleRect.width <= 0 || bubbleRect.height <= 0) {
        setLiveBadgePosition(prev => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      const badgeRect = badge.getBoundingClientRect();
      const top = bubbleRect.top + 4;
      const left = bubbleRect.left + Math.max(0, (bubbleRect.width - badgeRect.width) / 2);

      setLiveBadgePosition({ top, left, visible: true });
    }

    const ensureOverridesEverywhere = () => {
      ensureGlobalOverride();

      const queue: ShadowRoot[] = [];
      const visited = new Set<ShadowRoot>();
      const hostShadowRoot = hostRef.current?.shadowRoot;
      if (hostShadowRoot) queue.push(hostShadowRoot);

      while (queue.length > 0) {
        const sr = queue.shift()!;
        if (visited.has(sr)) continue;
        visited.add(sr);

        ensureOverride(sr);

        const root = sr.getElementById('wp-live-chat-by-3CX') as HTMLElement | null;
        if (root) updateLiveBadgePosition(root);

        const nestedHosts = Array.from(sr.querySelectorAll('*')) as any[];
        for (const el of nestedHosts) {
          const nested = el?.shadowRoot;
          if (nested instanceof ShadowRoot && !visited.has(nested)) {
            queue.push(nested);
          }
        }
      }

      const docRoot = document.getElementById('wp-live-chat-by-3CX') as HTMLElement | null;
      if (docRoot) updateLiveBadgePosition(docRoot);
    };

    // The widget's shadow root exists as soon as its custom element class
    // upgrades (synchronous with the script defining it), but that can
    // happen slightly after this effect runs. Poll briefly rather than
    // relying on script.onload timing.
    pollId = setInterval(() => {
      if (cancelled) return;
      ensureOverridesEverywhere();

      if (!observer) {
        const shadowRoot = hostRef.current?.shadowRoot;
        if (shadowRoot) {
          observer = new MutationObserver(() => ensureOverridesEverywhere());
          observer.observe(shadowRoot, { childList: true, subtree: true });
        }
      }

      if (!docObserver) {
        const docRoot = document.getElementById('wp-live-chat-by-3CX') as HTMLElement | null;
        if (docRoot) {
          docObserver = new MutationObserver(() => ensureOverridesEverywhere());
          docObserver.observe(docRoot, { childList: true, subtree: true });
        }
      }

      const shadowReady = !!hostRef.current?.shadowRoot?.getElementById('wp-live-chat-by-3CX');
      const docReady = !!document.getElementById('wp-live-chat-by-3CX');
      if (shadowReady || docReady) {
        if (pollId) {
          clearInterval(pollId);
          pollId = null;
        }
      }
    }, 200);

    if (!injected.current && !document.getElementById(WIDGET_SCRIPT_ID)) {
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
    }

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
      if (observer) observer.disconnect();
      if (docObserver) docObserver.disconnect();
    };
  }, []);

  return (
    <>
      <call-us-selector
        ref={hostRef}
        phonesystem-url={PHONESYSTEM_URL}
        party={PARTY}
        // Anchors to the footer this renders inside (`position: relative` —
        // see ChatInterface.tsx). `bottom: 100%` with no margin sits it exactly
        // tangent to the footer's top border (an absolutely positioned child's
        // containing block is its ancestor's *padding* box, unaffected by the
        // ancestor's own padding, so 0 there touches the border with no gap).
        // `right: 4px` is a deliberate small inset rather than 0 — flush 0
        // crossed into the message list's scrollbar track/arrow on desktop;
        // CSS can't query the browser's actual scrollbar width, so this is a
        // measured-by-eye safety margin, not a computed value.
        style={{
          position: 'absolute',
          right: '4px',
          bottom: '100%',
          zIndex: 30,
        }}
      />
      <span
        ref={liveBadgeRef}
        className="fixed px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide rounded-full bg-[#f4a61b] text-[#763717] border border-white shadow-sm select-none"
        style={{
          top: liveBadgePosition.top,
          left: liveBadgePosition.left,
          opacity: liveBadgePosition.visible ? 1 : 0,
          pointerEvents: 'none',
          zIndex: 2147483647,
          transition: 'opacity 150ms ease',
        }}
      >
        Live
      </span>
    </>
  );
}
