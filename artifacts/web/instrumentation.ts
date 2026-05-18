/**
 * Next.js instrumentation hook — runs once before the server starts.
 *
 * Fix: Node.js v22+ changed the internal `kState` shape of TransformStream,
 * breaking Next.js 15's streaming layer with:
 *   TypeError: controller[kState].transformAlgorithm is not a function
 *
 * We replace the global ReadableStream / WritableStream / TransformStream with
 * the pure-JS web-streams-polyfill before Next.js touches them.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const {
      ReadableStream,
      WritableStream,
      TransformStream,
      ReadableStreamDefaultController,
      ReadableStreamBYOBRequest,
      ReadableByteStreamController,
      WritableStreamDefaultController,
      WritableStreamDefaultWriter,
      ReadableStreamDefaultReader,
      ReadableStreamBYOBReader,
      TransformStreamDefaultController,
      ByteLengthQueuingStrategy,
      CountQueuingStrategy,
    } = await import("web-streams-polyfill");

    Object.assign(globalThis, {
      ReadableStream,
      WritableStream,
      TransformStream,
      ReadableStreamDefaultController,
      ReadableStreamBYOBRequest,
      ReadableByteStreamController,
      WritableStreamDefaultController,
      WritableStreamDefaultWriter,
      ReadableStreamDefaultReader,
      ReadableStreamBYOBReader,
      TransformStreamDefaultController,
      ByteLengthQueuingStrategy,
      CountQueuingStrategy,
    });
  }
}
