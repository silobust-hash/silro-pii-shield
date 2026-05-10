# Changelog

## [0.2.0] — 2026-05-10

### Added
- ChatGPT (chatgpt.com) SiteAdapter — ProseMirror contenteditable 지원
- Gemini (gemini.google.com) SiteAdapter — Quill 에디터 + Shadow DOM fallback
- Perplexity (perplexity.ai) SiteAdapter — 표준 textarea, NativeInputValueSetter
- UserDictEntry 타입 + DictCategory (person/company/hospital/department/custom)
- DictionaryDetector (Layer 2) — 패턴 매칭, 긴 매치 우선, caseInsensitive 옵션
- PIIDetector Layer 2 통합 — dict 우선, regex 폴백, 겹침 해소
- MappingManager aliasOverride 지원 — dict entry 고정 가명 사용
- unmask 동적 역패턴 — dict alias 포함 역치환
- dictStore (chrome.storage.local) — 영구 사전 CRUD
- siteSettingsStore (chrome.storage.sync) — 사이트별 활성/비활성 (기본: 활성)
- chrome.runtime 신규 메시지: GET_MAPPINGS, GET_DICT, UPSERT_DICT_ENTRY, DELETE_DICT_ENTRY, GET_SITE_SETTINGS, SET_SITE_SETTINGS
- 사이드패널 (Manifest V3 side_panel API) — 매핑 조회, 사전 관리, 사이트 토글
- 옵션 페이지 — 사전 CRUD 테이블, 사이트별 설정
- E2E smoke 3개 (ChatGPT/Gemini/Perplexity) — RUN_REAL_SITE_TESTS 환경변수 게이트

### Changed
- manifest.json: v0.2.0, 4-site content_scripts, host_permissions 4개, sidePanel+activeTab 권한, options_page
- content-main.ts: 4개 어댑터 라우팅, siteSettings 비활성 게이트, dict alias unmask 정규식 확장
- shared/types.ts: ExtendedPiiMatch, SiteKey, AllSiteSettings, MessageType 확장, Mapping.category → AnyCategory
- detector.ts: PIIDetector(dictDetector?) 선택적 인자, Layer 2 체이닝

### Security
- host_permissions 3개 추가 (chatgpt.com, gemini.google.com, perplexity.ai) — 외 도메인 0 유지
- innerHTML/insertAdjacentHTML/outerHTML 사이드패널·옵션 페이지에서도 계속 금지
- dict 데이터 chrome.storage.local 저장 — 외부 전송 없음

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
