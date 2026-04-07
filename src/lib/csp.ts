// Client-side CSP helpers: read server-provided nonce and inject nonce-protected <style> rules.
export function getCspNonce(): string | null {
    if (typeof document === 'undefined') return null
    const meta = document.querySelector('meta[property="csp-nonce"]') as HTMLMetaElement | null
    return meta?.content ?? null
}

let styleCounter = 0
export function createClassWithRules(rules: string): string {
    const className = `csp-${Date.now().toString(36)}-${(styleCounter++).toString(36)}`
    const css = `.${className} { ${rules} }`
    const nonce = getCspNonce()
    const tag = document.createElement('style')
    if (nonce) tag.setAttribute('nonce', nonce)
    tag.appendChild(document.createTextNode(css))
    document.head.appendChild(tag)
    return className
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
