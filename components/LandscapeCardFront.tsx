import type { EthiopianIdData } from "@/types/id-card";
import { formatGregorianDate } from "@/lib/pdf/generate-landscape";
import { BarcodeDisplay } from "./BarcodeDisplay";

type LandscapeCardFrontProps = {
  data: EthiopianIdData;
  className?: string;
};

export function LandscapeCardFront({ data, className = "" }: LandscapeCardFrontProps) {
  const dobGreg = formatGregorianDate(data.dateOfBirthGreg);
  const expiryGreg = formatGregorianDate(data.dateOfExpiryGreg);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-300 shadow-md bg-[#D7F5ED] select-none ${className}`}
      style={{
        aspectRatio: "85.6 / 53.98",
        fontFamily: "'Noto Sans Ethiopic', 'Inter', system-ui, sans-serif",
      }}
      aria-label="Ethiopian Digital ID Card Front"
    >
      {/* 1. Authentic Template Background with fine guilloche, flag, emblem, star & labels */}
      <img
        src="/assets/card-front-template.png"
        alt="Ethiopian Digital ID Template"
        className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
        draggable={false}
      />

      {/* 2. Extracted Portrait Photo without background */}
      {data.photoUrl && (
        <div className="absolute left-[7.1%] top-[31.1%] w-[27.9%] h-[55.5%] rounded-md overflow-hidden">
          <img
            src={data.photoUrl}
            alt={`Portrait of ${data.fullNameEnglish}`}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* 3. Dynamic Text Overlays directly on pristine background */}
      <div className="absolute left-[41.3%] top-[27.5%] w-[38%] flex flex-col space-y-[2.0%] leading-tight pointer-events-none">
        <div>
          <p className="text-[12.5px] sm:text-[14px] font-medium text-black tracking-tight leading-tight">
            {data.fullNameAmharic}
          </p>
          <p className="text-[11.5px] sm:text-[13px] font-normal text-black tracking-tight leading-tight">
            {data.fullNameEnglish}
          </p>
        </div>

        <div className="pt-[4.0%]">
          <p className="text-[11px] sm:text-[12px] font-normal text-black leading-tight">
            {data.dateOfBirthEth} <span className="font-normal text-slate-400">|</span> {dobGreg}
          </p>
        </div>

        <div className="pt-[4.0%]">
          <p className="text-[11px] sm:text-[12px] font-normal text-black leading-tight">
            {data.sexAmharic} <span className="font-normal text-slate-400">|</span> {data.sexEnglish}
          </p>
        </div>

        {/* Clear 15-20px vertical Y-offset separation between Sex and Expiry */}
        <div className="pt-[5.5%]">
          <p className="text-[11px] sm:text-[12px] font-normal text-black leading-tight">
            {data.dateOfExpiryEth} <span className="font-normal text-slate-400">|</span> {expiryGreg}
          </p>
        </div>
      </div>

      {/* 4. Extracted Barcode & FAN Number inside white container (reduced by 10% to prevent collision, aligned bottom-center) */}
      <div className="absolute left-[45.8%] top-[77.7%] w-[29.2%] h-[15.0%]">
        <BarcodeDisplay fanNumber={data.fanNumber} className="w-full h-full" />
      </div>

      {/* 5. Extracted Ghost Photo (positioned below Fayda watermark) */}
      {data.photoUrl && (
        <div className="absolute left-[78.3%] top-[69.7%] w-[11.5%] h-[23.5%] rounded-sm overflow-hidden opacity-85 pointer-events-none">
          <img src={data.photoUrl} alt="Ghost portrait" className="w-full h-full object-cover" />
        </div>
      )}

      {/* 6. Dynamic Vertical Issue Date on Left Margin */}
      <div
        className="absolute left-[3.6%] bottom-[6.5%] origin-bottom-left -rotate-90 pointer-events-none select-none whitespace-nowrap text-[8.5px] sm:text-[10px] font-bold"
        style={{ letterSpacing: "0.02em" }}
      >
        <span className="text-[#C68932]">የተሰጠበት ቀን: </span>
        <span className="text-slate-900">{data.dateOfIssueEth}</span>
        <span className="text-[#C68932]">&nbsp;&nbsp;Date of Issue: </span>
        <span className="text-slate-900">{formatGregorianDate(data.dateOfIssueGreg)}</span>
      </div>
    </div>
  );
}
