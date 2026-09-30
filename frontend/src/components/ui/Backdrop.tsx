const GRAIN =
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/* Many stops approximate a gaussian falloff, so the light has no visible edge. */
const GLOW =
    "radial-gradient(closest-side, rgb(124 140 106 / 0.34) 0%, rgb(124 140 106 / 0.26) 16%, rgb(124 140 106 / 0.16) 34%, rgb(124 140 106 / 0.08) 52%, rgb(124 140 106 / 0.03) 72%, rgb(124 140 106 / 0.008) 88%, transparent 100%)";

/* The halftone only shows where the light is. */
const SCREEN_MASK = "radial-gradient(60vmax 44vmax at 16% 104%, #000 0%, rgb(0 0 0 / 0.5) 38%, transparent 100%)";

/**
 * The room behind everything: near-black, with one dim sage light rising from
 * the lower left, a fine halftone screen inside it, and grain over all of it.
 * The light drifts on a 90s cycle, too slowly to notice while reading.
 */
export default function Backdrop() {
    return (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-void">
            <div
                data-drift
                className="absolute bottom-[-54vmax] left-[calc(16%-48vmax)] size-[96vmax] rounded-full"
                style={{ background: GLOW, animation: "drift 90s var(--ease-in-out) infinite alternate" }}
            />
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage: "radial-gradient(rgb(236 235 231 / 0.1) 0.9px, transparent 1.3px)",
                    backgroundSize: "5px 5px",
                    maskImage: SCREEN_MASK,
                    WebkitMaskImage: SCREEN_MASK,
                }}
            />
            {/* grain stops the dark gradient from banding */}
            <div className="absolute inset-0 opacity-[0.06] mix-blend-soft-light" style={{ backgroundImage: GRAIN }} />
        </div>
    );
}
