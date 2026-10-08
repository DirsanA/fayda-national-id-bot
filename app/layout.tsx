import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Document Print Utility",
  description: "Authorized source-document formatting for physical card printing.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
