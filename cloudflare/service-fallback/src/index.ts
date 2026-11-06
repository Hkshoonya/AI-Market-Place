import { proxyWithFallback } from "./fallback.mjs";

export default {
  fetch(request) {
    return proxyWithFallback(request);
  },
} satisfies ExportedHandler;
