import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "갸웃",
  description: "갸웃한 순간 편하게 묻고, 교수님께 바로 닿는 수업",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
