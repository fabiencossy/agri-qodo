import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

export interface BreadcrumbItem {
  label: string;
  href?: Route;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Fil d'ariane" className="border-b border-border bg-background/50">
      <ol className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2 text-sm">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-foreground/30" aria-hidden />}
            {item.href ? (
              <Link
                href={item.href}
                className="text-foreground/60 hover:text-foreground hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-foreground">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
