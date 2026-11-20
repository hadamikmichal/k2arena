import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  // PDF ankiety (src/lib/formPdf.ts) czyta czcionki i logo z dysku – na Vercelu muszą trafić do funkcji.
  outputFileTracingIncludes: {
    "/**": ["./src/assets/fonts/*.ttf", "./public/k2-arena-logo.png"],
  },
};

export default nextConfig;
