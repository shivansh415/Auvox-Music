/**
 * A soft seam between two sections: a short gradient laid over the boundary so one background
 * breathes into the next instead of cutting. Put it between the two sections; it takes no space.
 */
export default function Seam({ from, to, height = 220 }: { from: string; to: string; height?: number }) {
  return (
    <div aria-hidden className="pointer-events-none relative z-30 h-0">
      <div
        className="absolute inset-x-0"
        style={{ top: -height / 2, height, background: `linear-gradient(180deg, ${from} 0%, color-mix(in srgb, ${from} 55%, ${to}) 50%, ${to} 100%)` }}
      />
    </div>
  );
}
