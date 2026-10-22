import { ImageResponse } from "next/og";
import { getSettings } from "@/services/data";

export const alt = "Custom Furniture & Kitchen Set";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const s = await getSettings();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#FDFBF7", color: "#1C1C1C" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 32, fontWeight: 700 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: "#1C1C1C", color: "#C8A46A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {s.business_name.charAt(0)}
          </div>
          {s.business_name}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.1 }}>Custom Furniture & Kitchen Set</div>
          <div style={{ fontSize: 40, color: "#9A6B43", marginTop: 12 }}>Sesuai Ruang, Sesuai Gaya Anda.</div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#3A3A3A" }}>{`Harga transparan · Kalkulator online · ${s.city ?? "Bandung"}`}</div>
      </div>
    ),
    size,
  );
}
