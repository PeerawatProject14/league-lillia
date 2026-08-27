import { LOL } from "./imageCommon";

const DIAMOND_SIZE = 9;

/** Inline SVG diamond — satori shifts a CSS-rotated div by ~1.5px, an img lands exactly. */
function diamondSvg(color: string): string {
  const fill = color.replace("#", "%23");
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><path d='M5 0 L10 5 L5 10 L0 5 Z' fill='${fill}'/></svg>`;
}

/**
 * Hairline separator with a hextech diamond at its centre.
 *
 * Everything is positioned explicitly: satori does not place an absolute child
 * by the parent's justify/align rules, and a pair of mirrored gradients on
 * flex:1 siblings renders asymmetrically.
 */
export function GoldRule({ width, color = LOL.gold }: { width: number; color?: string }) {
  const LINE_Y = 4; // 1px line -> its centre sits at 4.5, the diamond's centre too

  return (
    <div style={{ display: "flex", position: "relative", width, height: DIAMOND_SIZE }}>
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: LINE_Y,
          left: 0,
          width,
          height: 1,
          background: LOL.gold_translucent,
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={diamondSvg(color)}
        width={DIAMOND_SIZE}
        height={DIAMOND_SIZE}
        alt=""
        style={{
          position: "absolute",
          top: 0,
          left: Math.round(width / 2 - DIAMOND_SIZE / 2),
        }}
      />
    </div>
  );
}
