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

## 라이선스

MIT
