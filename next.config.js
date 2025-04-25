/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Explicitly allow development origins
    allowedDevOrigins: ['*'],
  },
};

module.exports = nextConfig; 