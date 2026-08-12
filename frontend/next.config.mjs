import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const API_INTERNAL_URL = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";

const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    // Server-side proxy: browser calls stay same-origin (/api/v1/*), cookies
    // (httpOnly JWT) keep working and the backend never faces cross-origin
    // browser traffic.
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_INTERNAL_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
