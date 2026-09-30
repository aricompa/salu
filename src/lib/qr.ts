import "server-only";
import QRCode from "qrcode";
import { tableUrl } from "@/lib/table-url";

/**
 * QR for a table card as an SVG string: high error correction (survives a smudge
 * or a folded corner) and the standard 4-module quiet zone. Default black on white.
 */
export async function tableQrSvg(siteUrl: string, token: string): Promise<string> {
  return QRCode.toString(tableUrl(siteUrl, token), {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 4,
  });
}
