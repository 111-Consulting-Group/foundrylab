const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const fs = require('fs');
const path = require('path');

// #region agent log
const DEBUG_LOG_PATH = '/Users/andywolfe/Documents/Development/TrainingApp/.cursor/debug.log';
function debugLog(hypothesisId, location, message, data) {
  const entry = JSON.stringify({ hypothesisId, location, message, data, timestamp: Date.now(), sessionId: 'debug-session', runId: 'metro-startup' }) + '\n';
  try { fs.appendFileSync(DEBUG_LOG_PATH, entry); } catch (e) {}
}
// #endregion

const config = getDefaultConfig(__dirname);

// #region agent log
debugLog('D', 'metro.config.js:startup', 'Metro config initial values', {
  unstable_enablePackageExports: config.resolver.unstable_enablePackageExports,
  unstable_conditionNames: config.resolver.unstable_conditionNames,
  sourceExts: config.resolver.sourceExts,
});
// #endregion

// Add support for .mjs files (ES modules)
config.resolver.sourceExts.push('mjs');

// Disable package exports to avoid import.meta issues
config.resolver.unstable_enablePackageExports = false;

// Set condition names to prioritize browser/require over module exports
config.resolver.unstable_conditionNames = ['browser', 'require', 'react-native'];

// Configure Metro to transform all node_modules for web (needed for expo-router import.meta)
config.transformer.unstable_allowRequireContext = true;
config.transformer.unstable_importSideEffects = false;

// Store the default resolver if it exists
const defaultResolver = config.resolver.resolveRequest;

// Add web-specific resolver to handle MMKV and ensure platform extensions work
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // On web, replace react-native-mmkv with an empty mock
  if (platform === 'web' && moduleName === 'react-native-mmkv') {
    return {
      filePath: require.resolve('./lib/mmkv-mock.js'),
      type: 'sourceFile',
    };
  }
  
  // Let the default resolver handle everything else (including platform-specific extensions like .web.ts)
  // The default resolver knows how to resolve @/ paths and .web.ts extensions
  if (defaultResolver) {
    try {
      return defaultResolver(context, moduleName, platform);
    } catch (error) {
      // If default resolver fails, try context's resolver as fallback
      return context.resolveRequest(context, moduleName, platform);
    }
  }
  
  // Use context's default resolver as fallback
  return context.resolveRequest(context, moduleName, platform);
};

// #region agent log
debugLog('D', 'metro.config.js:final', 'Metro config final values', {
  unstable_enablePackageExports: config.resolver.unstable_enablePackageExports,
  unstable_conditionNames: config.resolver.unstable_conditionNames,
  sourceExts: config.resolver.sourceExts,
});
// #endregion

module.exports = withNativeWind(config, { input: './global.css' });
