import type { EthiopianIdData } from "@/types/id-card";

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
      {/* 1. Authentic Template Background with fine guilloche, uncut disclaimer & labels */}
      <img
        src="/assets/card-back-template.png"
        alt="Ethiopian Digital ID Back Template"
        className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
        draggable={false}
      />

      {/* 2. Dynamic Text Overlays on Left with clean backdrop */}
      <div className="absolute left-[4.5%] top-[14%] w-[38%] flex flex-col space-y-[1%]">
        {/* Phone */}
        <div className="bg-[#D8F8F0]/95 px-1 py-0.5 rounded leading-tight">
          <p className="text-[12px] sm:text-[13.5px] font-bold text-slate-950">
            {data.phoneNumber}
          </p>
        </div>

        {/* Nationality */}
        <div className="pt-[6.5%]">
          <div className="bg-[#D8F8F0]/95 px-1 py-0.5 rounded leading-tight">
            <p className="text-[11px] sm:text-[12.5px] font-bold text-slate-950">
              {data.nationalityAmharic} &nbsp;|&nbsp; {data.nationalityEnglish}
            </p>
          </div>
        </div>

        {/* Address */}
        <div className="pt-[6%]">
          <div className="bg-[#D8F8F0]/95 px-1 py-0.5 rounded leading-[1.25] text-[10px] sm:text-[11.5px] font-bold text-slate-950">
            <p>{data.regionAmharic}</p>
            <p>{data.regionEnglish}</p>
            <p>{data.subcityAmharic}</p>
            <p>{data.subcityEnglish}</p>
            <p>{data.woredaAmharic}</p>
            <p>{data.woredaEnglish}</p>
          </div>
        </div>
      </div>

      {/* 3. FIN Number inside FIN Box */}
      <div className="absolute left-[13.5%] bottom-[12.8%] w-[24%] bg-white px-2 py-0.5 rounded flex items-center">
        <span className="text-[10px] sm:text-[11.5px] font-black tracking-wider text-slate-950">
          FIN &nbsp;{data.finNumber}
        </span>
      </div>

      {/* 4. Extracted QR Code inside QR Frame */}
      <div className="absolute right-[4.5%] top-[5%] w-[51%] h-[82%] p-1 flex items-center justify-center">
        <img
          src={qrSource}
          alt="Identity verification QR code"
          className="w-full h-full object-contain"
        />
      </div>

      {/* 5. SN Number inside SN Badge */}
      <div className="absolute right-[4.5%] bottom-[4.2%] w-[19%] flex items-center justify-center bg-white px-1.5 py-0.5 rounded shadow-2xs text-[8.5px] sm:text-[9.5px] font-black">
        <span className="text-red-700 font-black mr-1">SN:</span>
        <span className="text-slate-900 font-extrabold">{data.serialNumber || "65501482"}</span>
      </div>
    </div>
  );
}
