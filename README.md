# silro-pii-shield

> 한국 노무사·변호사를 위한 AI 입력 PII 자동 가명화 Chrome 확장

ChatGPT/Claude/Gemini/Perplexity에 의뢰인 자료를 입력하기 전 자동으로 개인정보를 가명화하고, 응답에서 다시 복원합니다.

## v0.1 alpha 지원 범위

- ✅ claude.ai 텍스트 입력 가로채기
- ✅ 정규식 기반 PII 감지 (주민번호·전화·이메일·사업자번호·사건번호)
- ✅ Round-trip 자동 복원
- ❌ ChatGPT/Gemini/Perplexity (v0.2)
- ❌ 파일 첨부 (v0.4)

## 개발

```bash
npm install
npm run dev          # 개발 모드
npm test             # 단위 테스트
npm run test:e2e     # E2E 테스트
npm run build        # 프로덕션 빌드
```

## 수동 테스트 (v0.1 alpha)

1. `npm run build`
2. Chrome `chrome://extensions/` → 개발자 모드 ON → "압축해제된 확장 프로그램 로드" → `dist/` 폴더
3. claude.ai 접속 후 새 대화 시작
4. 다음 텍스트 입력 후 Enter:
   ```
   홍길동(900101-1234567) 010-1234-5678 hong@silro.co.kr 사건 2024가합1234
   ```
5. Preflight 모달이 표시되면 "전송" 클릭
6. Claude 응답에 `[주민번호-1]`, `[전화-1]` 등 가명이 포함되면 → 화면에서 자동으로 원래 값으로 복원되는지 확인

### 셀렉터가 안 맞을 때
claude.ai DOM이 변경되어 입력창이나 전송 버튼을 못 찾으면 콘솔에 `[pii-shield] selfTest failed: ...` 메시지가 나온다.
- DevTools Elements 탭으로 실제 셀렉터 확인
- `src/content/adapters/claude.ts`의 `INPUT_SELECTOR` / `SUBMIT_BUTTON_SELECTOR` / `RESPONSE_CONTAINER_SELECTOR` 수정
- `npm run build` → `chrome://extensions/`에서 reload
- GitHub Issue로 신고 부탁드립니다.

### 디버깅
- **Service Worker:** `chrome://extensions/` → silro-pii-shield → "service worker (활성화됨)" 클릭
- **Content Script:** claude.ai 페이지 F12 → Console에서 `[pii-shield] active on claude.ai` 메시지 확인

## 라이선스

MIT
