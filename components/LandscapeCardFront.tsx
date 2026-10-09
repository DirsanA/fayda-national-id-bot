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
        <div className="absolute left-[5.1%] top-[22.2%] w-[24.7%] h-[51%] rounded-lg overflow-hidden shadow-2xs border border-teal-800/15">
          <img
            src={data.photoUrl}
            alt={`Portrait of ${data.fullNameEnglish}`}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* 3. Dynamic Text Overlays with subtle clean backdrop */}
      <div className="absolute left-[34.6%] top-[27%] w-[39%] flex flex-col space-y-[0.7%]">
        <div className="bg-[#D8F8F0]/95 px-1 py-0.5 rounded leading-tight">
          <p className="text-[12.5px] sm:text-[14px] font-extrabold text-slate-950 tracking-tight">
            {data.fullNameAmharic}
          </p>
          <p className="text-[11.5px] sm:text-[13px] font-bold text-slate-900 tracking-tight">
            {data.fullNameEnglish}
          </p>
        </div>

        <div className="pt-[1.8%]">
          <div className="bg-[#D8F8F0]/95 px-1 py-0.5 rounded leading-tight">
            <p className="text-[11px] sm:text-[12.5px] font-bold text-slate-900">
              {data.dateOfBirthEth} <span className="font-normal text-slate-400">|</span> {dobGreg}
            </p>
          </div>
        </div>

        <div className="pt-[1.8%]">
          <div className="bg-[#D8F8F0]/95 px-1 py-0.5 rounded leading-tight">
            <p className="text-[11px] sm:text-[12.5px] font-bold text-slate-900">
              {data.sexAmharic} <span className="font-normal text-slate-400">|</span> {data.sexEnglish}
            </p>
          </div>
        </div>

        <div className="pt-[1.8%]">
          <div className="bg-[#D8F8F0]/95 px-1 py-0.5 rounded leading-tight">
            <p className="text-[11px] sm:text-[12.5px] font-bold text-slate-900">
              {data.dateOfExpiryEth} <span className="font-normal text-slate-400">|</span> {expiryGreg}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Extracted Barcode & FAN Number */}
      <div className="absolute left-[40.5%] bottom-[5.8%] w-[31.6%] h-[14.8%]">
        <BarcodeDisplay fanNumber={data.fanNumber} className="w-full h-full" />
      </div>

      {/* 5. Extracted Ghost Photo */}
      {data.photoUrl && (
        <div className="absolute right-[8.4%] bottom-[7.5%] w-[8.1%] h-[16.5%] rounded overflow-hidden opacity-75 shadow-2xs">
          <img src={data.photoUrl} alt="Ghost portrait" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}
