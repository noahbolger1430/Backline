module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Ignore source map warnings from node_modules
      webpackConfig.ignoreWarnings = [
        /Failed to parse source map/,
        /ENOENT: no such file or directory/,
      ];

      // Disable source map loader for node_modules
      const sourceMapLoaderRule = webpackConfig.module.rules.find(
        (rule) => rule.enforce === 'pre' && rule.use && rule.use.some(use => use.loader && use.loader.includes('source-map-loader'))
      );

      if (sourceMapLoaderRule) {
        // Exclude node_modules from source map processing
        sourceMapLoaderRule.exclude = /node_modules/;
      }

      return webpackConfig;
    },
  },
};

