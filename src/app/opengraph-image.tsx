import { ImageResponse } from "next/og";

export const alt = "monitorul.ai — Arhiva publică a Monitorului Oficial Partea a II-a";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// All glyphs that appear in the rendered text. Passed via `&text=` so Google
// Fonts returns a glyph-subset TTF instead of WOFF2 (Satori only supports
// OTF/TTF, not WOFF2).
const SUBSET =
  "monitorul.ai Arhiva publică stenogramelor parlamentare din România · Monitorul Oficial, Partea a II-a";

async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(SUBSET)}`;
  const css = await fetch(url).then((r) => r.text());
  const match = css.match(/src:\s*url\((.+?)\)\s*format\('(?:opentype|truetype)'\)/);
  if (!match) throw new Error(`Font fetch failed: ${family} ${weight}`);
  return fetch(match[1]).then((r) => r.arrayBuffer());
}

export default async function Image() {
  const [serif, sans] = await Promise.all([
    loadGoogleFont("Source Serif 4", 400),
    loadGoogleFont("Public Sans", 400),
  ]);

  const PAPER = "#fbfdfd";
  const INK = "#181d22";
  const INK_45 = "#6b727a";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: PAPER,
        display: "flex",
        flexDirection: "column",
        padding: "88px 100px",
        fontFamily: '"Public Sans"',
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <div style={{ position: "relative", width: "96px", height: "96px", display: "flex" }}>
          <div
            style={{
              position: "absolute",
              left: "15px",
              top: "42px",
              width: "12px",
              height: "36px",
              background: INK,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "33px",
              top: "12px",
              width: "12px",
              height: "66px",
              background: INK,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "51px",
              top: "54px",
              width: "12px",
              height: "24px",
              background: INK,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "69px",
              top: "30px",
              width: "12px",
              height: "48px",
              background: INK,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "12px",
              top: "81px",
              width: "72px",
              height: "3px",
              background: INK,
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, display: "flex" }} />

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontFamily: '"Source Serif 4"',
            fontSize: "128px",
            color: INK,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          <span>monitorul</span>
          <span style={{ color: INK_45 }}>.ai</span>
        </div>
        <div
          style={{
            display: "flex",
            color: INK,
            fontSize: "34px",
            marginTop: "32px",
            lineHeight: 1.35,
            maxWidth: "900px",
          }}
        >
          Arhiva stenogramelor parlamentare din România · Monitorul Oficial, Partea a II-a
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Source Serif 4", data: serif, weight: 400, style: "normal" },
        { name: "Public Sans", data: sans, weight: 400, style: "normal" },
      ],
    },
  );
}
