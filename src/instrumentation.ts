/**
 * Next compiles this entry for both Node.js and Edge runtimes. Keep the entry
 * free of Node-only dependencies and load the Node implementation only in the
 * runtime that can execute it.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { registerNodeRuntime } = await import("./instrumentation-node");
        await registerNodeRuntime();
    }
}
