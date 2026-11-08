// OpenNext Cloudflare adapter config.
// The default (no overrides) suits a fully dynamic app like Potcha Ops.
// Available overrides (e.g. an R2-backed incremental cache) are documented at
// https://opennext.js.org/cloudflare — see docs/CLOUDFLARE.md for the full
// deployment walkthrough.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
