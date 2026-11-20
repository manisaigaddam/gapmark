const nextConfig = {
  distDir: process.env.GAPMARK_BUILD_DIR || '.next',
  serverExternalPackages: ['snarkjs'],
  outputFileTracingIncludes: {
    '/api/agent': ['./public/zk/verification_key.json'],
    '/api/agent-games': ['./public/zk/verification_key.json'],
    '/api/zkverify': ['./public/zk/verification_key.json'],
    '/api/workspace': ['./public/zk/verification_key.json']
  },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
    ] }];
  },
  poweredByHeader: false
};
export default nextConfig;
