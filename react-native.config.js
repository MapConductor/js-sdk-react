module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath: 'import com.mapconductor.react.MapConductorReactPackage;',
        packageInstance: 'new MapConductorReactPackage()',
      },
      ios: {
        sourceDir: './ios',
      },
    },
  },
};
