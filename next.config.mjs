/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Type errors must be fixed before build; do not ignore in production.
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
