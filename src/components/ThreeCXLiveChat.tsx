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

// #wp-live-chat-by-3CX (the <call-us> element) is ITSELF a custom element
// that attaches a SECOND, nested shadow root once it actually connects to
// the PBX — confirmed by inspecting the real, connected widget directly
// (only reachable once it genuinely connects; never observed locally,
// where the CORS-blocked connection means the widget never gets that far —
// which is exactly why things that touch .minimized-button worked on
// localhost but not on the deployed, actually-connected site). All of the
// widget's real content — .minimized-button included — lives in THAT
// nested shadow root, not as light-DOM children of #wp-live-chat-by-3CX.
// Plain querySelector never pierces a shadow boundary, nested or not, so
// every lookup of .minimized-button has to explicitly also check
// `widgetRoot.shadowRoot`.
function resolveMinimizedButton(widgetRoot: HTMLElement): HTMLElement | null {
  const direct = widgetRoot.querySelector('.minimized-button');
  if (direct instanceof HTMLElement) return direct;
  const nested = widgetRoot.shadowRoot;
  if (nested) {
    const btn = nested.querySelector('.minimized-button');
    if (btn instanceof HTMLElement) return btn;
  }
  return null;
}

// Finds the widget's actual clickable bubble button via a breadth-first
// shadow-root walk (same approach the position/badge logic below relies
// on). Self-contained rather than sharing code with that logic, on
// purpose — this only needs to run once per call (a menu button click), not
// continuously, and keeping it separate avoids touching the already-tuned
// polling/observer logic for an unrelated feature.
function findMinimizedButton(): HTMLElement | null {
  const direct = document.getElementById('wp-live-chat-by-3CX');
  if (direct) {
    const btn = resolveMinimizedButton(direct);
    if (btn) return btn;
  }

  const queue: (Document | ShadowRoot)[] = [document];
  const visited = new Set<Document | ShadowRoot>();

  while (queue.length > 0) {
    const root = queue.shift()!;
    if (visited.has(root)) continue;
    visited.add(root);

    const widgetRoot = root.getElementById?.('wp-live-chat-by-3CX');
    if (widgetRoot) {
      const btn = resolveMinimizedButton(widgetRoot);
      if (btn) return btn;
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

// Injected as-is into EVERY shadow root ensureOverridesEverywhere discovers
// — both the outer one (where #wp-live-chat-by-3CX is a real, styleable
// descendant) and #wp-live-chat-by-3CX's own nested shadow root (where all
// of the widget's actual content — .panel, .minimized-button, etc. — lives,
// but #wp-live-chat-by-3CX itself is the HOST of that tree, not a member of
// it, so a selector like "#wp-live-chat-by-3CX .panel" can never match
// anything there). That's why only the ID-selector rule below targets
// #wp-live-chat-by-3CX directly (correct for the outer root; harmlessly
// matches nothing when injected into the nested one), while every other
// rule is a bare class selector with no ancestor prefix — it simply won't
// match anything in whichever tree it doesn't apply to, and correctly
// matches in the one where it does. (This actually happened: with the
// ancestor prefix on every rule, the position/z-index fix worked because
// #wp-live-chat-by-3CX genuinely lives in the outer tree, but the
// background color and badge/button-finding logic silently no-opped
// forever, since .minimized-button only exists one shadow level deeper.)
const WIDGET_ROOT_OVERRIDE_CSS = `
  #wp-live-chat-by-3CX {
    position: absolute !important;
    right: 0 !important;
    bottom: 0 !important;
    left: auto !important;
    top: auto !important;
    /* 55, not 30 — the "Ask a Question" and KYC/status/rating input bars in
       ChatInterface.tsx are both z-50, sticky, full-width, and render
       directly above the footer: the exact spot this bubble is anchored
       to. At z-30 those bars always covered it, any time either was open.
       Above both guarantees the bubble is never covered by either. */
    z-index: 55 !important;
    overflow: visible !important;
    /* The widget sets these CSS custom properties once, inline, on this
       same root element (confirmed by reading callus.js) — every dark
       element throughout the widget (.single-button, and others not yet
       individually found) reads its background from one of these via
       var(), rather than having its own hardcoded color. Redeclaring them
       here with !important beats that inline declaration (verified
       directly) and cascades down to every consumer at once, instead of
       chasing each dark element's class name one at a time — which is
       exactly what kept happening: .header-root, .footer-root, .start-new,
       and .single-button all turned out to be four separate elements
       found one screenshot at a time. This is the systemic fix; the
       specific class overrides below are kept too, as a safety net for
       whatever element doesn't route through one of these variables.

       --call-us-main-accent-color is set for a different, sharper reason:
       most icon fills (.action-button, the send button) read
       var(--call-us-main-accent-color, var(--call-us-form-header-background, ...))
       — accent color first, form-header-background as their OWN fallback.
       Left unset, that fallback resolved to the pink above, so the send
       icon and similar controls rendered pink-on-pink and effectively
       disappeared — confirmed directly (.send-trigger.send_enable svg
       carries the widget's own !important on this exact fill). Setting
       accent-color explicitly is what the widget's own fallback chain
       checks FIRST, intercepting it before it ever reaches the pink
       fallback, without needing to touch form-header-background itself
       (still correctly colors .single-button's background). */
    --call-us-form-header-background: #feebe7 !important;
    --call-us-plate-background-color: #feebe7 !important;
    --call-us-plate-font-color: #763717 !important;
    --call-us-main-accent-color: #763717 !important;
  }

  .panel,
  .panel_content {
    max-height: var(--nib-3cx-panel-max-h, 460px) !important;
    max-width: var(--nib-3cx-panel-max-w, 320px) !important;
  }

  .minimized-button {
    transform: scale(var(--nib-3cx-bubble-scale, 0.9)) !important;
    transform-origin: bottom right !important;
    /* A deeper, bolder amber than the plain avatar gold (#f4a61b, still
       used for the "Live" badge text) — #f4a61b reads fine at small badge
       size but looks pale at full bubble size, so this bubble specifically
       uses a richer shade in the same gold family rather than the exact
       avatar hex. The widget's own default is 3CX blue (#0596d4). The icon
       itself is untouched (same chat glyph, still centered by the widget's
       own layout), only recolored for contrast against the new background. */
    background-color: #d97706 !important;
  }
  .minimized-button svg {
    fill: #763717 !important;
  }

  /* The expanded chat panel's header (.header-root — title bar with the
     operator/logo) and footer (.footer-root — message input area). Neither
     has a background set via a plain CSS rule in the widget's own
     stylesheet (confirmed by reading callus.js) — both are colored at
     runtime via Vue-bound inline styles, which a plain CSS rule can't beat
     on specificity alone, but !important always can, regardless of origin.
     .header-root's default text/icon color is white-on-blue for contrast
     against the widget's own blue; changing only the background without
     also darkening the text would leave near-white text on a near-white
     pink background, so every descendant is force-recolored too. */
  .header-root,
  .footer-root {
    background-color: #feebe7 !important;
  }
  .header-root,
  .header-root * {
    color: #763717 !important;
    fill: #763717 !important;
  }

  /* .header-root has two sizes in the widget's own CSS: a normal ~40px bar
     during an active chat, and a "large" ~163px variant (.header-large /
     .calling-window) that shows a big circular operator/logo image before
     a chat starts — that big variant is what was "so large." Scoped to
     just that variant so the already-compact normal header is untouched.
     The circular logo itself (.operator-img-container, 130px default) is
     shrunk separately — a smaller header alone wouldn't shrink the logo,
     since the logo's size isn't derived from the header's height. */
  .header-root.header-large,
  .header-root.calling-window {
    height: 80px !important;
  }
  /* .operator-img-container (the circular logo) and .operator_name ("NIB
     Contact") both live inside .operator-info, stacked in a column and
     centered as one block — which is why the logo sat directly above the
     name, both centered, well below "Powered by 3CX". Pulling the logo out
     of that stack (position: absolute, relative to .header-root, which is
     already position:relative in the widget's own CSS) and placing it
     top-left puts it on the same row/height as "Powered by 3CX" (top-right,
     via .powered-by's own existing position) — "parallel" to it. With the
     logo out of flow, .operator_name naturally moves up to where the logo
     used to start, landing a bit down from that top row rather than
     jammed at the very top; centered explicitly since the column layout's
     centering doesn't itself center the *text* within .operator_name. */
  .header-root.header-large .operator-img-container,
  .header-root.calling-window .operator-img-container {
    position: absolute !important;
    top: 10px !important;
    left: 12px !important;
    width: 32px !important;
    height: 32px !important;
    margin: 0 !important;
  }
  .header-root.header-large .operator_name,
  .header-root.calling-window .operator_name {
    text-align: center !important;
    width: 100% !important;
  }

  /* The "Start new" bar (.start-new) is a separate element from
     .footer-root — its own background/text color, not inherited from the
     footer fix above, which is why it was still dark. Same treatment as
     the header: background matches, text darkened for contrast since its
     default is also white-on-dark. */
  .start-new {
    background-color: #feebe7 !important;
    color: #763717 !important;
  }

  /* .single-button — a distinct "start chatting" CTA bar shown inside the
     panel before a conversation begins (separate from both .footer-root
     and .minimized-button, the latter being the always-present floating
     page-corner bubble, confirmed via direct inspection of the live
     widget). Same white-icon-on-dark-gray default as everything else here;
     same treatment. */
  .single-button {
    background-color: #feebe7 !important;
  }
  .single-button svg {
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
    let pollTicks = 0;
    // One dedicated MutationObserver per discovered shadow root, not just
    // the outermost one — childList mutations don't cross shadow
    // boundaries, so an observer on the outer shadow root alone can never
    // see changes happening inside a nested one (see resolveMinimizedButton
    // above for why a nested shadow root exists here at all).
    const observedRoots = new Map<ShadowRoot, MutationObserver>();
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

      // Previously "fill whatever room exists" — on a tall card that meant
      // a mostly-empty .panel_body (it's flex:1, so it just stretches to
      // fill however much the panel is given). Capped at 380px so the
      // panel stays genuinely compact instead of growing with the card,
      // while the existing max(260, ...) floor still guarantees it never
      // exceeds the header-clearance-safe space on a short viewport.
      const availableHeight = Math.floor(Math.min(380, Math.max(260, footerRect.top - headerRect.bottom - 12)));
      // Floor raised from 260 to 300 — the header row (logo + title +
      // "Powered by 3CX" + close button) doesn't fit in 260px regardless of
      // .panel_head_title's own flex-grow/ellipsis handling; it truncated
      // to near-nothing ("NIB Contact" → "B Con..."). 300px is still
      // compact, just no longer narrower than the header actually needs.
      const availableWidth = Math.floor(Math.max(300, Math.min(320, containerRect.width - 16)));
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

      const candidate = resolveMinimizedButton(root);
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

    const observeRoot = (shadowRoot: ShadowRoot) => {
      if (observedRoots.has(shadowRoot)) return;
      const obs = new MutationObserver(() => ensureOverridesEverywhere());
      obs.observe(shadowRoot, { childList: true, subtree: true });
      observedRoots.set(shadowRoot, obs);
    };

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
        observeRoot(sr);

        const root = sr.getElementById('wp-live-chat-by-3CX') as HTMLElement | null;
        if (root) {
          updateLiveBadgePosition(root);
          // #wp-live-chat-by-3CX's real content — .minimized-button
          // included — lives in ITS OWN nested shadow root (see
          // resolveMinimizedButton above), which the generic
          // querySelectorAll('*') walk below can't discover on its own
          // until that nested root actually exists — check it directly.
          const nestedShadow = root.shadowRoot;
          if (nestedShadow && !visited.has(nestedShadow)) queue.push(nestedShadow);
        }

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
    // happen slightly after this effect runs — and #wp-live-chat-by-3CX
    // existing is NOT enough on its own: its real content, including
    // .minimized-button, only appears once ITS OWN nested shadow root
    // attaches, which happens later still (only after the widget actually
    // connects to the PBX) and via a custom-element *upgrade* rather than a
    // regular DOM insertion — something no childList MutationObserver can
    // ever catch, regardless of `subtree`. So this keeps polling — not just
    // for the outer element, but until resolveMinimizedButton actually
    // succeeds — rather than stopping as soon as the outer wrapper exists.
    // (That was the actual bug: it worked on localhost, where the widget
    // never gets far enough to connect and CSS/positioning on the outer
    // wrapper alone was sufficient; it silently failed on the real deployed
    // site, where the widget does connect and its real content — and
    // everything targeting it, like the badge and the button's own
    // background color — lives one shadow level deeper.)
    const MAX_POLL_TICKS = 300; // ~60s at 200ms — safety cap, not a real limit in practice
    pollId = setInterval(() => {
      if (cancelled) return;
      ensureOverridesEverywhere();
      pollTicks += 1;

      if (!docObserver) {
        const docRoot = document.getElementById('wp-live-chat-by-3CX') as HTMLElement | null;
        if (docRoot) {
          docObserver = new MutationObserver(() => ensureOverridesEverywhere());
          docObserver.observe(docRoot, { childList: true, subtree: true });
        }
      }

      const shadowWidgetRoot = hostRef.current?.shadowRoot?.getElementById('wp-live-chat-by-3CX') as HTMLElement | null;
      const docWidgetRoot = document.getElementById('wp-live-chat-by-3CX') as HTMLElement | null;
      const buttonFound =
        (shadowWidgetRoot && !!resolveMinimizedButton(shadowWidgetRoot)) ||
        (docWidgetRoot && !!resolveMinimizedButton(docWidgetRoot));

      if ((buttonFound || pollTicks >= MAX_POLL_TICKS) && pollId) {
        clearInterval(pollId);
        pollId = null;
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
      observedRoots.forEach(obs => obs.disconnect());
      observedRoots.clear();
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
        //
        // This used to also handle a `hidden` prop, toggled while the "Ask a
        // Question" bar was open to avoid a visual overlap. Removed once the
        // z-index below made that overlap impossible in the first place —
        // ChatInterface.tsx's input bars are all z-50; this is z-55 — so
        // there was nothing left for `hidden` to protect against. (An even
        // earlier version conditionally unmounted this whole component
        // instead of hiding it, which was the actual bug behind "Live Agent
        // chat is still loading": it destroyed the 3CX widget instance
        // every time kbMode turned on, so openThreeCXLiveChat() — which the
        // always-visible "Live Agent" menu button calls — had no widget
        // left to find.)
        style={{
          position: 'absolute',
          right: '4px',
          bottom: '100%',
          // Matches #wp-live-chat-by-3CX's z-index in WIDGET_ROOT_OVERRIDE_CSS
          // above — kept in sync so both the host's own stacking context and
          // the widget content inside it agree. Higher than every input bar
          // in ChatInterface.tsx (all z-50) so this can never be visually
          // covered by any of them, regardless of which is open.
          zIndex: 55,
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
