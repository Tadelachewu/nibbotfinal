"use client";

import { useEffect, useState } from 'react';

const THEME_COOKIE = 'nib_theme';

function setCookie(name: string, value: string, days = 365) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${d.toUTCString()}`;
    document.cookie = `${name}=${value}; ${expires}; path=/`;
}

function readCookie(name: string) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
}

export default function ThemeToggle() {
    const [theme, setTheme] = useState<string>(() => {
        if (typeof window === 'undefined') return 'system';
        return readCookie(THEME_COOKIE) || (localStorage.getItem(THEME_COOKIE) || 'system');
    });

    useEffect(() => {
        const apply = (t: string) => {
            const root = document.documentElement;
            if (t === 'dark') root.classList.add('dark');
            else if (t === 'light') root.classList.remove('dark');
            else {
                const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (prefersDark) root.classList.add('dark'); else root.classList.remove('dark');
            }
        };

        apply(theme);

        if (theme === 'system') {
            // persist choice but allow system-driven toggles
            localStorage.removeItem(THEME_COOKIE);
            setCookie(THEME_COOKIE, 'system');
        } else {
            localStorage.setItem(THEME_COOKIE, theme);
            setCookie(THEME_COOKIE, theme);
        }

        const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => { if (theme === 'system') apply('system'); };
        if (mq && mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq && (mq as any).addListener) (mq as any).addListener(onChange);

        return () => {
            if (mq && mq.removeEventListener) mq.removeEventListener('change', onChange);
            else if (mq && (mq as any).removeListener) (mq as any).removeListener(onChange);
        };
    }, [theme]);

    return (
        <select
            aria-label="Theme"
            className="h-8 px-2 rounded-md bg-card border text-sm"
            value={theme}
            onChange={e => setTheme(e.target.value)}
        >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
        </select>
    );
}
