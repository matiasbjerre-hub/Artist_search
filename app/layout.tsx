import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Find forestillinger & koncerter",
  description:
    "Søg efter teaterforestillinger og koncerter en skuespiller eller musiker medvirker i.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
