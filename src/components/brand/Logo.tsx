import Image from "next/image";
import { BRAND } from "@/lib/brand";

/**
 * The Cheeta Academia Online logo.
 *
 * - `variant="full"`: the full logo, for headers and sign-in screens.
 * - `variant="mark"`: the icon on its own, for compact layouts.
 *
 * The artwork is only ever scaled as a whole — fixed height, width
 * following the file's own ratio — so its proportions, lettering and
 * colours are never altered. Size it with `height`; don't pass width
 * classes.
 */
export function Logo({
  variant = "full",
  height = 32,
  label = BRAND.navLabel,
  sublabel,
  priority = false,
  className = "",
}: {
  variant?: "full" | "mark";
  /** Rendered height in pixels. */
  height?: number;
  /** Text beside the mark when no full-logo file is configured. */
  label?: string;
  /** Optional second line under the label, e.g. the portal name. */
  sublabel?: string;
  priority?: boolean;
  className?: string;
}) {
  const full = BRAND.logo.full;

  if (variant === "full" && full) {
    return (
      <span className={`inline-flex min-w-0 items-center gap-3 ${className}`}>
        <Image
          src={full.src}
          alt={BRAND.name}
          width={Math.round((full.width / full.height) * height)}
          height={height}
          priority={priority}
          style={{ height, width: "auto" }}
          className="shrink-0"
        />
        {sublabel && (
          <span className="border-l border-[var(--color-line)] pl-3 text-xs font-medium text-[var(--color-ink-soft)]">{sublabel}</span>
        )}
      </span>
    );
  }

  const mark = BRAND.logo.mark;
  const image = (
    <Image
      src={mark.src}
      alt={variant === "mark" ? BRAND.name : ""}
      width={Math.round((mark.width / mark.height) * height)}
      height={height}
      priority={priority}
      style={{ height, width: "auto" }}
      className="shrink-0"
    />
  );

  if (variant === "mark") return <span className={`inline-flex shrink-0 ${className}`}>{image}</span>;

  return (
    <span className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}>
      {image}
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-bold leading-tight tracking-tight text-[var(--color-ink)]">{label}</span>
        {sublabel && <span className="block truncate text-[11px] leading-tight text-[var(--color-ink-faint)]">{sublabel}</span>}
      </span>
    </span>
  );
}
