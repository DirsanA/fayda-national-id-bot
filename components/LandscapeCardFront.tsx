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

      {/* 2. Extracted Portrait Photo */}
      {data.photoUrl && (
        <div className="absolute left-[7.2%] top-[21.6%] w-[29.9%] h-[67.4%] rounded-lg overflow-hidden shadow-2xs border border-teal-800/15">
          <img
            src={data.photoUrl}
            alt={`Portrait of ${data.fullNameEnglish}`}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* 3. Dynamic Text Overlays directly on pristine background */}
      <div className="absolute left-[41.3%] top-[28.0%] w-[38%] flex flex-col space-y-[2.2%] leading-tight pointer-events-none">
        <div>
          <p className="text-[12.5px] sm:text-[14px] font-extrabold text-slate-950 tracking-tight leading-tight">
            {data.fullNameAmharic}
          </p>
          <p className="text-[11.5px] sm:text-[13px] font-bold text-slate-900 tracking-tight leading-tight">
            {data.fullNameEnglish}
          </p>
        </div>

        <div className="pt-[4.5%]">
          <p className="text-[11px] sm:text-[12.5px] font-bold text-slate-900 leading-tight">
            {data.dateOfBirthEth} <span className="font-normal text-slate-400">|</span> {dobGreg}
          </p>
        </div>

        <div className="pt-[4.0%]">
          <p className="text-[11px] sm:text-[12.5px] font-bold text-slate-900 leading-tight">
            {data.sexAmharic} <span className="font-normal text-slate-400">|</span> {data.sexEnglish}
          </p>
        </div>

        <div className="pt-[3.5%]">
          <p className="text-[11px] sm:text-[12.5px] font-bold text-slate-900 leading-tight">
            {data.dateOfExpiryEth} <span className="font-normal text-slate-400">|</span> {expiryGreg}
          </p>
        </div>
      </div>

      {/* 4. Extracted Barcode & FAN Number inside white container */}
      <div className="absolute left-[45.1%] top-[77.7%] w-[32.4%] h-[15.0%]">
        <BarcodeDisplay fanNumber={data.fanNumber} className="w-full h-full" />
      </div>

      {/* 5. Extracted Ghost Photo (positioned below Fayda watermark) */}
      {data.photoUrl && (
        <div className="absolute left-[82.1%] top-[72.1%] w-[11.2%] h-[21.0%] rounded-md overflow-hidden opacity-75 shadow-2xs pointer-events-none">
          <img src={data.photoUrl} alt="Ghost portrait" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}
