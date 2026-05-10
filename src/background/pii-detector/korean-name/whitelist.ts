/**
 * Whitelist of strings that MUST NOT be treated as Korean personal names.
 * Includes: historical figures, common compound nouns, food names, place-derived words.
 *
 * Rule: if a candidate string appears in this set, Layer 3 returns no match,
 * regardless of confidence score.
 */
export const NAME_WHITELIST: ReadonlySet<string> = new Set([
  // 역사적 인물 (교과서 등장 인물 — 의뢰인일 가능성 극히 낮음)
  '이순신', '세종대왕', '광개토대왕', '유관순', '안중근', '김구',
  '박정희', '이승만', '전두환', '노태우', '김대중', '노무현',
  '이명박', '박근혜', '문재인', '윤석열',
  '이율곡', '이황', '정약용', '김정일', '김일성', '김정은',

  // 음식 이름 (성씨 + 일반어 조합)
  '김치국', '김치찌개', '박나물', '조기구이', '정어리', '강낭콩',
  '고추장', '된장국', '이면수', '배추김치', '백김치',

  // 지명·기관 유래 일반어
  '남산', '강남구', '서초구', '송파구', '마포구', '종로구',
  '한강변', '한남동', '이태원', '신촌동', '홍대앞',

  // 관용어·복합명사
  '백마고지', '홍길동전', '이도령', '성춘향', '변학도',
  '남자친구', '여자친구', '정직원', '최저임금', '강제퇴직',
  '임시직', '계약직', '파견직', '용역직',

  // 품사·단위 (Layer 1 정규식과 겹칠 수 있는 형태)
  '전화번호', '이메일주소', '사건번호', '주민번호',

  // 기타 흔한 오탐 후보
  '김씨', '이씨', '박씨', '최씨', '정씨',
]);

/** 화이트리스트 접두 패턴: 이 단어들로 시작하면 이름이 아님 */
export const WHITELIST_PREFIXES: readonly string[] = [
  '김치', '박나', '강남', '서울', '부산', '대구', '인천',
  '광주', '대전', '울산', '세종', '경기', '강원', '충북',
  '충남', '전북', '전남', '경북', '경남', '제주',
];
