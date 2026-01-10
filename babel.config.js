// #region agent log
const fs = require('fs');
const DEBUG_LOG_PATH = '/Users/andywolfe/Documents/Development/TrainingApp/.cursor/debug.log';
function debugLog(hypothesisId, location, message, data) {
  const entry = JSON.stringify({ hypothesisId, location, message, data, timestamp: Date.now(), sessionId: 'debug-session', runId: 'babel-transform' }) + '\n';
  try { fs.appendFileSync(DEBUG_LOG_PATH, entry); } catch (e) {}
}
let metaPropertyCount = 0;
const transformedFiles = new Set();
// #endregion

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // Transform import.meta for web compatibility
      function ({ types: t }) {
        return {
          visitor: {
            MetaProperty(path, state) {
              // #region agent log
              metaPropertyCount++;
              const filename = state.filename || 'unknown';
              const isExpo = filename.includes('expo') || filename.includes('@expo');
              transformedFiles.add(filename);
              debugLog('A', 'babel.config.js:MetaProperty', 'Found import.meta - TRANSFORMING', {
                filename: filename,
                isExpoRouter: filename.includes('expo-router'),
                isExpo: isExpo,
                isZustand: filename.includes('zustand'),
                isNodeModules: filename.includes('node_modules'),
                metaName: path.node.meta.name,
                propertyName: path.node.property.name,
                count: metaPropertyCount,
                transformedFilesCount: transformedFiles.size,
              });
              // #endregion
              if (
                path.node.meta.name === 'import' &&
                path.node.property.name === 'meta'
              ) {
                // Check if it's import.meta.url
                const parent = path.parent;
                if (t.isMemberExpression(parent) && 
                    t.isIdentifier(parent.property, { name: 'url' })) {
                  // Replace import.meta.url with a compatible alternative
                  path.parentPath.replaceWith(
                    t.conditionalExpression(
                      t.binaryExpression(
                        '!==',
                        t.unaryExpression('typeof', t.identifier('document')),
                        t.stringLiteral('undefined')
                      ),
                      t.conditionalExpression(
                        t.memberExpression(
                          t.memberExpression(t.identifier('document'), t.identifier('currentScript')),
                          t.identifier('src'),
                          false
                        ),
                        t.memberExpression(
                          t.memberExpression(t.identifier('document'), t.identifier('currentScript')),
                          t.identifier('src'),
                          false
                        ),
                        t.stringLiteral('')
                      ),
                      t.stringLiteral('')
                    )
                  );
                } else {
                  // Replace import.meta with an object
                  path.replaceWith(
                    t.objectExpression([
                      t.objectProperty(
                        t.identifier('url'),
                        t.conditionalExpression(
                          t.binaryExpression(
                            '!==',
                            t.unaryExpression('typeof', t.identifier('document')),
                            t.stringLiteral('undefined')
                          ),
                          t.conditionalExpression(
                            t.memberExpression(t.identifier('document'), t.identifier('currentScript')),
                            t.memberExpression(
                              t.memberExpression(t.identifier('document'), t.identifier('currentScript')),
                              t.identifier('src'),
                              false
                            ),
                            t.stringLiteral('')
                          ),
                          t.stringLiteral('')
                        )
                      )
                    ])
                  );
                }
              }
            },
          },
        };
      },
    ],
  };
};
