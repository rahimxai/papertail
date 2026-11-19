import type { Metadata, Viewport } from "next";
import { Geist, Newsreader } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Two families only: Geist for the interface, Newsreader (optical sizes) for display type and document text.
const geist = Geist({ variable: "--font-sans", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], axes: ["opsz"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: { default: "Papertrail", template: "%s · Papertrail" },
  description: "Write, import, and share documents with your team.",
};

export const viewport: Viewport = { themeColor: "#faf9f6" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="min-h-full">
        <TooltipProvider delayDuration={400} skipDelayDuration={150}>
          {children}
        </TooltipProvider>
        <Toaster theme="light" position="bottom-right" />
      </body>
    </html>
  );
}
