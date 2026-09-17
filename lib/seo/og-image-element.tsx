export const OG_SIZE = { width: 1200, height: 630 };

/**
 * Renders as an inert JSX tree — no next/og import here, so this file can
 * stay plain and be unit-testable later if needed. `next/og`'s
 * ImageResponse takes this element directly.
 */
export function OgImageElement() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#0d0e0c",
        padding: 64,
        fontFamily: "monospace",
      }}
    >
      {/* Eyebrow */}
      <div style={{ display: "flex", color: "#e6a637", fontSize: 22, letterSpacing: 4 }}>
        PRACTICE-FIRST, NOT LECTURE-FIRST
      </div>

      {/* Headline */}
      <div
        style={{
          display: "flex",
          marginTop: 28,
          fontSize: 60,
          fontWeight: 700,
          lineHeight: 1.15,
          color: "#f4f4f1",
          maxWidth: 980,
        }}
      >
        Learn to code with a mentor who won&apos;t let you get away with “it works.”
      </div>

      {/* Mock review card, echoing the landing-page hero */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: "auto",
          border: "2px solid #353630",
          borderRadius: 10,
          background: "#151613",
          padding: 24,
          maxWidth: 760,
        }}
      >
        <div style={{ display: "flex", color: "#a6a69b", fontSize: 20 }}>mentor —</div>
        <div style={{ display: "flex", marginTop: 8, color: "#f4f4f1", fontSize: 22, lineHeight: 1.5 }}>
          Not sufficient. What happens to your callback when the loop finishes before it runs?
        </div>
      </div>

      {/* Footer wordmark */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: 36,
          fontSize: 26,
          color: "#e6a637",
          fontWeight: 700,
        }}
      >
        <div style={{ display: "flex" }}>{"›_"}</div>
        <div style={{ display: "flex", marginLeft: 10, color: "#f4f4f1" }}>unsparing</div>
      </div>
    </div>
  );
}
