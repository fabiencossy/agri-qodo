import type { NextConfig } from "next";

/**
 * En prod (Vercel), on proxy `/api/*` vers le backend Railway pour avoir
 * un seul domaine côté navigateur (agri.qodo.ch) — donc pas de CORS,
 * pas de pré-flight, et on peut garder `NEXT_PUBLIC_API_URL` vide.
 *
 * En dev local, ces rewrites ne s'appliquent pas car le frontend tape
 * directement sur http://localhost:3001 via NEXT_PUBLIC_API_URL.
 *
 * Variable requise sur Vercel (Project → Settings → Environment Variables) :
 *   BACKEND_URL = https://<ton-service-railway>.up.railway.app
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  async rewrites() {
    if (!BACKEND_URL) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
