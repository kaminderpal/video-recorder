import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video Recorder",
  description: "Record video and store it in a temp folder"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
