// Client-side CSP helpers: read server-provided nonce and inject nonce-protected <style> rules.
export function getCspNonce(): string | null {
    if (typeof document === 'undefined') return null
    // Prefer explicit meta tag if present
    const meta = document.querySelector('meta[property="csp-nonce"]') as HTMLMetaElement | null
    if (meta?.content) return meta.content

    // Fallback: some pages (or client-side navigations) may not include the meta
    // but scripts rendered server-side often carry the nonce attribute. Read
    // the first script element with a nonce and return it.
    const scriptWithNonce = document.querySelector('script[nonce]') as HTMLScriptElement | null
    if (scriptWithNonce) {
        const n = scriptWithNonce.getAttribute('nonce')
        if (n) return n
    }

    return null
}

let styleCounter = 0
export function createClassWithRules(rules: string): { className: string; tag: HTMLStyleElement } {
    const className = `csp-${Date.now().toString(36)}-${(styleCounter++).toString(36)}`
    const css = `.${className} { ${rules} }`
    const nonce = getCspNonce()
    const tag = document.createElement('style')
    if (nonce) tag.setAttribute('nonce', nonce)
    tag.appendChild(document.createTextNode(css))
    document.head.appendChild(tag)
    return { className, tag }
}

export function injectRawStyle(css: string): HTMLStyleElement | null {
    if (typeof document === 'undefined') return null
    const nonce = getCspNonce()
    const tag = document.createElement('style')
    if (nonce) tag.setAttribute('nonce', nonce)
    tag.appendChild(document.createTextNode(css))
    document.head.appendChild(tag)
    return tag
}
