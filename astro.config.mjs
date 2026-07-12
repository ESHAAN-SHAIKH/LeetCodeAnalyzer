import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://leetcodeanalyzer.com',
  output: 'server',
  adapter: cloudflare({
    platformProxy: {
      enabled: false,
    },
    assets: {
      binding: 'STATIC_ASSETS',
    },
    // Explicitly disable auto-enabled bindings we don't use.
    // This project only uses the LEETCODE_CACHE KV binding.
    imageService: 'passthrough',
  }),
  // Note: The @astrojs/cloudflare adapter auto-enables "IMAGES" and "SESSION"
  // bindings in build output. These are harmless no-ops — this project only
  // uses the LEETCODE_CACHE KV binding defined in wrangler.toml.
  integrations: [
    react(),
    sitemap({
      // Exclude noindexed user-data and compare pages
      filter: (page) =>
        !page.includes('/u/') && !page.includes('/compare/'),
      customPages: [
        'https://leetcodeanalyzer.com/',
        'https://leetcodeanalyzer.com/analyze',
        'https://leetcodeanalyzer.com/guides',
        'https://leetcodeanalyzer.com/guides/blind75-vs-neetcode150-vs-grind75',
        'https://leetcodeanalyzer.com/guides/how-to-know-if-ready-for-coding-interviews',
        'https://leetcodeanalyzer.com/guides/how-to-identify-leetcode-weak-topics',
        'https://leetcodeanalyzer.com/guides/how-many-leetcode-problems-should-i-solve',
        'https://leetcodeanalyzer.com/guides/how-to-calculate-time-complexity',
        'https://leetcodeanalyzer.com/guides/what-makes-a-leetcode-solution-optimal',
        'https://leetcodeanalyzer.com/privacy',
        'https://leetcodeanalyzer.com/terms',
        'https://leetcodeanalyzer.com/about',
        'https://leetcodeanalyzer.com/contact',
      ],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('analyzer/parsers/python')) return 'analyzer-python';
            if (id.includes('analyzer/parsers/java')) return 'analyzer-java';
            if (id.includes('analyzer/parsers/cpp')) return 'analyzer-cpp';
            if (id.includes('analyzer/parsers/js')) return 'analyzer-js';
            if (id.includes('analyzer/')) return 'analyzer-core';
            if (id.includes('acorn') || id.includes('@babel/parser')) return 'parser-js';
            if (id.includes('d3')) return 'd3-charts';
          },
        },
      },
    },
    // Removed dead web-tree-sitter reference — that package was never installed.
    // The analyzer uses heuristic parsing, not tree-sitter WASM.
  },
});
