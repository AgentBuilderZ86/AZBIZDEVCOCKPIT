/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @react-pdf/renderer doit rester un package serveur externe (fontkit & co).
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer", "unpdf"],
  },
};

module.exports = nextConfig;
