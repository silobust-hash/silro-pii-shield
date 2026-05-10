import type { UserDictEntry } from '@/shared/types';

export const HONG_ENTRY: UserDictEntry = {
  id: 'entry-1',
  category: 'person',
  patterns: ['홍길동', '홍 대표', '홍대표'],
  alias: 'A씨',
  caseInsensitive: false,
  createdAt: 1000000,
};

export const COMPANY_ENTRY: UserDictEntry = {
  id: 'entry-2',
  category: 'company',
  patterns: ['한동노무법인', '한동'],
  alias: '회사1',
  caseInsensitive: false,
  createdAt: 1000001,
};

export const HOSPITAL_ENTRY: UserDictEntry = {
  id: 'entry-3',
  category: 'hospital',
  patterns: ['서울대병원', '서울대학교병원'],
  alias: '병원1',
  caseInsensitive: true,
  createdAt: 1000002,
};
