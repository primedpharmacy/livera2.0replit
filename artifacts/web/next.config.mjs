/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep server-only packages out of client/edge bundles. `pg` (and
  // its transitive deps) require Node built-ins like `fs`/`net`/`dns`
  // which webpack cannot resolve when bundling for the browser. This
  // happens because `lib/api/audit.ts` (used by shell components)
  // imports `@workspace/db` which imports `pg`.
  serverExternalPackages: ['pg', 'pg-connection-string', '@workspace/db'],
  experimental: {
    serverMinification: false,
  },
  // Keep node-only packages (and their deps) out of the client bundle.
  // `lib/api/audit.ts` lazy-imports `@workspace/db` (which pulls `pg`),
  // and that module is reachable from client components via shared
  // fixtures (e.g. `MOCK_PATIENTS` used by GlobalFABSpeedDial). Without
  // these fallbacks webpack tries to resolve `fs` for `pg-connection-string`
  // in the browser bundle and the page 500s at compile time.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        net: false,
        tls: false,
        dns: false,
        pg: false,
        'pg-native': false,
        'pg-connection-string': false,
        '@workspace/db': false,
      };
    }
    return config;
  },
};

export default nextConfig;
