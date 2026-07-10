'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('raff', {
  getAll: () => ipcRenderer.invoke('lib:getAll'),
  addBook: (book) => ipcRenderer.invoke('lib:add', book),
  updateBook: (id, patch) => ipcRenderer.invoke('lib:update', id, patch),
  removeBook: (id) => ipcRenderer.invoke('lib:remove', id),
  restoreBook: (book) => ipcRenderer.invoke('lib:restore', book),
  getStats: () => ipcRenderer.invoke('lib:stats'),
  getMeta: () => ipcRenderer.invoke('lib:meta'),

  exportJson: () => ipcRenderer.invoke('lib:exportJson'),
  exportCsv: () => ipcRenderer.invoke('lib:exportCsv'),
  exportTxt: () => ipcRenderer.invoke('lib:exportTxt'),
  exportPdf: () => ipcRenderer.invoke('lib:exportPdf'),
  importJson: () => ipcRenderer.invoke('lib:importJson'),
  resetAll: () => ipcRenderer.invoke('lib:resetAll'),

  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
});
