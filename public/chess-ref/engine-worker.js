'use strict';

// olithink.js expects a browser-like global named "window".
self.window = self;

function toErrorMessage(err) {
  if (!err) return 'Unknown worker error';
  if (typeof err === 'string') return err;
  if (err && typeof err.message === 'string') return err.message;
  try {
    return JSON.stringify(err);
  } catch (_e) {
    return String(err);
  }
}

try {
  importScripts('olithink.js');
  self.postMessage({ type: 'ready' });
} catch (err) {
  self.postMessage({ type: 'ready', error: toErrorMessage(err) });
}

self.onmessage = (event) => {
  const data = event && event.data ? event.data : {};
  const id = Number(data.id);
  if (!Number.isFinite(id)) return;

  try {
    if (!self.OliThinkEngine || typeof self.OliThinkEngine.analyzeFEN !== 'function') {
      throw new Error('Engine analyzeFEN is unavailable in worker');
    }
    const fen = typeof data.fen === 'string' ? data.fen : '';
    const options = data.options && typeof data.options === 'object' ? data.options : {};
    const result = self.OliThinkEngine.analyzeFEN(fen, options);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: toErrorMessage(err) });
  }
};

