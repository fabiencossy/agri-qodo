import { Tractor } from "lucide-react";
import Link from "next/link";

interface BrandLogoProps {
  href?: string;
  size?: "md" | "lg";
}

export function BrandLogo({ href = "/", size = "md" }: BrandLogoProps) {
  const iconSize = size === "lg" ? "h-6 w-6" : "h-5 w-5";
  const textSize = size === "lg" ? "text-xl" : "text-lg";
  return (
    <Link
      href={href as never}
      className={`inline-flex items-center gap-1.5 font-bold text-green ${textSize}`}
    >
      <Tractor className={iconSize} aria-hidden />
      <span>Agri Qodo</span>
    </Link>
  );
}
