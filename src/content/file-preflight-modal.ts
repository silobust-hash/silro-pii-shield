import type { FileProcessResult } from '@/shared/types';

/**
 * 파일 처리 결과로 Preflight 모달을 표시한다.
 * innerHTML 금지 — 모든 DOM은 createElement로 생성
 */
export async function showFilePreflightModal(result: FileProcessResult): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = 'pii-shield-file-preflight';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '파일 PII 마스킹 미리보기');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.5);' +
      'z-index:2147483647;display:flex;align-items:center;justify-content:center;' +
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif;';

    const modal = document.createElement('div');
    modal.style.cssText =
      'background:white;border-radius:12px;padding:24px;' +
      'max-width:600px;width:90%;max-height:80vh;overflow-y:auto;' +
      'box-shadow:0 10px 40px rgba(0,0,0,0.2);';

    // v0.6: OCR 신뢰도 낮음 경고 (requiresConfirm = true)
    if (result.requiresConfirm) {
      const warning = document.createElement('div');
      warning.className = 'pii-ocr-warning';
      warning.style.cssText =
        'background:#fefce8;border:1px solid #fde047;border-radius:6px;' +
        'padding:10px 12px;margin-bottom:12px;font-size:13px;color:#854d0e;' +
        'display:flex;align-items:center;gap:8px;';
      const icon = document.createElement('span');
      icon.textContent = '⚠ OCR 인식률 낮음 (';
      const pct = document.createElement('strong');
      pct.textContent = `${Math.round((result.ocrConfidence ?? 0) * 100)}%`;
      const msg = document.createElement('span');
      msg.textContent = '). 추출된 텍스트를 직접 확인해 주세요.';
      warning.appendChild(icon);
      warning.appendChild(pct);
      warning.appendChild(msg);
      modal.prepend(warning);
    }

    // 제목
    const title = document.createElement('h2');
    title.style.cssText = 'margin:0 0 12px;font-size:18px;';
    title.textContent = '파일 마스킹 미리보기';
    modal.appendChild(title);

    // 파일 정보 요약
    const fileSummary = document.createElement('p');
    fileSummary.style.cssText = 'font-size:14px;color:#374151;margin:0 0 8px;';
    fileSummary.textContent = `감지된 PII: ${result.piiSummary?.length ?? 0}개`;
    modal.appendChild(fileSummary);

    // 추출 텍스트 프리뷰 (최대 500자)
    const previewLabel = document.createElement('p');
    previewLabel.style.cssText = 'font-size:12px;color:#6b7280;margin:0 0 4px;font-weight:600;';
    previewLabel.textContent = '마스킹된 텍스트 (미리보기):';
    modal.appendChild(previewLabel);

    const previewBox = document.createElement('pre');
    previewBox.style.cssText =
      'background:#f3f4f6;padding:12px;border-radius:6px;margin:0 0 12px;' +
      'white-space:pre-wrap;font-size:12px;max-height:200px;overflow-y:auto;';
    previewBox.textContent = result.extractedText?.slice(0, 500) ?? '(텍스트 없음)';
    modal.appendChild(previewBox);

    // PII 목록
    const piiLabel = document.createElement('p');
    piiLabel.style.cssText = 'font-size:13px;font-weight:600;margin:0 0 6px;';
    piiLabel.textContent = '감지된 항목:';
    modal.appendChild(piiLabel);

    const piiList = document.createElement('ul');
    piiList.style.cssText = 'margin:0 0 16px;padding-left:20px;font-size:12px;line-height:1.8;';
    for (const pii of result.piiSummary ?? []) {
      const item = document.createElement('li');
      const origCode = document.createElement('code');
      origCode.style.cssText = 'background:#e5e7eb;padding:1px 4px;border-radius:3px;font-family:monospace;';
      origCode.textContent = (pii as any).original ?? String(pii);
      const arrow = document.createTextNode(' → ');
      const aliasCode = document.createElement('code');
      aliasCode.style.cssText = 'background:#e5e7eb;padding:1px 4px;border-radius:3px;font-family:monospace;';
      aliasCode.textContent = (pii as any).alias ?? '(가명)';
      item.appendChild(origCode);
      item.appendChild(arrow);
      item.appendChild(aliasCode);
      piiList.appendChild(item);
    }
    modal.appendChild(piiList);

    // 버튼
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';

    const cancelBtn = document.createElement('button');
    cancelBtn.style.cssText =
      'padding:8px 16px;border:1px solid #d1d5db;background:white;border-radius:6px;cursor:pointer;';
    cancelBtn.textContent = '취소';

    const confirmBtn = document.createElement('button');
    confirmBtn.style.cssText =
      'padding:8px 16px;border:0;background:#1e40af;color:white;border-radius:6px;cursor:pointer;';
    confirmBtn.textContent = '전송';

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(confirmBtn);
    modal.appendChild(btnRow);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    confirmBtn.focus();

    confirmBtn.addEventListener('click', () => { overlay.remove(); resolve(true); });
    cancelBtn.addEventListener('click', () => { overlay.remove(); resolve(false); });
  });
}
