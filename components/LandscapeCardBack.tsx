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

      {/* 2. Dynamic Text Overlays on Left strictly aligned to vertical grid line */}
      <div className="absolute left-[5.9%] top-[12.8%] w-[38%] flex flex-col pointer-events-none text-black">
        {/* Phone */}
        <div>
          <p className="text-[12px] sm:text-[13.5px] font-normal text-black leading-tight">
            {data.phoneNumber}
          </p>
        </div>

        {/* Nationality & Self Declared with correct Ge'ez 'ጠ' character */}
        <div className="pt-[4.5%]">
          <p className="text-[9.5px] sm:text-[10.5px] font-normal text-black leading-tight">
            (በተገለጠው መሰረት / Self Declared)
          </p>
          <p className="text-[11px] sm:text-[12px] font-normal text-black leading-tight pt-[2%]">
            {data.nationalityAmharic} &nbsp;|&nbsp; {data.nationalityEnglish}
          </p>
        </div>

        {/* Address stacked with equal vertical spacing, ample padding above footer */}
        <div className="pt-[5.5%] space-y-[2px] text-[10px] sm:text-[11px] font-normal text-black leading-[1.3]">
          <p>{data.regionAmharic}</p>
          <p>{data.regionEnglish}</p>
          <p>{data.subcityAmharic}</p>
          <p>{data.subcityEnglish}</p>
          <p>{data.woredaAmharic}</p>
          <p>{data.woredaEnglish}</p>
        </div>
      </div>

      {/* 3. CENTER FIN: Vertically and horizontally center numeric string inside white box */}
      <div className="absolute left-[16.7%] bottom-[12.2%] w-[25.0%] h-[8.0%] flex items-center justify-center pointer-events-none">
        <span className="text-[11px] sm:text-[12.5px] font-mono font-normal tracking-wider text-black">
          {data.finNumber}
        </span>
      </div>

      {/* 4. Extracted QR Code inside QR Frame */}
      <div className="absolute left-[45.7%] top-[7.4%] w-[48.5%] h-[76.8%] flex items-center justify-center pointer-events-none">
        <img
          src={qrSource}
          alt="Identity verification QR code"
          className="w-full h-full object-contain"
        />
      </div>

      {/* 5. CENTER SN: Symmetrically centered inside bottom-right white pill box */}
      <div className="absolute right-[2.5%] bottom-[4.4%] w-[18.4%] h-[5.4%] bg-white rounded-[4px] border border-slate-200 flex items-center justify-center pointer-events-none text-[8.5px] sm:text-[9.5px]">
        <span className="text-[#8c7b3e] font-bold mr-1">SN : </span>
        <span className="text-black font-mono font-bold">{data.serialNumber || "65501482"}</span>
      </div>
    </div>
  );
}
