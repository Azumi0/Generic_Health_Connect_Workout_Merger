module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!(.*react-native.*|.*expo.*|.*react-navigation.*)/)',
  ],
};
