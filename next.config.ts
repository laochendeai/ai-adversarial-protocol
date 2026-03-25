import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },

  // === Production Optimizations ===

  // Optimize package imports for smaller bundles
  modularizeImports: {
    'lodash-es': {
      transform: 'lodash-es/{{member}}',
    },
  },

  // Production-specific optimizations
  ...(process.env.NODE_ENV === 'production' && {
    // Enable gzip compression
    compress: true,

    // Remove console.log in production
    compiler: {
      removeConsole: {
        exclude: ['error', 'warn'],
      },
    },

    // Optimize CSS
    optimizeCss: true,

    // Generate production source maps (disabled for smaller bundles)
    productionBrowserSourceMaps: false,
  }),

  // === Image Optimization ===
  images: {
    // Allow images from these domains
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    // Use sharp for image optimization
    formats: ['image/webp', 'image/avif'],
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // Image sizes for responsive images
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // === Experimental Features ===
  experimental: {
    // Optimize package imports
    optimizePackageImports: [
      'react-icons',
      '@anthropic-ai/sdk',
      'openai',
    ],
  },
};

export default nextConfig;
