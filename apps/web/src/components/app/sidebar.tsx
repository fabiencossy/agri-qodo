import Link from "next/link";
import { NavContent } from "./nav-content";

/**
 * Sidebar permanente affichée sur grand écran (lg+, ≥1024px).
 * Sur mobile/tablet, c'est le HamburgerDrawer qui prend le relais.
 */
export function Sidebar() {
  return (
    <aside className="hidden h-screen w-64 flex-col border-r border-border bg-background lg:sticky lg:top-0 lg:flex">
      <header className="flex h-14 items-center border-b border-border px-4">
        <Link href="/" className="text-lg font-bold text-green">
          🌱 Agri Qodo
        </Link>
      </header>
      <NavContent />
    </aside>
  );
}
