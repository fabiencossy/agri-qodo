import type { Metadata } from "next";
import { CookieBanner } from "@/components/legal/cookie-banner";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agri Qodo",
  description: "ERP métier de l'exploitation agricole suisse",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Providers>{children}</Providers>
        <CookieBanner />
      </body>
    </html>
  );
}
