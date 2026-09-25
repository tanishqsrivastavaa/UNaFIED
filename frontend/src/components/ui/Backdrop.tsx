/**
 * The dusk behind everything. Glass is only glass if there is light behind it
 * to blur, so this is structural, not decoration. Three soft glows drift on
 * long, out-of-step cycles so the room never visibly loops.
 */
export default function Backdrop() {
    return (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-dusk">
            <div
                data-drift
                className="absolute -left-[22vmax] -top-[26vmax] size-[82vmax] rounded-full"
                style={{
                    background: "radial-gradient(closest-side, rgb(74 31 54 / 0.95) 0%, rgb(58 26 44 / 0.8) 22%, rgb(43 21 34 / 0.55) 45%, rgb(43 21 34 / 0.25) 68%, rgb(43 21 34 / 0.08) 85%, transparent 100%)",
                    animation: "drift-a 64s var(--ease-in-out) infinite alternate",
                }}
            />
            <div
                data-drift
                className="absolute -bottom-[30vmax] -right-[20vmax] size-[78vmax] rounded-full"
                style={{
                    background: "radial-gradient(closest-side, rgb(78 45 16 / 0.9) 0%, rgb(60 36 15 / 0.75) 22%, rgb(42 26 15 / 0.5) 45%, rgb(42 26 15 / 0.22) 68%, rgb(42 26 15 / 0.07) 85%, transparent 100%)",
                    animation: "drift-b 78s var(--ease-in-out) infinite alternate",
                }}
            />
            <div
                data-drift
                className="absolute bottom-[-18vmax] left-[30%] size-[46vmax] rounded-full opacity-70"
                style={{
                    background: "radial-gradient(closest-side, rgb(242 195 188 / 0.1), rgb(242 195 188 / 0.05) 45%, rgb(242 195 188 / 0.015) 75%, transparent 100%)",
                    animation: "drift-c 52s var(--ease-in-out) infinite alternate",
                }}
            />
            {/* vignette keeps the eye in the middle */}
            <div
                className="absolute inset-0"
                style={{ background: "radial-gradient(120% 90% at 50% 45%, transparent 55%, rgb(0 0 0 / 0.55) 100%)" }}
            />
            {/* grain stops the dark gradients from banding */}
            <div
                className="absolute inset-0 opacity-[0.07] mix-blend-soft-light"
                style={{
                    backgroundImage:
                        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
                }}
            />
        </div>
    );
}
