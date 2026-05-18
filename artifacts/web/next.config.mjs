/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep server-only packages out of client/edge bundles. `pg` (and its
  // transitive deps) require Node built-ins like `fs`/`net`/`dns` which
  // webpack cannot resolve when bundling for the browser. Task-290 lifted
  // pure fixture data (MOCK_PATIENTS, MOCK_ORDERS) into client-safe
  // `*.data.ts` modules, and task-292/task-315 moved the only
  // `@workspace/db` import behind a `"use server"` boundary in
  // `lib/api/audit.ts` (impl in `audit.server.ts`, guarded by
  // `import "server-only"`). With that in place the old
  // `webpack.resolve.fallback` shim for `fs`/`net`/`tls`/`pg-native`/
  // `pg-connection-string` is no longer needed and has been dropped. This
  // list marks the same packages as external for the server build itself.
  serverExternalPackages: ['pg', 'pg-connection-string', '@workspace/db'],
  experimental: {
    serverMinification: false,
  },
};

export default nextConfig;
