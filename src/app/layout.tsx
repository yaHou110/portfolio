import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import PwaRegister from "@/components/PwaRegister";
import "@/app/globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-vazirmatn",
});

export const metadata: Metadata = {
  title: "YOUR NAME | Product Engineer",
  description:
    "پورتفولیوی شخصی YOUR NAME؛ طراحی و توسعهٔ وب‌اپلیکیشن، داشبورد و محصولات SaaS.",
  // iOS home-screen metadata (web app manifest covers Android/Chrome).
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "YOUR NAME",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#f2efe9",
  width: "device-width",
  initialScale: 1,
};

/**
 * Inline script that runs before hydration to set the `dark` class from
 * localStorage or OS preference — prevents a flash of the wrong theme.
 */
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html
      lang="fa"
      dir="rtl"
      suppressHydrationWarning
      className={vazirmatn.variable}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${vazirmatn.className} antialiased`}
      >
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
