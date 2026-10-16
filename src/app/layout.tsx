import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./keepsake.css";
export const metadata: Metadata = {
  title: "Bubu’s Little World · A little place to feel loved",
  description:
    "A cozy house and a little hello. Milestone 1 synthetic preview.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f8f5eb",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
