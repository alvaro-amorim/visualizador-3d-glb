// C:\Users\Álvaro Amorim\app-3d-educativo\webpack.rules.js

module.exports = [
  // Regra 1: Regra padrão para JavaScript (Babel)
  // Este é o único trabalho deste ficheiro agora!
  {
    test: /\.jsx?$/,
    exclude: /node_modules/,
    use: {
      loader: 'babel-loader',
      options: {
        presets: [
          '@babel/preset-env',
          '@babel/preset-react',
        ],
      },
    },
  },

  // Todas as outras regras (para imagens, hdr, glb)
  // foram REMOVIDAS daqui.
  // O CopyWebpackPlugin no 'webpack.renderer.config.js'
  // vai tratar de todos esses ficheiros.
];