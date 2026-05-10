import type { MessageType, MessageResponse, MaskResult } from '@/shared/types';
import { PIIDetector } from './pii-detector/detector';
import { MappingManager } from './mapping-manager';
import { storage } from './storage';

const detector = new PIIDetector();
const managers = new Map<string, MappingManager>();

async function getManager(conversationId: string): Promise<MappingManager> {
  let manager = managers.get(conversationId);
  if (manager) return manager;
  const saved = await storage.getConversation(conversationId);
  manager = saved
    ? MappingManager.fromJSON(saved, detector)
    : new MappingManager(conversationId, detector);
  managers.set(conversationId, manager);
  return manager;
}

async function persistManager(manager: MappingManager): Promise<void> {
  await storage.saveConversation(manager.toJSON());
}

chrome.runtime.onMessage.addListener(
  (message: MessageType, _sender, sendResponse: (r: MessageResponse) => void) => {
    (async () => {
      try {
        switch (message.type) {
          case 'MASK_TEXT': {
            const manager = await getManager(message.conversationId);
            const result: MaskResult = manager.mask(message.text);
            await persistManager(manager);
            sendResponse({ ok: true, data: result });
            break;
          }
          case 'UNMASK_TEXT': {
            const manager = await getManager(message.conversationId);
            const unmasked = manager.unmask(message.text);
            sendResponse({ ok: true, data: unmasked });
            break;
          }
          case 'CLEAR_CONVERSATION': {
            managers.delete(message.conversationId);
            await storage.clearConversation(message.conversationId);
            sendResponse({ ok: true, data: undefined });
            break;
          }
        }
      } catch (err) {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    })();
    return true;
  },
);
