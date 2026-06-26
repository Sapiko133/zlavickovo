import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size: sizeStr } = await params;
  const size = Math.max(16, Math.min(512, parseInt(sizeStr) || 192));
  const fontSize = Math.floor(size * 0.45);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)",
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: fontSize,
            fontWeight: 800,
            fontFamily: "sans-serif",
            lineHeight: 1,
          }}
        >
          Z
        </span>
      </div>
    ),
    { width: size, height: size }
  );
}
