const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // Map the @/ alias (used in TypeScript paths) to src/
    extraNodeModules: new Proxy(
      {},
      {
        get: (_, name) => path.join(__dirname, `node_modules/${String(name)}`),
      },
    ),
  },
  watchFolders: [__dirname],
};

// Override the module resolver to handle @/ alias
const defaultConfig = getDefaultConfig(__dirname);
const mergedConfig = mergeConfig(defaultConfig, config);

// Add custom resolver for @/ alias
mergedConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@/')) {
    const filePath = path.join(__dirname, 'src', moduleName.slice(2));
    return context.resolveRequest(context, filePath, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = mergedConfig;
