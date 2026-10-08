import type { EthiopianIdData } from "@/types/id-card";
import { GuillochePattern } from "./GuillochePattern";

type LandscapeCardBackProps = {
  data: EthiopianIdData;
  className?: string;
};

export function LandscapeCardBack({ data, className = "" }: LandscapeCardBackProps) {
  const qrSource = data.qrCodeUrl || "/assets/target-qr.png";

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-300 shadow-md bg-[#D7F5ED] select-none ${className}`}
      style={{
        aspectRatio: "85.6 / 53.98",
        fontFamily: "'Noto Sans Ethiopic', 'Inter', system-ui, sans-serif",
      }}
      aria-label="Ethiopian Digital ID Card Back"
    >
      {/* High-security Guilloche background */}
      <GuillochePattern />

      {/* Main card content container */}
      <div className="relative z-10 flex flex-col h-full p-3 sm:p-3.5 justify-between">
        {/* Main 2-column section: Contact & Address on Left, Huge QR Code on Right */}
        <div className="flex items-stretch justify-between gap-2.5 flex-1 pt-0.5">
          {/* Left Column: Phone, Nationality, Address, FIN */}
          <div className="flex-1 flex flex-col justify-between py-0.5">
            {/* Phone Number */}
            <div>
              <span className="text-[8.5px] font-semibold text-[#B45309] block mb-0.5 tracking-tight">
                ስልክ | Phone Number
              </span>
              <p className="text-[12px] sm:text-[13px] font-bold text-slate-950 leading-tight">
                {data.phoneNumber}
              </p>
            </div>

            {/* Nationality */}
            <div>
              <span className="text-[8.5px] font-semibold text-[#B45309] block tracking-tight">
                ዜግነት | Nationality
              </span>
              <span className="text-[7.5px] text-[#B45309] font-medium block -mt-0.5 mb-0.5">
                (በተጠቃሚው መልስ | Self Declared)
              </span>
              <p className="text-[11px] sm:text-[12px] font-bold text-slate-950 leading-tight">
                {data.nationalityAmharic} &nbsp;|&nbsp; {data.nationalityEnglish}
              </p>
            </div>

            {/* Address */}
            <div>
              <span className="text-[8.5px] font-semibold text-[#B45309] block mb-0.5 tracking-tight">
                አድራሻ | Address
              </span>
              <div className="text-[10px] sm:text-[11px] font-bold text-slate-950 leading-[1.2]">
                <p>{data.regionAmharic}</p>
                <p>{data.regionEnglish}</p>
                <p>{data.subcityAmharic}</p>
                <p>{data.subcityEnglish}</p>
                <p>{data.woredaAmharic}</p>
                <p>{data.woredaEnglish}</p>
              </div>
            </div>

            {/* FIN Badge Box */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="text-[7px] font-bold text-teal-800 leading-[1.05] text-right flex flex-col">
                <span>ፋይዳ</span>
                <span>ልዩ ቁጥር</span>
              </div>
              <div className="bg-white border border-slate-300 rounded px-2 py-0.5 shadow-2xs">
                <span className="text-[10px] sm:text-[11.5px] font-black tracking-wider text-slate-950">
                  FIN &nbsp;{data.finNumber}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Massive High-Res QR Code filling the right side */}
          <div className="shrink-0 flex items-center justify-center p-1 bg-white rounded-lg border border-slate-300/80 shadow-xs h-full aspect-square max-h-[195px] sm:max-h-[215px] my-auto">
            <img
              src={qrSource}
              alt="Identity verification QR code"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Bottom Footer: Disclaimer text & SN Badge */}
        <footer className="pt-1 mt-1 border-t border-teal-800/15 flex items-center justify-between gap-2">
          <div className="text-[6.8px] sm:text-[7.2px] text-slate-700 leading-[1.15] max-w-[78%]">
            <p>
              ይህ መታወቂያ የጠፋ ካገኙ በቅርብዎ ያለ ፖሊስ ጣቢያ ወይም ለተቋሙ ያስረክቡ። ለተጨማሪ መረጃ 9779 ላይ ይደውሉ ወይም id.et/cardprint ይጎብኙ።
            </p>
            <p className="text-[6.2px] sm:text-[6.6px] text-slate-600 mt-0.5">
              If lost and found, please return to nearby police station or to the institution. Call 9779 or visit id.et/cardprint for more.
            </p>
          </div>

          {/* SN Badge */}
          <div className="shrink-0 bg-white border border-slate-300 rounded px-1.5 py-0.5 shadow-2xs text-[8.5px] font-bold">
            <span className="text-red-700 font-black">SN:</span>{" "}
            <span className="text-slate-900 font-extrabold">{data.serialNumber}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
