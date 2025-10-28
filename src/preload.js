// 'contextBridge' expõe APIs de forma segura para o renderer
// 'ipcRenderer' envia mensagens para o processo main (backend)
const { contextBridge, ipcRenderer } = require('electron');

// Expõe uma API chamada 'electronAPI' na 'window' do nosso renderer
contextBridge.exposeInMainWorld('electronAPI', {
  
  /**
   * Invoca o canal 'dialog:openFile' que criámos no index.js
   * e retorna o resultado (os dados do ficheiro ou null).
   */
  openFile: () => ipcRenderer.invoke('dialog:openFile')

});