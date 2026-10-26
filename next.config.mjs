/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Fully static site (no server code) so it can be hosted on Cloudflare Pages; build output goes to `out/`.
  output: 'export',
  allowedDevOrigins: ['localhost', '127.0.0.1'],
};

export default nextConfig;
