import type { MetadataRoute } from "next";

/**
 * Web App Manifest for the PWA.
 *
 * Served at /manifest.webmanifest by the App Router. RTL-aware (`dir`),
 * Persian-first (`lang`), brand colors from the design tokens.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "رویش | سامانه فرهنگی، تربیتی حوزه و خانواده",
    short_name: "رویش",
    description:
      "سامانه فرهنگی، تربیتی حوزه و خانواده — با هم برای رشد، با هم برای آینده",
    dir: "rtl",
    lang: "fa",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f9fafb",
    theme_color: "#047857",
    categories: ["education", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
