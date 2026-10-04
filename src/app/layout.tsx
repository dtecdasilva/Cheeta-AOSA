import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/context/AuthContext";
import { BRAND } from "@/lib/brand";

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${interExt.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="min-h-full">
        <AuthProvider>
          <AppProvider>{children}</AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
