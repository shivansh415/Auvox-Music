import { ImageResponse } from "next/og";

export const alt = "AUVOX Music — Every instrument has a voice waiting to be found.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The share card: peach field, the headline, a red accent, the wordmark bottom-left. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #fae3c5 0%, #f3d3a8 60%, #e7b47e 100%)",
          color: "#1e1e1e",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 18, letterSpacing: 8, textTransform: "uppercase", opacity: 0.7 }}>
          <div style={{ width: 40, height: 1, background: "#1e1e1e" }} />
          The Verse Universe
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 92, lineHeight: 1.02, letterSpacing: -2 }}>
          <span>Every instrument has</span>
          <span>
            a voice waiting to be <span style={{ color: "#850909" }}>found.</span>
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 56, letterSpacing: -1 }}>auvox</span>
            <span style={{ fontSize: 16, letterSpacing: 10, textTransform: "uppercase", color: "#850909" }}>Music</span>
          </div>
          <span style={{ fontSize: 18, letterSpacing: 6, textTransform: "uppercase", opacity: 0.6 }}>Toronto · Guitar Verse · Piano Verse</span>
        </div>
      </div>
    ),
    size,
  );
}
