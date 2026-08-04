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

import { useEffect, useRef } from 'react';
import { getCspNonce } from '@/lib/csp';

const PHONESYSTEM_URL = 'https://callcenter.nibbank.com.et';
const PARTY = 'LiveChat854959';
const WIDGET_SCRIPT_SRC = '/vendor/3cx/callus';
const WIDGET_SCRIPT_ID = 'tcx-callus-js';

// Same avatar palette used across ChatInterface.tsx (makeAvatarDataUri calls).
const AVATAR_BG = '#f4a61b';
const AVATAR_TEXT = '#763717';

// One fixed panel size for every device — see the comment on
// WIDGET_ROOT_OVERRIDE_CSS below for why this replaced the earlier
// per-device measured approach. 280px matches the widget's own
// --call-us-form-width-min floor (going smaller fights its internal
// layout); 320px tall is short enough to clear this app's header on any
// realistic viewport without needing to measure it at runtime.
const PANEL_WIDTH_PX = 280;
const PANEL_HEIGHT_PX = 320;

const WIDGET_ROOT_OVERRIDE_CSS = `
  #wp-live-chat-by-3CX {
    position: absolute !important;
    right: 0 !important;
    bottom: 0 !important;
    left: auto !important;
    top: auto !important;
    z-index: 30 !important;
  }

  /* "Live" badge on the bubble itself. Deliberately a ::after pseudo-element
     rather than a positioned sibling: it anchors to .minimized-button's own
     box automatically, so it doesn't need to know the bubble's actual
     rendered size (unknown/unstable — the widget computes it internally). */
  .minimized-button {
    position: relative !important;
  }
  .minimized-button::after {
    content: "Live";
    position: absolute;
    top: -6px;
    right: -6px;
    background-color: ${AVATAR_BG};
    color: ${AVATAR_TEXT};
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    line-height: 1.4;
    padding: 2px 6px;
    border-radius: 9999px;
    border: 1px solid #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    white-space: nowrap;
    pointer-events: none;
  }

  /* The expanded chat panel: the widget's own bundle sizes it to a fixed
     509px height by default across ALL its non-trivial panel_content
     variants — .chat-form, .small-form, .small-form-height (used for the
     pre-chat "enter your name and email" visitor-info form specifically;
     missing this one is exactly what let that screen overlap the header —
     confirmed by re-reading callus.js's compiled CSS, not guessed) and
     .calling-window (voice calls; unused today since allow-call is off in
     our config, included anyway in case that's ever turned on). It can
     additionally switch itself into a "full-screen" mode — literally
     100vw x 100vh via its own !important rule — meant for embedding on a
     normal full-page website. Inside this app's own narrow chat card, either
     one is "too large, breaks out of the parent." Both are forced back to a
     compact size here, regardless of which mode the widget's JS picks.

     One fixed size for every device, deliberately, rather than measuring
     available space per-device: PANEL_HEIGHT_PX (320px) is small enough
     that it fits under this app's header with room to spare even on the
     shortest realistic mobile viewport (a full 640px-tall phone screen
     leaves ~530px between header and footer; 320px stays comfortably clear
     of that with margin for shorter/landscape viewports too), so it holds
     without needing to know this app's actual header height at runtime.

     Selectors are ID-anchored (#wp-live-chat-by-3CX ...) rather than plain
     classes so specificity reliably beats the widget's own scoped
     !important rules on the same properties no matter which stylesheet
     ends up later in the shadow root's DOM order — verified directly
     against the widget's actual compiled CSS, not assumed. */
  #wp-live-chat-by-3CX .panel,
  #wp-live-chat-by-3CX .panel.full-screen {
    width: ${PANEL_WIDTH_PX}px !important;
    height: ${PANEL_HEIGHT_PX}px !important;
    max-height: ${PANEL_HEIGHT_PX}px !important;
    max-width: calc(100vw - 24px) !important;
  }
  #wp-live-chat-by-3CX .panel_content.chat-form,
  #wp-live-chat-by-3CX .panel_content.small-form,
  #wp-live-chat-by-3CX .panel_content.small-form-height,
  #wp-live-chat-by-3CX .panel_content.calling-window {
    width: ${PANEL_WIDTH_PX}px !important;
    height: ${PANEL_HEIGHT_PX}px !important;
    max-height: ${PANEL_HEIGHT_PX}px !important;
    min-height: 0 !important;
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

  useEffect(() => {
    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;

    const injectShadowOverride = () => {
      const shadowRoot = hostRef.current?.shadowRoot;
      if (!shadowRoot || shadowRoot.getElementById('nib-3cx-position-override')) return false;
      const style = document.createElement('style');
      style.id = 'nib-3cx-position-override';
      style.textContent = WIDGET_ROOT_OVERRIDE_CSS;
      shadowRoot.appendChild(style);
      return true;
    };

    // The widget's shadow root exists as soon as its custom element class
    // upgrades (synchronous with the script defining it), but that can
    // happen slightly after this effect runs. Poll briefly rather than
    // relying on script.onload timing.
    pollId = setInterval(() => {
      if (cancelled) return;
      if (injectShadowOverride() && pollId) {
        clearInterval(pollId);
        pollId = null;
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
    };
  }, []);

  return (
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
  );
}
