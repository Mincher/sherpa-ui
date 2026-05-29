import { playwrightLauncher } from '@web/test-runner-playwright';

export default {
  files: 'test/**/*.test.js',
  nodeResolve: true,

  // Test in multiple browsers
  browsers: [
    playwrightLauncher({ product: 'chromium' }),
    playwrightLauncher({ product: 'firefox' }),
    playwrightLauncher({ product: 'webkit' }),
  ],

  // Coverage configuration
  coverage: true,
  coverageConfig: {
    include: ['components/**/*.js'],
    exclude: [
      '**/node_modules/**',
      '**/test/**',
      '**/demo/**',
      '**/mcp-server/**',
      '**/scripts/**',
    ],
    threshold: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },

  // Test framework configuration
  testFramework: {
    config: {
      timeout: 5000,
    },
  },

  // Server configuration
  port: 8765,

  // Watch mode
  watch: process.argv.includes('--watch'),

  // Reporter configuration
  reporters: ['default'],

  // Preserve symlinks for monorepo support
  preserveSymlinks: true,
};
