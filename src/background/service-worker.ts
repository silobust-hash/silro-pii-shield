import type {
  MessageType,
  MessageResponse,
  MaskResult,
  UserDictEntry,
  AllSiteSettings,
  SiteKey,
  SiteSettings,
  ClientProfile,
} from '@/shared/types';
import { PIIDetector } from './pii-detector/detector';
import { DictionaryDetector } from './pii-detector/dictionary-detector';
import { MappingManager } from './mapping-manager';
import { storage, siteSettingsStore } from './storage';
import { dictStore } from './dict-store';
import { profileStore } from './profile-store';
import { hybridModeStore } from './hybrid-mode';

let dictEntries: UserDictEntry[] = [];
const dictDetector = new DictionaryDetector(dictEntries);
const detector = new PIIDetector(dictDetector);
const managers = new Map<string, MappingManager>();

async function loadDict(): Promise<void> {
  dictEntries = await dictStore.getAll();
  dictDetector.update(dictEntries);
}

// Service worker 기동 시 사전 로드
void loadDict();

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
          case 'GET_MAPPINGS': {
            const saved = await storage.getConversation(message.conversationId);
            sendResponse({ ok: true, data: saved ?? undefined });
            break;
          }
          case 'GET_DICT': {
            const entries: UserDictEntry[] = await dictStore.getAll();
            sendResponse({ ok: true, data: entries });
            break;
          }
          case 'UPSERT_DICT_ENTRY': {
            await dictStore.upsert(message.entry);
            await loadDict(); // detector 캐시 갱신
            sendResponse({ ok: true, data: undefined });
            break;
          }
          case 'DELETE_DICT_ENTRY': {
            await dictStore.delete(message.id);
            await loadDict();
            sendResponse({ ok: true, data: undefined });
            break;
          }
          case 'GET_SITE_SETTINGS': {
            const settings: AllSiteSettings = await siteSettingsStore.getAll();
            sendResponse({ ok: true, data: settings });
            break;
          }
          case 'SET_SITE_SETTINGS': {
            await siteSettingsStore.set(
              message.siteKey as SiteKey,
              message.settings as SiteSettings,
            );
            sendResponse({ ok: true, data: undefined });
            break;
          }
          // v0.3: Profile CRUD
          case 'LIST_PROFILES': {
            const profiles: ClientProfile[] = await profileStore.list();
            sendResponse({ ok: true, data: profiles });
            break;
          }
          case 'GET_PROFILE': {
            const profile = await profileStore.get(message.profileId);
            sendResponse({ ok: true, data: profile ?? undefined });
            break;
          }
          case 'SAVE_PROFILE': {
            await profileStore.save(message.profile);
            sendResponse({ ok: true, data: undefined });
            break;
          }
          case 'DELETE_PROFILE': {
            await profileStore.delete(message.profileId);
            sendResponse({ ok: true, data: undefined });
            break;
          }
          // v0.3: Hybrid mode
          case 'GET_HYBRID_MODE': {
            const mode = await hybridModeStore.getMode(message.hostname);
            sendResponse({ ok: true, data: mode });
            break;
          }
          case 'SET_HYBRID_MODE': {
            await hybridModeStore.setMode(message.setting);
            sendResponse({ ok: true, data: undefined });
            break;
          }
          // v0.3: MASK_NAMES (Layer 3 confirm result)
          case 'MASK_NAMES': {
            const manager = await getManager(message.conversationId);
            const result = manager.maskNames(message.text, message.names);
            await persistManager(manager);
            sendResponse({ ok: true, data: result });
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
