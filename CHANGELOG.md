# Changelog

## [0.6.0] - 2026-05-10

### Added
- 이미지 OCR 지원 (JPG/PNG/WEBP): Tesseract.js v5.1.1 + 한국어 학습 데이터(kor.traineddata)
- 스캔 PDF OCR 지원: pdf.js 텍스트 추출량 < 50자이면 ScannedPdfError throw → OCR 처리 분기
- OCR Web Worker (`src/workers/ocr-worker.ts`): Service Worker 블로킹 0, lazy-load
- OCR 신뢰도 임계값 게이트: 신뢰도 < 0.6 → Preflight Modal 경고 + 사용자 confirm 필수
- Format Detector: image/jpeg, image/png, image/webp MIME + magic bytes 판별
- `FileProcessResult`: `requiresConfirm?`, `ocrConfidence?` 필드 추가
- `OcrRequest` / `OcrResponse` 메시지 프로토콜 타입 (`src/shared/types.ts`)
- `ScannedPdfError`: 스캔 PDF 감지 에러 (pageCount + requiresUserConfirm)

### Security
- 외부 OCR API 호출 0 — 모든 OCR 처리 브라우저 내 Tesseract.js로 수행
- kor.traineddata: Method B (Tesseract.js CDN lazy-fetch, 첫 OCR 시 다운로드 + IndexedDB 캐시)
- innerHTML 사용 0건 유지 — OCR 경고 배너도 DOM API만 사용
- ArrayBuffer transfer (zero-copy): 이미지 데이터 복사 없이 Worker 전달

### Performance
- OCR Worker lazy-load: 텍스트 전용 파일 처리 시 Tesseract.js 초기화 비용 0
- Tesseract.js 싱글톤 Worker: 여러 이미지 업로드 시 재초기화 없음

### Known Limitations
- OCR 정확도는 이미지 품질에 의존 (저해상도 스캔 시 신뢰도 낮음)
- 스캔 PDF: Canvas API는 MV3 Service Worker에서 불가 — Offscreen Document 통합 예정 (v0.7)
  현재: 스캔 PDF 감지 + requiresConfirm=true 안내, 텍스트 PDF 변환 권고
- 스캔 PDF 20페이지 초과 시 requiresUserConfirm=true (브라우저 메모리 보호)
- 이미지/스캔PDF는 원본 포맷 재생성 불가 (.txt 출력만)
- kor.traineddata 첫 OCR 시 네트워크 필요 (~10MB, 이후 캐시)

## [0.5.0] - 2026-05-10

### Added
- PPTX 파일 첨부 가명화 지원 (JSZip + 정규식 XML 파싱, 슬라이드 + 노트 포함)
- PPTX preserve-mode: 원본 ZIP 구조 유지 + 가명화 텍스트로 재생성 (`<a:t>` 교체)
- HWP/HWPX 형식 감지 (OLE2 magic bytes / ZIP+mimetype) — format-detector 기존 구현
- HWP/HWPX 미지원 명시 폴백 (LibreOffice 변환 안내, 외부 API 호출 0)
- `HwpUnsupportedError`: name + converterUrl 속성으로 UI에서 링크 생성 가능
- Format Detector: PPTX/HWP/HWPX/이미지 MIME + magic bytes 판별 (v0.4에서 이미 구현)
- HWP 스파이크 보고서: `docs/hwp-spike-report.md` (hwp.js Node.js 의존 → 브라우저 불가)

### Security
- 외부 서버 변환 API 호출 0 — HWP 미지원 시 사용자에게 수동 변환 안내만 제공
- innerHTML 사용 0건 유지
- PPTX 텍스트 추출: DOMParser 대신 정규식 matchAll로 `<a:t>` 추출 (네임스페이스 독립)

### Known Limitations
- HWP preserve-mode 미지원 (원본 포맷 유지 재생성 불가, .txt도 현재 불가 — HwpUnsupportedError)
- 이미지 OCR은 v0.6
- hwp.js v0.0.3: Node.js fs 모듈 의존으로 브라우저/Service Worker 환경 불가

