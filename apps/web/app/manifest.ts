import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Empathy Pro 2.0",
    short_name: "Empathy Pro",
    description: "Performance & metabolic adaptation platform",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "portrait-primary",
    lang: "it",
    icons: [
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "32x32",
        purpose: "any",
      },
    ],
  };
}
