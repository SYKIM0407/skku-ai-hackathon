import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "갸웃",
  description: "수업을 함께 듣고, 학생과 교수 사이에서 대신 손을 들어 주는 AI",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
