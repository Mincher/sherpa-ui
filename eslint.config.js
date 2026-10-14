/**
 * eslint.config.js — the lint rules for src/, and the two boundaries it holds:
 * the DOM-free data layer, and the opt-in app layer. `npm run lint`.
 */
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

/** A DOM global, banned in a module that must run with no DOM. */
const noDom = (name, message = 'This module must run with NO DOM.') => ({ name, message });

export default [
  { ignores: ['dist/**', 'node_modules/**', '**/*.d.ts'] },
  js.configs.recommended,
  ...tsPlugin.configs['flat/recommended'],
  ...tsPlugin.configs['flat/strict'],
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', project: './tsconfig.json' },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true, allowTypedFunctionExpressions: true, allowHigherOrderFunctions: true,
      }],
      '@typescript-eslint/explicit-member-accessibility': ['warn', {
        accessibility: 'no-public',
        overrides: { accessors: 'off', constructors: 'off', methods: 'off', parameterProperties: 'explicit' },
      }],
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-inferrable-types': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-syntax': ['error',
        {
          // An Identifier, so a private field named #hidden (a chart's hidden series) is not caught.
          selector: "AssignmentExpression > MemberExpression[property.type='Identifier'][property.name='hidden']",
          message: 'CSS owns visibility — never set `.hidden` on shadow internals. Toggle a data-* attribute on the host and select it in CSS (`:host([data-*]) .el { display: … }`).',
        },
        {
          selector: "AssignmentExpression > MemberExpression[object.property.name='style'][property.name=/^(display|visibility)$/]",
          message: 'CSS owns visibility — never set `.style.display`/`.style.visibility` in JS. Toggle a data-* attribute on the host and select it in CSS.',
        },
      ],
    },
  },
  {
    /* THE HEADLESS HALF of the data layer: it runs with no DOM — in Node, a test,
       an MCP tool, a server. The FOLDER is the rule, so a new file is covered
       the day it lands. EventTarget, CustomEvent and Event are Node globals and
       stay allowed, as do TYPE-only uses of HTMLElement. */
    files: ['src/core/data/**/*.ts', 'src/core/ui/bind-source.ts'],
    rules: {
      'no-restricted-globals': ['error',
        noDom('document', 'This module must run with NO DOM — it is the half of the data layer a server, a test or an MCP tool imports. Take the element as an argument instead.'),
        noDom('window', 'This module must run with NO DOM. Use `globalThis` if you truly need the global scope.'),
        noDom('customElements', 'This module must run with NO DOM — nothing here may define or look up a component.'),
        noDom('localStorage', 'This module must run with NO DOM. Storage belongs in persist-view.ts or session.ts, which are browser-only by design.'),
        noDom('sessionStorage', 'This module must run with NO DOM. Storage belongs in persist-view.ts or session.ts, which are browser-only by design.'),
        noDom('indexedDB', 'This module must run with NO DOM. IndexedDB belongs in idb-store.ts, which guards every access behind IdbStore.available.'),
        noDom('getComputedStyle'),
        noDom('requestAnimationFrame', 'This module must run with NO DOM. Use a microtask or a timer if the work must be deferred.'),
      ],
    },
  },
  {
    // THE APP LAYER IS OPT-IN: a display component imports none of it. TRAP T-the-app-layer-is-opt-in
    files: ['src/components/**/*.ts', 'src/components.ts'],
    ignores: ['src/components/sherpa-provider/**', 'src/components/sherpa-router/**', 'src/components/sherpa-outlet/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{
        group: [
          '**/core/browser/session.js', '**/core/browser/persist-view.js', '**/core/browser/route.js',
          '**/core/browser/view-files.js', '**/core/browser/view-drafts.js', '**/core/browser/view-sync.js',
          '**/core/browser/view-markup.js', '**/core/browser/saved-filters.js', '**/core/ui/bind-settings.js',
          '**/core/data/app-definition.js', '**/sherpa-provider/*', '**/sherpa-router/*', '**/sherpa-outlet/*', '**/app.js',
        ],
        message: 'A display component may not import the app layer: it stays opt-in. TRAP T-the-app-layer-is-opt-in',
      }] }],
    },
  },
  {
    /* HEADLESS-SAFE but not storage-free: each reaches storage behind a guard
       (LocalStore's try/catch, IdbStore.available), so in Node it degrades. The
       DOM ban applies; the storage ban does not. */
    files: ['src/core/data/stores.ts', 'src/core/browser/idb-store.ts', 'src/core/browser/view-sync.ts'],
    rules: {
      'no-restricted-globals': ['error',
        noDom('document', 'This module must run with NO DOM — it is imported by tests, servers and MCP tools.'),
        noDom('window', 'This module must run with NO DOM. Use `globalThis` if you truly need the global scope.'),
        noDom('customElements'),
        noDom('getComputedStyle'),
        noDom('requestAnimationFrame'),
      ],
    },
  },
];
