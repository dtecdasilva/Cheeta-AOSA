/**
 * Runs once when a server instance starts, before it takes requests
 * (see node_modules/next/dist/docs/01-app/02-guides/instrumentation.md).
 * Node runtime only: the Edge proxy has no database.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootstrap } = await import("./server/bootstrap");
  await bootstrap();
}
