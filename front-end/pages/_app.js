import '@/styles/globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from "@/components/ui/sonner"
import { Plus_Jakarta_Sans } from 'next/font/google';

const appFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-app-sans',
  display: 'swap',
});

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <div className={`${appFont.className} ${appFont.variable}`}>
        <Component {...pageProps} />
        <Toaster position="top-right" richColors />
      </div>
    </AuthProvider>
  );
}