import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import FeedbackButton from "@/components/auth/FeedbackButton";
import Tracker from "@/components/auth/Tracker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Blueprintflow",
  description: "藍圖社區管理（作品集示範）：3D 平面圖、會議待辦、現場與公告",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant-TW"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          {children}
          <Suspense>
            <Tracker />
          </Suspense>
          <FeedbackButton />
        </AuthProvider>
      </body>
    </html>
  );
}
