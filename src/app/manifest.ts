import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Seedling",
    short_name: "Seedling",
    description: "Quản lý ca trudo và chiên",
    lang: "vi",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f1",
    theme_color: "#2f6b4f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
