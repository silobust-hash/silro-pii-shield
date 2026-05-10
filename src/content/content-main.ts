import { ClaudeAdapter } from './adapters/claude';
import { ChatGPTAdapter } from './adapters/chatgpt';
import { GeminiAdapter } from './adapters/gemini';
import { PerplexityAdapter } from './adapters/perplexity';
import { showPreflight } from './preflight-modal';
// Task 16에서 구현 — 파일 Preflight 모달
import { showFilePreflightModal } from './file-preflight-modal';
import { showKoreanNameConfirm } from './confirm-dialog';
import { showMappingPanel, nodeContainsAlias } from './mapping-panel';
import { sendMessage } from '@/shared/messaging';
import { installInterceptors } from './upload-interceptor';
import type { MaskResult, Mapping, SiteKey, FileInterceptEvent, FileProcessResult } from '@/shared/types';
import type { SiteAdapter } from './adapters/base';

// dict alias 패턴도 포함: [주민번호-1], A씨, 회사1, 병원1, 부서1
const ALIAS_DETECTION_REGEX =
  /\[(?:주민번호|전화|이메일|사업자번호|사건)-\d+\]|[A-Z]+씨|회사\d+|병원\d+|부서\d+/;

type AdapterMap = Partial<Record<string, SiteAdapter>>;

const ADAPTERS: AdapterMap = {
  'claude.ai': new ClaudeAdapter(),
  'chatgpt.com': new ChatGPTAdapter(),
  'gemini.google.com': new GeminiAdapter(),
  'perplexity.ai': new PerplexityAdapter(),
};

const INPUT_SELECTORS: Record<string, string> = {
  'claude.ai': 'div[contenteditable="true"]',
  'chatgpt.com': 'div#prompt-textarea',
  'gemini.google.com': 'rich-textarea',
  'perplexity.ai': 'textarea[placeholder*="Ask"]',
};

(async function init() {
  const hostname = location.hostname.replace(/^www\./, '');
  const adapter = ADAPTERS[hostname];
  if (!adapter) return;

  const siteKey = hostname as SiteKey;

  // siteSettings 게이트 — 비활성이면 조용히 종료
  try {
    const settings = await sendMessage<Record<string, { enabled: boolean }>>({
      type: 'GET_SITE_SETTINGS',
    });
    const enabled = (settings as Record<string, { enabled: boolean }>)[siteKey]?.enabled ?? true;
    if (!enabled) {
      console.log(`[pii-shield] disabled for ${hostname}`);
      return;
    }
  } catch {
    // 설정 로드 실패 시 기본값(활성)으로 진행
  }

  // 사이트별 모드 조회
  let mode: 'round-trip' | 'hybrid' = 'round-trip';
  try {
    const modeResponse = await sendMessage<'round-trip' | 'hybrid'>({
      type: 'GET_HYBRID_MODE',
      hostname,
    });
    mode = modeResponse ?? 'round-trip';
  } catch {
    // 기본값 유지
  }

  // input element 준비 대기
  const inputSelector = INPUT_SELECTORS[hostname] ?? 'textarea';
  await waitForElement(inputSelector, 12000).catch(() => {
    console.warn(`[pii-shield] input not ready on ${hostname}`);
  });

  const test = adapter.selfTest();
  if (!test.ok) {
    console.warn(`[pii-shield] selfTest failed on ${hostname}:`, test.reason);
    return;
  }
  console.log(`[pii-shield] active on ${hostname} — mode: ${mode}`);

  adapter.hookSubmit(async (originalText: string) => {
    const conversationId = adapter.getConversationId();

    // 1. Layer 1/2 마스킹
    const result = await sendMessage<MaskResult>({
      type: 'MASK_TEXT',
      conversationId,
      text: originalText,
    });

    // 2. Layer 3 pending names confirm
    let finalMasked = result.masked;
    if (result.pendingNames && result.pendingNames.length > 0) {
      const { confirmed } = await showKoreanNameConfirm(result.pendingNames);
      if (confirmed.length > 0) {
        // confirmed names를 추가 마스킹
        const additionalResult = await sendMessage<MaskResult>({
          type: 'MASK_NAMES',
          conversationId,
          text: finalMasked,
          names: confirmed.map((n) => n.original),
        });
        finalMasked = additionalResult.masked;
      }
    }

    if (result.mappings.length === 0 && (!result.pendingNames || result.pendingNames.length === 0)) {
      return originalText;
    }

    const decision = await showPreflight({
      original: originalText,
      masked: finalMasked,
      mappings: result.mappings,
    });

    if (decision === 'cancel') {
      throw new Error('User cancelled');
    }

    // 매핑 패널을 응답 도착 전에 미리 표시 (observeResponses 의존성 제거)
    void (async () => {
      try {
        console.log('[pii-shield] requesting GET_MAPPINGS for', conversationId);
        const mappings = await sendMessage<Mapping[]>({
          type: 'GET_MAPPINGS',
          conversationId,
        });
        console.log('[pii-shield] got mappings:', mappings);
        if (mappings && mappings.length > 0) {
          console.log('[pii-shield] calling showMappingPanel with', mappings.length, 'entries');
          showMappingPanel(mappings);
        } else {
          // result.mappings를 fallback으로 사용
          if (result.mappings && result.mappings.length > 0) {
            console.log('[pii-shield] using result.mappings fallback:', result.mappings.length, 'entries');
            showMappingPanel(result.mappings);
          } else {
            console.warn('[pii-shield] no mappings to show');
          }
        }
      } catch (err) {
        console.warn('[pii-shield] failed to show mapping panel', err);
        // catch 블록에서도 result.mappings를 fallback으로 사용
        if (result.mappings && result.mappings.length > 0) {
          console.log('[pii-shield] using result.mappings after error fallback');
          showMappingPanel(result.mappings);
        }
      }
    })();

    return finalMasked;
  });

  // v0.4: 파일 업로드 인터셉터 초기화
  installInterceptors({
    isUploadEndpoint: (url) => adapter.isUploadEndpoint(url),
    onFileIntercepted: async (_url, file) => {
      // 1. ArrayBuffer 읽기
      const arrayBuffer = await file.arrayBuffer();
      const conversationId = adapter.getConversationId();

      // 2. SW로 파일 처리 요청
      const result: FileProcessResult = await chrome.runtime.sendMessage({
        type: 'FILE_INTERCEPT',
        payload: {
          requestId: crypto.randomUUID(),
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          arrayBuffer,
          site: adapter.siteId,
          conversationId,
        } satisfies FileInterceptEvent,
      });

      if (result.status === 'size_exceeded' || result.status === 'unsupported') {
        // 미지원 포맷: 사용자에게 안내 후 업로드 차단
        showFileWarningToast(result.errorMessage ?? '파일 업로드 차단됨');
        throw new Error(result.errorMessage);
      }

      if (result.status === 'parse_error') {
        showFileWarningToast(result.errorMessage ?? 'PII 파싱 실패');
        throw new Error(result.errorMessage);
      }

      if (!result.piiSummary?.length) {
        return null; // PII 없음 → 원본 그대로
      }

      // 3. Preflight 모달 표시 (사용자 확인)
      const approved = await showFilePreflightModal(result);
      if (!approved) throw new Error('사용자가 파일 업로드를 취소했습니다.');

      // 4. 가명화된 파일 반환
      if (!result.reconstructedBuffer) return null;
      return new File(
        [result.reconstructedBuffer],
        result.reconstructedFileName ?? file.name,
        { type: result.reconstructedMimeType ?? file.type }
      );
    },
  });

  // Round-trip 모드: 응답 자동 복원 시도 + 매핑 패널 폴백
  if (mode === 'round-trip') {
    adapter.observeResponses((node) => {
      const conversationId = adapter.getConversationId();
      void replaceTextInNode(node, conversationId);
      // React 재렌더링으로 자동 복원이 덮어써지는 경우 대비:
      // 응답에 가명이 발견되면 화면에 매핑 패널 자동 표시
      if (nodeContainsAlias(node, ALIAS_DETECTION_REGEX)) {
        void showMappingPanelForConversation(conversationId);
      }
    });
  }
  // Hybrid 모드: 사이드패널에서 수동 복원 (observeResponses 등록 안 함)

  // v1.0: Keyboard shortcut message handlers
  chrome.runtime.onMessage.addListener((message: { type: string }) => {
    if (message.type === 'TRIGGER_PREVIEW') {
      triggerPreflightModal(adapter);
    }
    if (message.type === 'OPEN_PROFILE_SWITCHER') {
      openProfileSwitcher();
    }
  });
})();

