/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep server-only packages out of client/edge bundles. `pg` (and its
  // transitive deps) require Node built-ins like `fs`/`net`/`dns` which
  // webpack cannot resolve when bundling for the browser. Task-290 lifted
  // pure fixture data (MOCK_PATIENTS, MOCK_ORDERS) into client-safe
  // `*.data.ts` modules and left the only `@workspace/db` import in
  // `lib/api/audit.ts` behind a `webpackIgnore` magic comment, so the
  // previous `webpack.resolve.fallback` workaround for `fs`/`net`/`tls`/
  // `pg-native`/`pg-connection-string` is no longer needed. This list
  // marks the same packages as external for the server build itself.
  serverExternalPackages: ['pg', 'pg-connection-string', '@workspace/db'],
  experimental: {
    serverMinification: false,
  },
};

export default nextConfig;
