import { DONT_KNOW } from './config';
import type { SpeechAct } from './types';

// 교수 발화 의도(Speech Act) 이름과 규칙. 서버(P2)와 교수 화면이 같이 쓰므로 server-only가 아니다

export const SPEECH_ACT_LABEL: Record<SpeechAct, string> = {
  explanation: '설명',
  response_request: '학생 응답 요청',
  understanding_check: '이해도 확인',
  rhetorical: '수사적 질문',
  class_management: '수업 운영',
};

export const SPEECH_ACTS = Object.keys(SPEECH_ACT_LABEL) as SpeechAct[];

/** 학생에게 보낼 발화 의도 */
export const ASKS_STUDENTS: SpeechAct[] = ['response_request', 'understanding_check'];

/** 이해도 확인 질문의 선택지 (마지막은 "모르겠어요") */
export const UNDERSTANDING_OPTIONS = ['이해했어요', '조금 헷갈려요', DONT_KNOW];
