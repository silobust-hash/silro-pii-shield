# CONTRIBUTING.md — silro-pii-shield

기여해 주셔서 감사합니다! 이 문서는 개발 환경 설정부터 PR 제출까지 안내합니다.

---

## 개발 환경 설정

```bash
# 1. 레포지토리 클론
git clone https://github.com/silobust-hash/silro-pii-shield.git
cd silro-pii-shield

# 2. 의존성 설치
npm install

# 3. 개발 빌드 (watch mode)
npm run dev

# 4. Chrome에 확장 로드
#    Chrome → chrome://extensions → 개발자 모드 ON
#    → "압축 해제된 확장 프로그램 로드" → dist/ 폴더 선택
```

### 요구 사항

- Node.js 20+ (npm 10+)
- Chrome 120+ (MV3 지원)
- TypeScript 5.5+ (자동 설치)

---

## 코드 스타일

### 필수 규칙

1. **TypeScript strict 모드** (`tsconfig.json`의 `"strict": true` 유지)
2. **`innerHTML` 사용 금지** — `insertAdjacentHTML`, `outerHTML`도 금지
   - 대신: `document.createElement()` + `textContent` 사용
3. **외부 `fetch()` 금지** — 모든 데이터는 브라우저 내 처리
4. **정규식 패턴 매칭**: `String.prototype.matchAll()` 사용 (전역 플래그 정규식)
5. **`any` 타입 최소화** — `unknown` 후 타입 가드 사용

### 검증

```bash
# 린트 (TypeScript 타입 체크)
npm run lint

# 단위 테스트
npm test

# 빌드
npm run build
```

---

## 테스트

```bash
# 단위 테스트 (vitest)
npm test

# 단위 테스트 watch 모드
npm run test:watch

# E2E 테스트 (playwright) — 실제 브라우저 필요
npm run test:e2e
```

### 테스트 작성 규칙

- 새 모듈은 반드시 단위 테스트 추가 (`tests/unit/`)
- chrome.* API는 `vi.stubGlobal('chrome', ...)` 목 사용
- E2E는 `RUN_REAL_SITE_TESTS=1` 환경변수 필요 시 skip 처리

---

## PR 체크리스트

PR 제출 전 아래 항목을 모두 확인하세요:

- [ ] `npm test` 통과 (기존 테스트 + 신규 테스트)
- [ ] `npm run lint` 통과 (TypeScript 오류 0건)
- [ ] `npm run build` 성공
- [ ] `grep -r "innerHTML" src/` 결과 0건
- [ ] 새 기능의 경우 단위 테스트 추가
- [ ] CHANGELOG.md에 변경 사항 기록 (미완료면 PR 설명에 기재)

---

## 커밋 메시지 형식

```
<type>(<scope>): <subject>

[body — 선택]
[footer — 선택]
```

### Type

| type | 설명 |
|------|------|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서만 변경 |
| `refactor` | 기능 변경 없는 코드 재구성 |
| `test` | 테스트 추가/수정 |
| `chore` | 빌드 설정, 의존성 업데이트 등 |
| `security` | 보안 관련 수정 |

### Scope 예시

`crypto`, `storage`, `detector`, `content`, `service-worker`, `ui`, `manifest`, `docs`

### 예시

```
feat(crypto): add AES-GCM encrypt/decrypt with PBKDF2 key derivation
fix(detector): prevent false positive on 10-digit numbers without hyphens
docs(security): add threat model table and audit log
```

---

## 보안 이슈 신고

보안 취약점은 **공개 Issue가 아닌** 이메일로 신고해 주세요:

**silobust@naver.com** (제목: `[SECURITY] silro-pii-shield`)

일반 버그나 기능 요청은 [GitHub Issues](https://github.com/silobust-hash/silro-pii-shield/issues)를 이용해 주세요.

---

## 라이선스

기여하신 코드는 MIT License로 공개됩니다.
