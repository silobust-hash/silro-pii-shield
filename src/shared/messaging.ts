import type { MessageType, MessageResponse } from './types';

export function sendMessage<T = unknown>(message: MessageType): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: MessageResponse) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response || !response.ok) {
        reject(new Error(response?.error ?? 'Unknown error'));
        return;
      }
      resolve(response.data as T);
    });
  });
}