/** v1.0: Trigger preflight modal from keyboard shortcut */
function triggerPreflightModal(adapter: SiteAdapter): void {
  const hostname = location.hostname.replace(/^www\./, '');
  const selector = INPUT_SELECTORS[hostname] ?? 'textarea';
  const inputEl = document.querySelector<HTMLElement>(selector);
  if (!inputEl) return;
  const text = inputEl.textContent ?? (inputEl as HTMLInputElement).value ?? '';
  if (!text.trim()) return;
  const conversationId = adapter.getConversationId();
  void (async () => {
    try {
      const result = await sendMessage<MaskResult>({
        type: 'MASK_TEXT',
        conversationId,
        text,
      });
      await showPreflight({
        original: text,
        masked: result.masked,
        mappings: result.mappings,
      });
    } catch (err) {
      console.warn('[pii-shield] triggerPreflightModal error', err);
    }
  })();
}

/** v1.0: Open profile switcher panel (side panel focus) */
function openProfileSwitcher(): void {
  // Side panel is opened by the service worker via chrome.sidePanel.open().
  // Content script notifies user with a brief toast.
  const toast = document.createElement('div');
  toast.style.cssText =
    'position:fixed;bottom:24px;right:24px;z-index:2147483647;' +
    'background:#1e40af;color:white;padding:10px 16px;border-radius:8px;' +
    'font-family:-apple-system,sans-serif;font-size:13px;' +
    'box-shadow:0 4px 12px rgba(0,0,0,0.25);';
  toast.textContent = '[PII Shield] 프로필 패널을 확인하세요.';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/** 파일 처리 경고 토스트 표시 */
function showFileWarningToast(message: string): void {
  const toast = document.createElement('div');
  toast.style.cssText =
    'position:fixed;bottom:24px;right:24px;z-index:2147483647;' +
    'background:#dc2626;color:white;padding:12px 16px;border-radius:8px;' +
    'font-family:-apple-system,sans-serif;font-size:14px;max-width:320px;' +
    'box-shadow:0 4px 12px rgba(0,0,0,0.3);';
  toast.textContent = `[PII Shield] ${message}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

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

async function showMappingPanelForConversation(conversationId: string): Promise<void> {
  try {
    const mappings = await sendMessage<Mapping[]>({
      type: 'GET_MAPPINGS',
      conversationId,
    });
    if (mappings && mappings.length > 0) {
      showMappingPanel(mappings);
    }
  } catch (err) {
    console.warn('[pii-shield] failed to load mappings for panel', err);
  }
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
