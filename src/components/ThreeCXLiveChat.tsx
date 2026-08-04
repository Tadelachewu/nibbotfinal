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

// Finds the widget's actual clickable bubble button (`.minimized-button`,
// inside its shadow root — or, in rarer cases seen elsewhere in this file,
// nested even deeper, or landed directly in the document) via the same
// breadth-first shadow-root walk the position/badge logic below already
// relies on. Self-contained rather than sharing code with that logic, on
// purpose — this only needs to run once per call (a menu button click), not
// continuously, and keeping it separate avoids touching the already-tuned
// polling/observer logic for an unrelated feature.
function findMinimizedButton(): HTMLElement | null {
  const direct = document.getElementById('wp-live-chat-by-3CX');
  if (direct) {
    const btn = direct.querySelector('.minimized-button');
    if (btn instanceof HTMLElement) return btn;
  }

  const queue: (Document | ShadowRoot)[] = [document];
  const visited = new Set<Document | ShadowRoot>();

  while (queue.length > 0) {
    const root = queue.shift()!;
    if (visited.has(root)) continue;
    visited.add(root);

    const widgetRoot = root.getElementById?.('wp-live-chat-by-3CX');
    if (widgetRoot) {
      const btn = widgetRoot.querySelector('.minimized-button');
      if (btn instanceof HTMLElement) return btn;
    }

    const all = root.querySelectorAll('*');
    for (const el of Array.from(all)) {
      const shadow = (el as HTMLElement).shadowRoot;
      if (shadow && !visited.has(shadow)) queue.push(shadow);
    }
  }

  return null;
}

// Exported so other UI (e.g. a "Live Agent" menu button elsewhere in the
// app) can trigger the same open action as clicking the bubble directly,
// without needing to know anything about the widget's internal structure.
// There's no documented/public API for this — the widget only exposes
// itself as a clickable DOM element — so this simulates a real user click
// on that element. Returns whether a button was actually found and clicked,
// so callers can fall back (e.g. to a toast) if the widget hasn't mounted
// yet.
export function openThreeCXLiveChat(): boolean {
  const button = findMinimizedButton();
  if (!button) return false;
  button.click();
  return true;
}

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

  #wp-live-chat-by-3CX .panel,
  #wp-live-chat-by-3CX .panel_content {
    max-height: var(--nib-3cx-panel-max-h, 460px) !important;
    max-width: var(--nib-3cx-panel-max-w, 320px) !important;
  }

  #wp-live-chat-by-3CX .minimized-button {
    transform: scale(var(--nib-3cx-bubble-scale, 0.9)) !important;
    transform-origin: bottom right !important;
    /* Same gold used across ChatInterface.tsx's avatars (makeAvatarDataUri
       calls) — the widget's own default is 3CX blue (#0596d4). The icon
       itself is untouched (same chat glyph, still centered by the widget's
       own layout), only recolored for contrast: white-on-gold here is
       ~1.45:1 contrast (barely visible), while brown-on-gold — this app's
       own established avatar pairing — is ~2.35:1, matching how every
       other avatar in this app already handles this exact background. */
    background-color: #f4a61b !important;
  }
  #wp-live-chat-by-3CX .minimized-button svg {
    fill: #763717 !important;
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

    const updatePanelSizing = () => {
      const host = hostRef.current;
      if (!host) return;
      const footer = host.closest('footer');
      const container = footer?.parentElement;
      const header = container?.querySelector('header');
      if (!(footer instanceof HTMLElement) || !(container instanceof HTMLElement) || !(header instanceof HTMLElement)) return;

      const headerRect = header.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      const availableHeight = Math.floor(Math.max(260, footerRect.top - headerRect.bottom - 12));
      const availableWidth = Math.floor(Math.max(260, Math.min(320, containerRect.width - 16)));
      const bubbleScale = containerRect.width < 420 ? 0.85 : 0.9;

      host.style.setProperty('--nib-3cx-panel-max-h', `${availableHeight}px`);
      host.style.setProperty('--nib-3cx-panel-max-w', `${availableWidth}px`);
      host.style.setProperty('--nib-3cx-bubble-scale', `${bubbleScale}`);
    };

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

      const candidate = root.querySelector('.minimized-button') as HTMLElement | null;
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
      const top = bubbleRect.top - Math.min(6, Math.floor(badgeRect.height * 0.6));
      const left = bubbleRect.left + Math.max(0, (bubbleRect.width - badgeRect.width) / 2);

      setLiveBadgePosition({ top, left, visible: true });
    }

    const ensureOverridesEverywhere = () => {
      ensureGlobalOverride();
      updatePanelSizing();

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

    updatePanelSizing();
    window.addEventListener('resize', updatePanelSizing);

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
      window.removeEventListener('resize', updatePanelSizing);
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
        className="fixed px-1 py-[1px] text-[8px] font-bold uppercase tracking-wide rounded-full bg-[#f4a61b] text-[#763717] border border-white shadow-sm select-none"
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
