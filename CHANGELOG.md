# Changelog

## [0.1.0] - 2026-05-10 (alpha)

### Added
- claude.ai 텍스트 입력 가로채기
- 정규식 기반 PII 감지 (주민번호·전화·이메일·사업자번호·사건번호) — 33 단위 테스트
- MappingManager (mask + unmask + JSON 직렬화) — 14 단위 테스트
- chrome.storage.session 기반 휘발성 매핑 저장 (탭 닫으면 자동 삭제)
- Round-trip 자동 가명화/복원 (응답 영역 MutationObserver)
- Preflight 미리보기 모달 (DOM API only, XSS-safe)
- Service Worker 메시지 라우팅 (MASK_TEXT / UNMASK_TEXT / CLEAR_CONVERSATION)
- E2E 스모크 테스트 (Playwright)

### Security
- `host_permissions = claude.ai`만 (외부 도메인 0)
- innerHTML/insertAdjacentHTML/outerHTML 사용 0건 (XSS 차단)
- 외부 서버 송신 0 (모든 처리 브라우저 내)
- chrome.storage.session 휘발성 (영구 저장 X)

### Known Limitations
- claude.ai만 지원 (ChatGPT/Gemini/Perplexity는 v0.2)
- 텍스트 입력만 (파일 첨부는 v0.4)
- 사용자 사전·이름 휴리스틱 없음 (v0.2/v0.3)
- 아이콘은 placeholder (1x1 PNG) — 정식 디자인 v1.0 전까지 교체
- claude.ai DOM 변경 시 어댑터 깨짐 가능 (selfTest로 감지·로그)
