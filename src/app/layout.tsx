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
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  // We extract the nonce from the custom header we set in middleware.ts
  const nonce = headersList.get('x-nonce') || undefined;

  return (
    <html lang="en">
      <head>
        {/* Next.js internal scripts should now automatically use this nonce if set in headers */}
        {nonce && <meta property="csp-nonce" content={nonce} />}
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
