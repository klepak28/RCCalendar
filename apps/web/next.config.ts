import type { NextConfig } from 'next';

// Must match API PORT (apps/api .env). Set API_ORIGIN to override.
const API_ORIGIN = process.env.API_ORIGIN ?? 'http://127.0.0.1:55556';

const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` },
    ];
  },
};

export default nextConfig;
