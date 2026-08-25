import type { Metadata } from "next";
import { IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import { Providers } from "@/components/providers";
import { publicPath } from "@/lib/public-path";
import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Labelator",
  description: "Design labels, fill them from Excel, and download print-ready PDFs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full`}>
      <head>
        <link rel="stylesheet" href={publicPath("/fonts/faces.css")} />
      </head>
      <body className="h-full overflow-hidden font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
