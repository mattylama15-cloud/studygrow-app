const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// WebM videa (stromy s průhledným pozadím) musí metro brát jako asset.
if (!config.resolver.assetExts.includes('webm')) {
  config.resolver.assetExts.push('webm');
}

module.exports = config;
