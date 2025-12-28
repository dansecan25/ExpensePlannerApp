module.exports = {
  root: true,
  extends: ['@react-native-community'],
  parser: '@babel/eslint-parser',
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
      presets: ['module:@react-native/babel-preset'],
    },
  },
  ignorePatterns: [
    'android/',
    'ios/',
    'node_modules/',
  ],
};
