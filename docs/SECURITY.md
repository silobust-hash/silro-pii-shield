# SECURITY.md — silro-pii-shield v1.0.0

## 위협 모델 (Threat Model)

| 위협 | 대응 |
|------|------|
| 외부 서버로 PII 유출 | `externally_connectable` 미설정 · `connect-src 'self'` CSP · 외부 fetch 0건 코드 검증 |
| Content Script 격리 파괴 | Isolated World (MV3 기본) — 페이지 JS와 메모리 공간 분리 |
| XSS를 통한 PII 추출 | innerHTML/insertAdjacentHTML/outerHTML 코드베이스 전체 금지 (grep 검증) |
| 취약한 라이브러리 | npm audit 주기 실행, GitHub Dependabot 알림 |
| 마스터 비밀번호 유출 | 비밀번호를 절대 저장하지 않음 — salt만 chrome.storage.local에 저장 |
| CryptoKey 직렬화 | `extractable: false` 옵션 → JSON 직렬화 불가 |
| Fail-safe 우회 | 파일 크기 100MB 초과 → 차단, 미지원 MIME → 차단 |
| Scoped source map 오용 | Source map 공개 (MIT 라이선스, 이미 오픈소스) — 난독화 보안 의존 없음 |

---

## 암호화 상세 (Encryption Details)

### 알고리즘

| 항목 | 값 |
|------|----|
| 암호화 알고리즘 | AES-GCM 256-bit |
| 키 파생 | PBKDF2 (SHA-256) |
| PBKDF2 반복 횟수 | 310,000 iterations (OWASP 2023 권장) |
| IV | 12바이트 무작위 (암호화마다 새로 생성) |
| Salt | 16바이트 무작위 (마스터 비밀번호 설정 시 1회 생성, chrome.storage.local 저장) |
| 구현 | Web Crypto API (브라우저 네이티브, 외부 라이브러리 없음) |

### 데이터 흐름

```
[마스터 비밀번호 입력]
        │
        ▼
  PBKDF2(password, salt, 310000, SHA-256)
        │
        ▼
  CryptoKey (extractable: false, 메모리 전용)
        │
        ├─── 암호화 시: AES-GCM.encrypt(plaintext) → EncryptedBlob { ciphertext, iv, salt }
        │                                                    └→ chrome.storage.local
        │
        └─── 복호화 시: AES-GCM.decrypt(EncryptedBlob) → plaintext
```

### 세션 관리

- 탭/브라우저 종료 시 → `sessionKey = null` (CryptoKey 메모리 해제)
- 명시적 "세션 잠금" → `lockSession()` → `sessionKey = null`
- 재오픈 시 → 비밀번호 재입력 필요

---

## 데이터 흐름 다이어그램 (Text-based)

```
사용자 입력 (AI 사이트)
        │
        ▼
[Content Script — Isolated World]
  ├── Upload Interceptor (파일 감지)
  └── hookSubmit (텍스트 가로채기)
        │ chrome.runtime.sendMessage
        ▼
[Service Worker (Background)]
  ├── PIIDetector (Layer 1: regex)
  │     └── 주민번호·전화·이메일·사업자번호·사건번호
  ├── DictionaryDetector (Layer 2: user dict)
  │     └── 사용자 등록 패턴
  ├── MappingManager (가명화 매핑 관리)
  │     └── chrome.storage.session (대화별 매핑)
  └── FileHandler (파일 처리)
        ├── DOCX/XLSX/PDF/PPTX: mammoth/xlsx/pdfjs
        └── Image/OCR: Tesseract.js Worker
        │
        ▼
[chrome.storage.local] ←─── 암호화 래퍼 (선택)
  ├── userDictionary
  ├── profiles
  └── __crypto_salt (암호화 활성화 시)
        │
        ▼
[Content Script]
  └── showPreflight Modal (사용자 확인 후 전송)
```

---

## CSP 설정 (Content Security Policy)

**목표 CSP:**
```
"extension_pages": "script-src 'self'; object-src 'self'; connect-src 'self'"
```

- `unsafe-inline` 없음
- `unsafe-eval` 없음
- 외부 CDN URL 없음 (Tesseract.js traineddata는 Worker 내에서 fetch — SW 격리)

---

## Source Map 공개 정책

- v1.0.0부터 `vite.config.ts`에 `build.sourcemap: true` 설정
- Source map은 dist/assets/*.map에 포함, 배포 ZIP에 포함
- 이미 MIT 오픈소스이므로 source map 공개는 보안 위협 없음
- 디버깅 및 커뮤니티 감사에 도움

---

## 취약점 신고 (Vulnerability Disclosure)

보안 취약점 발견 시:

1. **이메일**: silobust@naver.com (제목: `[SECURITY] silro-pii-shield`)
2. **GitHub Issues**: Public issues로 제보 가능 (심각한 취약점은 이메일 우선)
3. 응답 시간: 72시간 이내 확인, 14일 이내 조치

---

## 감사 이력 (Audit Log)

| 날짜 | 버전 | 감사자 | 항목 |
|------|------|-------|------|
| 2026-05-10 | v1.0.0 | 박실로 (개발자) | innerHTML 0건 확인, npm audit 0 취약점, CSP 검증, 외부 요청 0건 |
