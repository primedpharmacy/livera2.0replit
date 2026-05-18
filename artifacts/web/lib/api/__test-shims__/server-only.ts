// Empty shim aliased in `vitest.config.ts` for the `server-only` marker.
// The real `server-only` package throws when loaded outside a React-server
// bundle; under jsdom we want a no-op so that `audit.server.ts` can still be
// imported by unit tests that mock `@workspace/db`.
export {};
