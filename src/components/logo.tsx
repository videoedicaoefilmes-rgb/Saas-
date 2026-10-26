import Link from "next/link";
import { cn } from "@/lib/utils";

/** Marca provisória — o nome vem de APP_NAME (configurável). */
export function Logo({ name, href = "/", className, inverted }: { name: string; href?: string; className?: string; inverted?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-bold tracking-tight", inverted ? "text-white" : "text-foreground", className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h3l2-3h6l2 3h3v11H4z" />
          <path d="M10 10.5v4l3.5-2z" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span>{name}</span>
    </Link>
  );
}
