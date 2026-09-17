import { ImageResponse } from "next/og";

import { OG_SIZE, OgImageElement } from "@/lib/seo/og-image-element";

export const runtime = "edge";
export const alt = "Unsparing — learn to code with a senior-engineer AI reviewer";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<OgImageElement />, { ...size });
}
