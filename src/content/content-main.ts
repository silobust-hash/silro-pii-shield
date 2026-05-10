import { ClaudeAdapter } from './adapters/claude';
import { showPreflight } from './preflight-modal';
import { sendMessage } from '@/shared/messaging';
import type { MaskResult } from '@/shared/types';

const ALIAS_DETECTION_REGEX =
  /\[(?:주민번호|전화|이메일|사업자번호|사건)-\d+\]/;

(async function init() {
  if (location.hostname !== 'claude.ai') return;

  const adapter = new ClaudeAdapter();

  await waitForElement('div[contenteditable="true"]', 10000).catch(() => {
    console.warn('[pii-shield] input not ready');
  });

  const test = adapter.selfTest();
  if (!test.ok) {
    console.warn('[pii-shield] selfTest failed:', test.reason);
    return;
  }
  console.log('[pii-shield] active on claude.ai');

  adapter.hookSubmit(async (originalText: string) => {
    const conversationId = adapter.getConversationId();
    const result = await sendMessage<MaskResult>({
      type: 'MASK_TEXT',
      conversationId,
      text: originalText,
    });
    if (result.mappings.length === 0) {
      return originalText;
    }
    const decision = await showPreflight({
      original: originalText,
      masked: result.masked,
      mappings: result.mappings,
    });
    if (decision === 'cancel') {
      throw new Error('User cancelled');
    }
    return result.masked;
  });

  adapter.observeResponses((node) => {
    void replaceTextInNode(node, adapter.getConversationId());
  });
})();

function waitForElement(selector: string, timeout: number): Promise<HTMLElement> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) return resolve(el);
      if (Date.now() - start > timeout) return reject(new Error('timeout'));
      requestAnimationFrame(check);
    };
    check();
  });
}

async function replaceTextInNode(node: Node, conversationId: string): Promise<void> {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (!ALIAS_DETECTION_REGEX.test(text)) return;
    try {
      const unmasked = await sendMessage<string>({
        type: 'UNMASK_TEXT',
        conversationId,
        text,
      });
      if (unmasked !== text) node.textContent = unmasked;
    } catch (err) {
      console.warn('[pii-shield] unmask failed', err);
    }
    return;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const textNodes: Node[] = [];
    let current: Node | null;
    while ((current = walker.nextNode())) textNodes.push(current);
    for (const tn of textNodes) await replaceTextInNode(tn, conversationId);
  }
}
