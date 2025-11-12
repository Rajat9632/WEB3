/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Polyfill optional native modules that only exist in RN/envs we don't use on web/SSR
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      net: false,
      tls: false,
    };

    // Alias problematic optional deps and specific wasm binding to no-ops
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'pino-pretty': false,
      '@react-native-async-storage/async-storage': false,
      'user_preferences_bindings_wasm_bg.wasm': false
    };

    if (isServer) {
      // Treat any .wasm import as inert text so SSR won't try to read it
      config.module.rules.push({
        test: /\.wasm$/,
        type: 'asset/source'
      });
    }

    return config;
  }
};

export default nextConfig;
