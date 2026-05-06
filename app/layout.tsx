import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Comment Moderation Demo",
  description: "A Vercel-ready moderation demo converted from Gradio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
