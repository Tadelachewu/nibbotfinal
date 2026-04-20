import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { Toaster } from '@/components/ui/toaster';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = {
  title: 'Nib International Bank',
  description: 'Dynamic, chatbot-friendly menu system for modern interfaces.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  // We extract the nonce from the custom header we set in middleware.ts
  const nonce = headersList.get('x-nonce') || undefined;
  // read theme cookie server-side so we can set it before hydration
  const cookieHeader = headersList.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|; )nib_theme=([^;]+)/);
  const initialTheme = match ? match[1] : 'system';

  return (
    <html lang="en" className={initialTheme === 'dark' ? 'dark' : initialTheme === 'light' ? 'light' : ''}>
      <head>
        {/* Next.js internal scripts should now automatically use this nonce if set in headers */}
        {nonce && <meta property="csp-nonce" content={nonce} />}
        <script
          {...(nonce ? { nonce } : {})}
          dangerouslySetInnerHTML={{ __html: `(function(){try{const t=${JSON.stringify(initialTheme)};const r=document.documentElement;function apply(theme){if(theme==='dark')r.classList.add('dark');else if(theme==='light')r.classList.remove('dark');else{const p=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;if(p)r.classList.add('dark');else r.classList.remove('dark');}};apply(t);}catch(e){}})();` }}
        />
      </head>
      <body className={`${inter.className} antialiased`}>
        <FirebaseClientProvider>
          <FirebaseErrorListener />
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
