import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { BRAND } from "@/lib/brand";
import { I18nProvider } from "@/lib/i18n/client";
import { getLang } from "@/lib/i18n/server";

// The brand typeface, Inter, served from this app's own files
// (src/app/fonts) rather than fetched from Google Fonts: the app builds and
// runs with no internet connection, and nothing is requested from a third
// party. The files are the variable font, so every weight the identity
// allows (400, 500, 600, 700) comes from one file. Inter is licensed under
// the SIL Open Font License (src/app/fonts/OFL.txt).
const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-inter",
  display: "swap",
});

// Characters beyond Western European (ŋ, ł, ş, ...). Only downloaded by a
// browser when a page actually shows one, so it isn't preloaded.
const interExt = localFont({
  src: "./fonts/inter-latin-ext-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-inter-ext",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: BRAND.shortName,
  description: `${BRAND.platformName} — apply to schools, colleges and universities in one place.`,
  applicationName: BRAND.shortName,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${inter.variable} ${interExt.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="min-h-full">
        <I18nProvider lang={lang}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
