/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn-media.choiceqr.com" }],
  },
};

export default nextConfig;
