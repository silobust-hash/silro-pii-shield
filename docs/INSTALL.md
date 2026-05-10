# INSTALL.md — silro-pii-shield 설치 가이드

---

## 방법 1: Chrome Web Store 설치 (권장)

> Chrome Web Store 등록 후 이용 가능. 검토 기간: 평균 3~7일.

1. Chrome Web Store 페이지 방문  
   → [silro PII Shield](https://chromewebstore.google.com/detail/silro-pii-shield) *(등록 후 URL 업데이트 예정)*
2. **"Chrome에 추가"** 클릭
3. "확장 프로그램 추가" 확인 팝업에서 확인
4. 확장 프로그램 아이콘이 툴바에 표시됨 → 설치 완료

### 지원 브라우저

| 브라우저 | 버전 | 지원 여부 |
|---------|------|---------|
| Chrome | 120+ | ✅ 완전 지원 |
| Microsoft Edge | 120+ | ✅ 지원 (Chromium 기반) |
| Naver Whale | 최신 | ✅ 지원 (Chromium 기반) |
| Brave | 최신 | ✅ 지원 (Chromium 기반) |
| Firefox | — | ❌ 미지원 (MV3 구현 차이) |
| Safari | — | ❌ 미지원 |

---

## 방법 2: 개발자 직접 설치 (압축 해제)

소스코드에서 직접 빌드하여 설치합니다.

### 사전 요구 사항

- Node.js 20+ ([nodejs.org](https://nodejs.org))
- Git

### 설치 단계

```bash
# 1. 소스코드 클론
git clone https://github.com/silobust-hash/silro-pii-shield.git
cd silro-pii-shield

# 2. 의존성 설치
npm install

# 3. 프로덕션 빌드
npm run build

# 4. dist/ 폴더가 생성됨 확인
ls dist/
```

### Chrome에 로드

1. Chrome 주소창에 `chrome://extensions` 입력
2. 우측 상단 **"개발자 모드"** 토글 활성화
3. **"압축 해제된 확장 프로그램 로드"** 클릭
4. `dist/` 폴더 선택 → "폴더 선택"
5. silro-pii-shield 카드가 확장 목록에 표시됨

### 빌드 검증 (선택)

```bash
# SHA-256 해시 확인 (GitHub Releases의 checksums.txt와 비교)
shasum -a 256 silro-pii-shield-v1.0.0.zip
```

---

## 초기 설정

설치 후 권장 설정 순서:

### 1. 지원 사이트 확인 (기본: 모두 활성)

1. 확장 아이콘 우클릭 → "옵션" 또는 확장 관리 페이지 → "확장 프로그램 옵션"
2. "사이트별 활성 설정" 섹션에서 각 사이트 ON/OFF 설정

### 2. 사용자 사전 등록

1. 옵션 페이지 → "사용자 사전 (Layer 2 PII 감지)"
2. 카테고리 선택 (사람/회사/병원/부서/기타)
3. 패턴 입력 (쉼표 구분, 예: `홍길동, 홍 대표`)
4. 가명 입력 (예: `A씨`)
5. "추가" 클릭

### 3. 마스터 비밀번호 설정 (선택 사항)

1. 옵션 페이지 → "데이터 암호화 (선택 사항)"
2. 비밀번호 입력 (8자 이상) + 확인
3. "암호화 활성화" 클릭

> 비밀번호는 브라우저 밖으로 전송되지 않습니다. 분실 시 복구 불가.

### 4. 단축키 확인

| 단축키 | 기능 |
|--------|------|
| Cmd/Ctrl+Shift+M | 마스킹 미리보기 (전송 전 확인) |
| Cmd/Ctrl+Shift+L | 사이드패널 열기/닫기 |
| Cmd/Ctrl+Shift+P | 의뢰인 프로필 전환 |

단축키는 `chrome://extensions/shortcuts`에서 변경 가능합니다.

---

## 업데이트

### Chrome Web Store 설치 (방법 1)

Chrome이 자동으로 업데이트합니다. 수동 업데이트:
- `chrome://extensions` → "확장 프로그램 업데이트" 버튼

### 직접 설치 (방법 2)

```bash
cd silro-pii-shield
git pull origin main
npm install
npm run build
```

Chrome 확장 관리 페이지에서 "새로고침" 클릭.

---

## 개인정보처리방침 공개 URL 안내

Chrome Web Store 제출 전, 개인정보처리방침(`docs/PRIVACY.md`)을 공개 URL에 호스팅해야 합니다.

**권장 방법: GitHub Pages**

1. GitHub 레포지토리 → Settings → Pages
2. Branch: `main`, Folder: `/docs`
3. 공개 URL: `https://silobust-hash.github.io/silro-pii-shield/PRIVACY.html`

`PRIVACY.md`를 `PRIVACY.html`로 변환하거나, GitHub Pages의 Jekyll이 자동 변환합니다.

---

## 문의 및 지원

- **버그 신고**: [GitHub Issues](https://github.com/silobust-hash/silro-pii-shield/issues)
- **보안 취약점**: silobust@naver.com (제목: `[SECURITY]`)
- **일반 문의**: silobust@naver.com
