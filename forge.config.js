// C:\Users\Álvaro Amorim\app-3d-educativo\forge.config.js
// (Este ficheiro está na raiz do teu projeto)

const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
// <<< ADICIONADO: Importamos o CopyWebpackPlugin >>>
// (Temos de o definir aqui também, já que o renderer.config.js é carregado)
const CopyWebpackPlugin = require('copy-webpack-plugin');


// <<< ADICIONADO: Definimos o nosso CSP numa variável >>>
const csp =
  "default-src 'self' 'unsafe-inline' 'unsafe-eval' data:; " +
  "connect-src 'self' blob:; " +
  "worker-src 'self' blob:; " +
  "img-src 'self' blob: data:;";

module.exports = {
  packagerConfig: {
    asar: true,
  },
  rebuildConfig: {},
  makers: [
    // ... (os teus makers 'squirrel', 'zip', etc. ficam aqui)
    { name: '@electron-forge/maker-squirrel', config: {} },
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
    { name: '@electron-forge/maker-deb', config: {} },
    { name: '@electron-forge/maker-rpm', config: {} },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        // <<< ESTA É A CORREÇÃO >>>
        // Diz ao servidor de desenvolvimento (npm start)
        // para usar a nossa política de segurança completa.
        devContentSecurityPolicy: csp,
        // <<< FIM DA CORREÇÃO >>>

        mainConfig: './webpack.main.config.js',
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './src/index.html',
              js: './src/renderer.js',
              name: 'main_window',
              preload: {
                js: './src/preload.js',
              },
            },
          ],
        },
      },
    },
    new FusesPlugin({
      // ... (as tuas Fuses ficam aqui)
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};