## [0.4.0] - 2026-05-10

### Added
- 파일 첨부 자동 가로채기 (DOCX/XLSX/PDF 텍스트형)
- FileHandler 인터페이스 + DocxHandler / XlsxHandler / PdfHandler
- FormatDetector: MIME + magic bytes 기반 포맷 감지
- FileDispatcher: 파일 처리 파이프라인 통합 라우팅
- Upload Interceptor: fetch + XMLHttpRequest monkey-patch
- 사이트별 파일 업로드 endpoint 매처 (4개 사이트)
- Preflight Modal 확장: 파일 프리뷰 + PII 목록
- Options Page: 재생성 모드 설정 (txt / preserve)
- Fail-Safe: 100MB 초과 차단, 미지원 형식 차단, 파싱 실패 차단
- 테스트 픽스처 헬퍼 (런타임 생성, 바이너리 git 커밋 없음)

### Dependencies Added
- `mammoth`: DOCX 텍스트 추출
- `docx`: DOCX 재생성 (원본 포맷 유지)
- `xlsx` (SheetJS): XLSX 추출·셀 레벨 재생성
- `pdfjs-dist`: PDF 텍스트 추출

### Security
- 모든 파일 처리 브라우저 내 완결 (외부 서버 송신 0)
- DOCX 재생성: ZIP 직접 조작 방식 (서식·이미지·표 보존)
- PDF: txt 변환만 지원 (원본 포맷 재생성 불가)
- innerHTML/insertAdjacentHTML/outerHTML 사용 0건 (텍스트 PII 모달과 동일)

### Known Limitations
- Gemini GCS signed URL 패턴은 DevTools 검증 필요 (v0.4 spike 항목)
- PPTX/HWP 지원 없음 — v0.5 예정
- OCR (이미지→텍스트 PII 감지) 없음 — v0.6 예정

## [0.3.0] - 2026-05-10

### Added
- **Layer 3: 한글 이름 휴리스틱** — 성씨 풀 200개 + 컨텍스트 boost + 화이트리스트
  - confidence ≥ 0.7 시 Confirm 다이얼로그 (DOM API only, XSS-safe)
  - 화이트리스트: 역사적 인물·음식명·지명 파생어 자동 제외
  - Layer 1/2 매치 영역과 겹치면 Layer 3 자동 skip
- **의뢰인 프로필 영구 저장** — chrome.storage.local CRUD
  - `ClientProfile { id, name, mappings, notes, createdAt, updatedAt }`
  - 사이드패널 "현재 매핑을 프로필로 저장" 버튼
  - 프로필 셀렉터 드롭다운 (최신순 정렬)
- **Hybrid 모드 토글** — 사이트별 Round-trip ↔ Hybrid (응답 자동 복원 ON/OFF)
  - chrome.storage.sync에 사이트별 설정 저장
  - Hybrid 모드: content script가 observeResponses 등록 안 함 (사이드패널 수동 복원)
- `MASK_NAMES` 메시지 타입 (Layer 3 confirm 후 추가 마스킹)
- `korean_name` PiiCategory (별칭: A씨, B씨, ... Z씨, AA씨...)

### Changed
- `MaskResult.pendingNames` 필드 추가 (Layer 3 pending matches)
- `PIIDetector.detect()` 반환 타입이 `{ confirmed, pending }` 구조로 변경
- `MappingManager`: `korean_name` 별칭 생성 로직 추가, `maskNames()` 메서드 추가
- 사이드패널 UI: 모드 토글 + 프로필 셀렉터 섹션 추가

### Security
- Confirm 다이얼로그: innerHTML/outerHTML 사용 0건 (textContent only)
- 프로필 저장: chrome.storage.local (외부 전송 0, PII 로컬 보관)
- Layer 3 화이트리스트로 공인 인물명 오탐 방지

### Known Limitations
- 프로필 암호화(AES-GCM) 미구현 — v1.0 예정
- 사이드패널 Hybrid 모드 수동 복원 UI 미구현 — v0.3.1 예정
- 파일 첨부 가로채기 없음 — v0.4 예정

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
