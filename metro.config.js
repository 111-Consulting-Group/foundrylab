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

// Configure path alias resolution for @/ imports
config.resolver.alias = {
  '@': path.resolve(__dirname),
};

// Ensure platform-specific extensions are resolved correctly
// Metro should automatically pick .web.ts on web platform, but we ensure it's in the list
if (!config.resolver.sourceExts.includes('web.ts')) {
  config.resolver.sourceExts.unshift('web.ts');
}
if (!config.resolver.sourceExts.includes('web.tsx')) {
  config.resolver.sourceExts.unshift('web.tsx');
}

// Disable package exports to avoid import.meta issues
config.resolver.unstable_enablePackageExports = false;

// Set condition names to prioritize browser/require over module exports
config.resolver.unstable_conditionNames = ['browser', 'require', 'react-native'];

// Configure Metro to transform all node_modules for web (needed for expo-router import.meta)
config.transformer.unstable_allowRequireContext = true;
config.transformer.unstable_importSideEffects = false;

// Store the default resolver if it exists
const defaultResolver = config.resolver.resolveRequest;

// Add web-specific resolver to handle MMKV and @/ path aliases
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // On web, replace react-native-mmkv with an empty mock
  if (platform === 'web' && moduleName === 'react-native-mmkv') {
    return {
      filePath: require.resolve('./lib/mmkv-mock.js'),
      type: 'sourceFile',
    };
  }
  
  // Handle @/ path alias - resolve it to the project root
  if (moduleName.startsWith('@/')) {
    const aliasedPath = moduleName.replace('@/', '');
    const resolvedPath = path.resolve(__dirname, aliasedPath);
    
    // Try to resolve with platform-specific extensions
    const extensions = platform === 'web' 
      ? ['.web.ts', '.web.tsx', '.web.js', '.web.jsx', '.ts', '.tsx', '.js', '.jsx']
      : ['.native.ts', '.native.tsx', '.native.js', '.native.jsx', '.ts', '.tsx', '.js', '.jsx'];
    
    for (const ext of extensions) {
      const filePath = resolvedPath + ext;
      if (fs.existsSync(filePath)) {
        return {
          filePath: filePath,
          type: 'sourceFile',
        };
      }
      
      // Also try as a directory with index file
      const indexPath = path.join(resolvedPath, 'index' + ext);
      if (fs.existsSync(indexPath)) {
        return {
          filePath: indexPath,
          type: 'sourceFile',
        };
      }
    }
    
    // If not found with extensions, try the path as-is (might be a directory)
    if (fs.existsSync(resolvedPath)) {
      const stats = fs.statSync(resolvedPath);
      if (stats.isDirectory()) {
        // Try index files in the directory
        for (const ext of extensions) {
          const indexPath = path.join(resolvedPath, 'index' + ext);
          if (fs.existsSync(indexPath)) {
            return {
              filePath: indexPath,
              type: 'sourceFile',
            };
          }
        }
      }
    }
  }
  
  // For all other modules, use the default resolver
  // This handles node_modules, relative paths, and platform-specific extensions
  if (defaultResolver) {
    try {
      return defaultResolver(context, moduleName, platform);
    } catch (error) {
      // If default resolver fails and it's not an @/ alias, try context's resolver
      if (!moduleName.startsWith('@/')) {
        return context.resolveRequest(context, moduleName, platform);
      }
      // Re-throw for @/ aliases that we couldn't resolve
      throw error;
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
