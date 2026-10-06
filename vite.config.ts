import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  // Served from https://aabotnes.github.io/eggruks-nat-20/. Owlbear Rodeo resolves manifest
  // paths against the bare domain, so they (and the dev server) use this full prefix too.
  base: "/eggruks-nat-20/",
  server: {
    // Owlbear Rodeo loads the manifest and pages cross-origin
    cors: { origin: "https://www.owlbear.rodeo" },
  },
  build: {
    rollupOptions: {
      input: {
        popover: resolve(__dirname, "index.html"),
        background: resolve(__dirname, "background.html"),
        overlay: resolve(__dirname, "overlay.html"),
      },
    },
  },
});
