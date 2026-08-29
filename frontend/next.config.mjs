/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
    return [{ source: "/backend-admin/queues/:path*", destination: `${api}/admin/queues/:path*` }];
  },
};

export default nextConfig;
