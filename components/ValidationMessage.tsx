type ValidationMessageProps = {
  tone: "error" | "success" | "info";
  children: React.ReactNode;
};

const styles = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
};

export function ValidationMessage({ tone, children }: ValidationMessageProps) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${styles[tone]}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}
