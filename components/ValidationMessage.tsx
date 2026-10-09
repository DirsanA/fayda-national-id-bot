type ValidationMessageProps = {
  tone: "error" | "success" | "info";
  children: React.ReactNode;
};

const styles = {
  error: "border-red-500/30 bg-red-500/10 text-red-300",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  info: "border-blue-500/30 bg-blue-500/10 text-blue-300",
};

export function ValidationMessage({ tone, children }: ValidationMessageProps) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm font-medium backdrop-blur-md ${styles[tone]}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}
