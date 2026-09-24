import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// One page per app, plus the index that links to them.
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  environments: { client: { build: { rollupOptions: { input: ["index.html", "intoyou/index.html", "finder/index.html"] } } } },
});
