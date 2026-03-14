import js from "@eslint/js";

const browserGlobals = {
  Blob: "readonly",
  FormData: "readonly",
  MessageEvent: "readonly",
  RTCIceCandidate: "readonly",
  RTCPeerConnection: "readonly",
  RTCSessionDescription: "readonly",
  URL: "readonly",
  Worker: "readonly",
  clearTimeout: "readonly",
  console: "readonly",
  document: "readonly",
  fetch: "readonly",
  module: "readonly",
  navigator: "readonly",
  process: "readonly",
  require: "readonly",
  self: "readonly",
  setTimeout: "readonly",
  window: "readonly",
};

export default [
  {
    ignores: [".next/**", "node_modules/**", "out/**", "build/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: browserGlobals,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^(React|[A-Z].*)$",
        },
      ],
    },
  },
];
