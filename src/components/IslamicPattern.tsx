import { useId } from "react";

/**
 * Islamic geometric (girih) pattern — a tiled eight-pointed khatam star,
 * the motif found across hawza & mosque architecture (Iranian brickwork,
 * tiles, mashrabiya). Server-safe, zero dependencies.
 *
 * Renders in `currentColor` so it adapts to any accent and both themes.
 * Usage: absolutely position it inside a relative container as a subtle
 * overlay (e.g. opacity-40 text-white/10).
 */
export default function IslamicPattern({
  className,
  opacity = 0.4,
  strokeWidth = 1,
}: {
  className?: string;
  opacity?: number;
  strokeWidth?: number;
}): JSX.Element {
  const patternId = useId();
  return (
    <svg
      aria-hidden="true"
      className={className}
      style={{ opacity }}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern
          id={patternId}
          width="80"
          height="80"
          patternUnits="userSpaceOnUse"
        >
          <g fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
            {/* Eight-pointed star */}
            <path d="M40 12 L48.5 31.5 L68 40 L48.5 48.5 L40 68 L31.5 48.5 L12 40 L31.5 31.5 Z" />
            {/* Edge connectors so stars interlock across tiles */}
            <path d="M0 40 L12 40 M68 40 L80 40 M40 0 L40 12 M40 68 L40 80" />
            {/* Diagonal spokes to neighbouring stars */}
            <path d="M12 12 L31.5 31.5 M48.5 31.5 L68 12 M12 68 L31.5 48.5 M48.5 48.5 L68 68" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
