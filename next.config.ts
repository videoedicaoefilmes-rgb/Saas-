import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Origem do armazenamento S3 (uploads diretos e reprodução de vídeo pelo navegador).
function storageOrigin(): string {
  if (process.env.STORAGE_DRIVER !== "s3") return "";
  const endpoint = process.env.S3_ENDPOINT;
  if (endpoint) {
    try {
      const url = new URL(endpoint);
      // Endpoints com bucket no subdomínio (virtual-hosted) também precisam ser aceitos.
      return `${url.origin} ${url.protocol}//*.${url.host}`;
    } catch {
      return "";
    }
  }
  return "https://*.amazonaws.com";
}

const storage = storageOrigin();

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `media-src 'self' blob: ${storage}`.trim(),
  `connect-src 'self' ${storage}`.trim(),
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Pacotes de servidor que não devem ser empacotados pelo bundler.
  serverExternalPackages: ["pino", "pino-pretty", "bullmq", "ioredis"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
