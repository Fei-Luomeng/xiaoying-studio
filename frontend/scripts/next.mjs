// Set this before loading the CLI, including in child processes it starts.
// Keep local npm commands consistent with Docker and CI without changing global settings.
process.env.NEXT_TELEMETRY_DISABLED = "1";
await import("next/dist/bin/next");
