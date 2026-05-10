import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * E2E: claude.ai 파일 업로드 플로우
 *
 * 전제조건:
 * 1. `npm run build`로 dist/ 생성
 * 2. Chrome에 확장 개발자 로드 (dist/ 폴더)
 * 3. claude.ai 로그인 상태
 *
 * 자동화 한계: claude.ai 로그인 인증이 필요해 완전 자동화는 어렵다.
 * 아래 테스트는 로컬 환경에서 수동 실행하거나, 인증 쿠키 주입으로 실행.
 */

test.describe('파일 업로드 인터셉트 (claude.ai)', () => {
  test.skip(!!process.env.CI, 'CI 환경에서는 스킵 (로그인 필요)');

  test('DOCX 파일 첨부 → Preflight 모달 표시', async ({ page }) => {
    // 확장 로드는 playwright.config.ts의 args에서 설정
    await page.goto('https://claude.ai');

    // 파일 첨부 버튼 클릭
    const attachBtn = page.locator('[aria-label*="파일"]').first();
    await attachBtn.click();

    // 테스트 파일 첨부 (tests/fixtures/files/sample-masked.docx — 실행 전 준비 필요)
    const filePath = path.join(__dirname, '../fixtures/files/sample-masked.docx');
    await page.setInputFiles('input[type="file"]', filePath);

    // Preflight 모달 표시 확인
    const modal = page.locator('[role="dialog"][aria-label="파일 PII 마스킹 미리보기"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 모달에 PII 감지 항목 표시 확인
    await expect(modal.locator('h2')).toContainText('파일 마스킹 미리보기');
  });
});

/**
 * 수동 검증 체크리스트 (각 사이트별)
 *
 * claude.ai:
 * [ ] DOCX 첨부 → Preflight 모달 표시
 * [ ] "전송" 클릭 → 가명화된 파일로 업로드
 * [ ] "취소" 클릭 → 업로드 차단
 * [ ] 100MB 초과 파일 → 토스트 경고 표시
 * [ ] 미지원 형식 (ZIP) → 토스트 경고 표시
 *
 * chatgpt.com:
 * [ ] 동일 시나리오 반복
 *
 * gemini.google.com:
 * [ ] GCS signed URL 가로채기 확인 (DevTools Network 탭)
 * [ ] Preflight 모달 표시 확인
 * [ ] Spike: isUploadEndpoint 패턴 DevTools로 검증 필수
 *
 * perplexity.ai:
 * [ ] 동일 시나리오 반복
 */
