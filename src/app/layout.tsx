import type { Metadata, Viewport } from "next"
import { Vazirmatn } from "next/font/google"
import "./globals.css"

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-vazirmatn",
})

export const metadata: Metadata = {
  title: "یاهو — مهندس محصول",
  description: "نمونه‌کار یاهو؛ طراحی و ساخت محصولات دیجیتال سریع، دقیق و قابل توسعه برای مشتریان فارسی‌زبان.",
}

export const viewport: Viewport = {
  themeColor: "#0e0e10",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa" dir="rtl" className={`bg-background ${vazirmatn.variable}`}><body className={vazirmatn.className}>{children}</body></html>
}
