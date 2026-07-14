import Image from "next/image";

/**
 * The club mark.
 *
 * Two source files, because the artwork is a solid silhouette with no outline: the black
 * mark disappears on a dark background and the white one disappears on a light one. Rather
 * than recolour at runtime, both are rendered and CSS shows whichever suits the active
 * theme. Dark mode is class-based (`.dark` on <html>), so this switches instantly with the
 * footer toggle -- no flash, no JavaScript.
 *
 * Use `variant="white"` to force the white mark regardless of theme: the dashboard sidebar
 * is always dark, so the theme-following version would vanish there in light mode.
 *
 * Intrinsic size of the trimmed artwork is 945x1253.
 */

const RATIO = 945 / 1253;

export function Logo({
  height = 40,
  className = "",
  variant = "auto"
}: {
  height?: number;
  className?: string;
  variant?: "auto" | "white" | "black";
}) {
  const width = Math.round(height * RATIO);

  if (variant !== "auto") {
    return (
      <Image
        src={variant === "white" ? "/logo-white.png" : "/logo-black.png"}
        alt="MAD Club"
        width={width}
        height={height}
        priority
        className={`object-contain ${className}`}
      />
    );
  }

  return (
    <span className={`inline-block shrink-0 ${className}`} style={{ height, width }}>
      <Image
        src="/logo-black.png"
        alt="MAD Club"
        width={width}
        height={height}
        priority
        className="block h-full w-full object-contain dark:hidden"
      />
      <Image
        src="/logo-white.png"
        alt=""
        aria-hidden="true"
        width={width}
        height={height}
        priority
        className="hidden h-full w-full object-contain dark:block"
      />
    </span>
  );
}
