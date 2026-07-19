/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async headers() {
    const headers = [
      {
        source: '/:path*.csv',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        ],
      },
    ];

    // Dev chunks are rebuilt in place. Prevent an open browser tab from
    // retaining a chunk URL that disappeared after a restart or recompile.
    if (process.env.NODE_ENV === 'development') {
      headers.push({
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
        ],
      });
    }

    return headers;
  },
}

module.exports = nextConfig

