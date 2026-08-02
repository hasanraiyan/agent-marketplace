/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL || 'https://api.persona.hasanraiyan.me/api/v1/:path*', // Proxy to Backend
      },
    ]
  },
};

export default nextConfig;
