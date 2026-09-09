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
  async redirects() {
    return [
      {
        source: '/developer/projects',
        destination: 'https://platform.persona.hasanraiyan.me/projects',
        permanent: false,
      },
      {
        source: '/developer/projects/:path*',
        destination: 'https://platform.persona.hasanraiyan.me/projects/:path*',
        permanent: false,
      },
      {
        source: '/developer',
        destination: 'https://platform.persona.hasanraiyan.me/projects',
        permanent: false,
      },
      {
        source: '/developer/:path*',
        destination: 'https://platform.persona.hasanraiyan.me/:path*',
        permanent: false,
      },
      {
        source: '/projects',
        destination: 'https://platform.persona.hasanraiyan.me/projects',
        permanent: false,
      },
      {
        source: '/projects/:path*',
        destination: 'https://platform.persona.hasanraiyan.me/projects/:path*',
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
