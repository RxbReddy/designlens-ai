import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DesignLens AI — Engineering Teardown Platform",
  description:
    "AI-powered multi-agent system that analyzes product images and generates first-pass engineering teardown reports, subsystem breakdowns, and manufacturing cost estimates.",
  keywords: ["engineering teardown", "AI analysis", "manufacturing cost", "product teardown", "design analysis"],
  openGraph: {
    title: "DesignLens AI",
    description: "Upload a product image. Get a full engineering teardown report in seconds.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
