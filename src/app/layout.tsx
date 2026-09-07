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
  title: "رویش | سامانه فرهنگی، تربیتی حوزه و خانواده",
  description:
    "سامانه فرهنگی، تربیتی حوزه و خانواده — با هم برای رشد، با هم برای آینده",
  // iOS home-screen metadata (web app manifest covers Android/Chrome).
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "رویش",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#047857",
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
        className={`${vazirmatn.className} antialiased bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100`}
      >
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
