import type { MetadataRoute } from "next";

// Manifest PWA – aplikację można dodać do ekranu początkowego (na iPhonie to warunek powiadomień push).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "K2 Arena – grafik",
    short_name: "K2 Grafik",
    description: "Grafik pracy instruktorów i ankiety klientów K2 Arena",
    start_url: "/",
    display: "standalone",
    background_color: "#f9f9f7",
    theme_color: "#f6b533",
    lang: "pl",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
