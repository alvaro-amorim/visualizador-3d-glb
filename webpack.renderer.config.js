// C:\Users\Álvaro Amorim\app-3d-educativo\webpack.renderer.config.js

const CopyWebpackPlugin = require('copy-webpack-plugin');
const rules = require('./webpack.rules');
// <<< NOVO: Importamos o 'path' do Node.js >>>
const path = require('path');

// Adiciona a regra de CSS
rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

module.exports = {
  module: {
    rules,
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/assets',
          to: 'assets',
        },
      ],
    }),
  ],
  
  // <<< ESTA É A NOVA SOLUÇÃO >>>
  // Adicionamos esta secção 'resolve' para ajudar o Webpack
  resolve: {
    // Diz explicitamente ao Webpack para procurar módulos
    // na pasta 'node_modules' que está na raiz do projeto
    // (um nível acima da pasta 'src')
    modules: [path.resolve(__dirname, '../node_modules'), 'node_modules'],
    // Mantém as extensões padrão que o Webpack procura
    extensions: ['.js', '.jsx', '.json', '.css', '.wasm'], 
  },
  // <<< FIM DA NOVA SOLUÇÃO >>>
};