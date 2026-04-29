"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // staleTime: 0 — chaque mount considère la cache comme stale et
            // re-fetch en arrière-plan. Combiné à refetchOnWindowFocus=false,
            // ça donne un comportement "toujours frais quand tu navigues" sans
            // spam de requêtes. Indispensable pour que les listes affichent
            // les nouvelles entrées après un POST sans devoir refresh la page.
            staleTime: 0,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
