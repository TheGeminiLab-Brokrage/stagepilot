import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['lamejs'],
  serverExternalPackages: ['@whiskeysockets/baileys', 'pino', 'pino-pretty'],
  outputFileTracingIncludes: {
    '/api/exam/phase1-questions': ['./data/**'],
    '/api/exam/phase2-questions': ['./data/**'],
    '/api/exam/grade-phase1': ['./data/**'],
    '/api/exam/grade-phase2': ['./data/**'],
  },
};

export default nextConfig;
