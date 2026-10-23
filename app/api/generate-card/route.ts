import { NextRequest, NextResponse } from "next/server";
import { renderCombinedCardBuffer, renderFrontCardBuffer, renderBackCardBuffer } from "@/lib/telegram/card-renderer";
import type { EthiopianIdData } from "@/types/id-card";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data: EthiopianIdData = {
      fullNameAmharic: body.fullNameAmharic || "",
      fullNameEnglish: body.fullNameEnglish || "",
      dateOfBirthEth: body.dateOfBirthEth || "",
      dateOfBirthGreg: body.dateOfBirthGreg || "",
      sexAmharic: body.sexAmharic || "",
      sexEnglish: body.sexEnglish || "",
      dateOfExpiryEth: body.dateOfExpiryEth || "",
      dateOfExpiryGreg: body.dateOfExpiryGreg || "",
      dateOfIssueEth: body.dateOfIssueEth || "",
      dateOfIssueGreg: body.dateOfIssueGreg || "",
      fanNumber: body.fanNumber || "",
      finNumber: body.finNumber || "",
      serialNumber: body.serialNumber || "",
      phoneNumber: body.phoneNumber || "",
      nationalityAmharic: body.nationalityAmharic || "ኢትዮጵያዊ",
      nationalityEnglish: body.nationalityEnglish || "Ethiopian",
      regionAmharic: body.regionAmharic || "",
      regionEnglish: body.regionEnglish || "",
      subcityAmharic: body.subcityAmharic || "",
      subcityEnglish: body.subcityEnglish || "",
      woredaAmharic: body.woredaAmharic || "",
      woredaEnglish: body.woredaEnglish || "",
      photoUrl: body.photoUrl || "",
      qrCodeUrl: body.qrCodeUrl || "/assets/target-qr.png",
      barcodeUrl: body.barcodeUrl,
    };

    // Render using Template 3 ("template3")
    const [combinedBuf, frontBuf, backBuf] = await Promise.all([
      renderCombinedCardBuffer(data, "color", "template3"),
      renderFrontCardBuffer(data, "color", "template3"),
      renderBackCardBuffer(data, "template3"),
    ]);

    const combinedBase64 = `data:image/png;base64,${combinedBuf.toString("base64")}`;
    const frontBase64 = `data:image/png;base64,${frontBuf.toString("base64")}`;
    const backBase64 = `data:image/png;base64,${backBuf.toString("base64")}`;

    return NextResponse.json({
      success: true,
      combinedUrl: combinedBase64,
      frontUrl: frontBase64,
      backUrl: backBase64,
    });
  } catch (err: unknown) {
    console.error("[generate-card API error]:", err);
    const message = err instanceof Error ? err.message : "Failed to generate card";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
