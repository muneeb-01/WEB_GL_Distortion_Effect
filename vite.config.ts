import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import glsl from "vite-plugin-glsl";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    glsl({
      include: "**/*.glsl", // Optional: default includes .glsl, .frag, .vert
      defaultExtension: "glsl",
    }),
  ],
  // server: {
  //   watch: {
  //     usePolling: true, // 👈 important
  //     interval: 100, // optional: lower is more responsive
  //   },
  //   host: true, // allow access from Windows browser
  //   port: 5173, // or any port you prefer
  // },
});
