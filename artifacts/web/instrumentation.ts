/**
 * Next.js instrumentation hook — runs once before the server starts.
 *
 * Historically this file polyfilled `globalThis.{ReadableStream,
 * WritableStream, TransformStream}` with `web-streams-polyfill` to work
 * around a Node v22 regression in TransformStream's internal `kState`
 * shape that broke Next.js 15's streaming renderer with
 *   TypeError: controller[kState].transformAlgorithm is not a function
 *
 * That polyfill also broke every incoming POST/PUT body on Node 24, because
 * undici's request `extractBody` brand-checks the body via
 * `webidl.is.ReadableStream`, which is implemented as the *primordial*
 * `Function.prototype[Symbol.hasInstance]` against the native ReadableStream
 * class. The polyfill instance fails that check (it's not on the native
 * prototype chain), so every body-bearing request crashed with
 *   AssertionError [ERR_ASSERTION]: false == true at extractBody
 *
 * The original TransformStream regression has been fixed upstream in Node
 * v23+; on Node 24.13 (our current runtime), the streaming renderer works
 * against the native Web Streams classes, and removing the polyfill is what
 * unblocks the POST routes.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Task-74: boot the in-process job scheduler so the failed-email retry job
    // runs automatically (per clinic, every few minutes) without manual triggers.
    const { startJobScheduler } = await import('./lib/api/jobs/scheduler');
    startJobScheduler();
  }
}
