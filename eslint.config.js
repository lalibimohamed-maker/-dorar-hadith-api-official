const nodeGlobals = {
  process: "readonly",
  Buffer: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  fetch: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  AbortController: "readonly",
  structuredClone: "readonly",
  TextEncoder: "readonly",
  Blob: "readonly",
  Response: "readonly",
  crypto: "readonly"
};

const browserGlobals = {
  window: "readonly",
  document: "readonly",
  location: "readonly",
  localStorage: "readonly",
  navigator: "readonly",
  fetch: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  AbortController: "readonly",
  structuredClone: "readonly",
  TextEncoder: "readonly",
  Blob: "readonly",
  Response: "readonly",
  crypto: "readonly",
  caches: "readonly",
  indexedDB: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  alert: "readonly",
  Audio: "readonly",
  CustomEvent: "readonly",
  SpeechSynthesisUtterance: "readonly",
  speechSynthesis: "readonly",
  MutationObserver: "readonly",
  MediaRecorder: "readonly"
};

const serviceWorkerGlobals = {
  self: "readonly",
  caches: "readonly",
  location: "readonly",
  fetch: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  AbortController: "readonly",
  structuredClone: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  Response: "readonly",
  Request: "readonly",
  Headers: "readonly"
};

export default [
  {
    ignores: [
      "node_modules/**",
      "coverage/**",
      "dist/**",
      "build/**",
      ".git/**"
    ]
  },

  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: nodeGlobals
    },
    rules: {
      "no-undef": "warn",
      "no-unused-vars": ["warn", { caughtErrors: "none" }],
      "no-redeclare": "warn",
      "no-unreachable": "error"
    }
  },

  {
    files: [
      "web/**/*.js",
      "src/offline-pdf-library.js",
      "src/quran-word-interaction.js"
    ],
    languageOptions: {
      globals: browserGlobals
    }
  },

  {
    files: [
      "web/sw.js",
      "public/sw.js"
    ],
    languageOptions: {
      globals: serviceWorkerGlobals
    }
  },

  {
    files: ["src/assistant-runtime.js"],
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^(records|graph)$"
        }
      ]
    }
  },

  {
    files: ["src/rijal-dataset.js"],
    languageOptions: {
      sourceType: "commonjs"
    }
  }
];
