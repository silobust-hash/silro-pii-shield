/**
 * fetch와 XMLHttpRequest.prototype.send를 monkey-patch하여
 * AI 사이트의 파일 업로드 요청을 가로챈다.
 *
 * 보안 원칙:
 * - PII가 포함된 파일은 maskFile() 결과로 교체 후 업로드
 * - maskFile()이 null 반환 시 원본 그대로 진행 (PII 없음)
 * - maskFile()이 throw 시 업로드 차단
 *
 * 외부 서버 송신 절대 금지 — 모든 처리 브라우저 내 완결.
 */

export interface UploadInterceptorConfig {
  /** 업로드 endpoint 여부 판단 */
  isUploadEndpoint: (url: string) => boolean;
  /**
   * 파일을 가로챘을 때 호출.
   * 반환값: 가명화된 File (교체) | null (원본 그대로) | throw (차단)
   */
  onFileIntercepted: (url: string, file: File) => Promise<File | null>;
}

let originalFetch: typeof globalThis.fetch | null = null;
let originalXhrSend: typeof XMLHttpRequest.prototype.send | null = null;
let originalXhrOpen: typeof XMLHttpRequest.prototype.open | null = null;
let config: UploadInterceptorConfig | null = null;

export function installFetchInterceptor(cfg: UploadInterceptorConfig): void {
  config = cfg;
  originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url = typeof input === 'string' ? input
      : input instanceof URL ? input.href
      : (input as Request).url;

    if (config?.isUploadEndpoint(url) && init?.body instanceof FormData) {
      const formData = init.body;
      const fileEntry = [...formData.entries()].find(([, v]) => v instanceof File);

      if (fileEntry) {
        const [key, file] = fileEntry as [string, File];
        try {
          const maskedFile = await config.onFileIntercepted(url, file);
          if (maskedFile !== null) {
            const newFormData = new FormData();
            // 기존 항목 복사 (file 항목 제외)
            for (const [k, v] of formData.entries()) {
              if (k !== key) newFormData.append(k, v);
            }
            newFormData.append(key, maskedFile, maskedFile.name);
            return originalFetch!(input, { ...init, body: newFormData });
          }
        } catch {
          // 파일 처리 실패 → 업로드 차단
          throw new Error('PII 마스킹 실패: 파일 업로드가 차단되었습니다.');
        }
      }
    }

    return originalFetch!(input, init);
  };
}

export function uninstallFetchInterceptor(): void {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
  }
  config = null;
}

export function installXhrInterceptor(cfg: UploadInterceptorConfig): void {
  originalXhrSend = XMLHttpRequest.prototype.send;
  originalXhrOpen = XMLHttpRequest.prototype.open;

  // open()을 패치해 URL을 캡처
  XMLHttpRequest.prototype.open = function patchedOpen(
    this: XMLHttpRequest & { _pii_url?: string },
    method: string,
    url: string | URL,
    ...rest: any[]
  ) {
    this._pii_url = typeof url === 'string' ? url : url.href;
    return originalXhrOpen!.apply(this, [method, url, ...rest] as any);
  };

  XMLHttpRequest.prototype.send = function patchedXhrSend(
    this: XMLHttpRequest & { _pii_url?: string },
    body?: Document | XMLHttpRequestBodyInit | null
  ): void {
    const url = this._pii_url ?? '';

    if (cfg.isUploadEndpoint(url) && body instanceof FormData) {
      const fileEntry = [...body.entries()].find(([, v]) => v instanceof File);

      if (fileEntry) {
        const [key, file] = fileEntry as [string, File];
        const xhr = this;

        cfg.onFileIntercepted(url, file)
          .then((maskedFile) => {
            if (maskedFile !== null) {
              const newFormData = new FormData();
              for (const [k, v] of body.entries()) {
                if (k !== key) newFormData.append(k, v);
              }
              newFormData.append(key, maskedFile, maskedFile.name);
              originalXhrSend!.call(xhr, newFormData);
            } else {
              originalXhrSend!.call(xhr, body);
            }
          })
          .catch(() => {
            // 파일 처리 실패 → 업로드 차단 (send 호출 안 함)
            xhr.dispatchEvent(new ErrorEvent('error', {
              message: 'PII 마스킹 실패: 파일 업로드가 차단되었습니다.',
            }));
          });
        return; // 비동기 처리 → 즉시 return
      }
    }

    originalXhrSend!.call(this, body);
  };
}

export function installInterceptors(cfg: UploadInterceptorConfig): void {
  installFetchInterceptor(cfg);
  installXhrInterceptor(cfg);
}

export function uninstallInterceptors(): void {
  uninstallFetchInterceptor();
  if (originalXhrSend) {
    XMLHttpRequest.prototype.send = originalXhrSend;
    originalXhrSend = null;
  }
  if (originalXhrOpen) {
    XMLHttpRequest.prototype.open = originalXhrOpen;
    originalXhrOpen = null;
  }
}
