import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths, so the build works from any folder (e.g. GitHub Pages)
  base: "./",
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
