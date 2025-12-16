/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Suppress MetaMask SDK React Native module warnings
    // The SDK tries to import React Native modules even in browser contexts
    // This is harmless but generates build warnings
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@react-native-async-storage/async-storage': false,
      };
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@react-native-async-storage/async-storage': false,
      };
    }
    return config;
  },
}

export default nextConfig


