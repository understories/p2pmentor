/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  // Skip ESLint during build - lint is run separately in CI (non-blocking)
  // This prevents build failures from lint warnings while still catching errors in CI
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    // Suppress MetaMask SDK React Native module errors
    // The SDK tries to import React Native modules even in browser contexts
    // We need to handle this for both client and server builds
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
    };

    // Ignore React Native modules that MetaMask SDK tries to import
    config.resolve.alias = {
      ...config.resolve.alias,
      'react-native': false,
    };

    return config;
  },
};

export default nextConfig;
