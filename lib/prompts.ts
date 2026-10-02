import 'server-only';
import type { P1Input, P1Result, P2Input, P2Result, P3Input, P3Result } from './types';

// 프롬프트 원문은 docs/PROMPTS.md. 여기를 고치면 문서도 같이 고친다.
// 모든 함수는 AI 실패 시 null을 돌려주고, 호출부(app/api/**)가 대체 동작을 맡는다.
/* eslint-disable @typescript-eslint/no-unused-vars */

/** P1 학생 질문: 분류 + 강의 시점 매칭 + 다듬기 (+ PROMPTS.md "검증") */
export async function interpretQuestion(input: P1Input): Promise<P1Result | null> {
  // TODO(T-41, A)
  return null;
}

/** P2 교수 질문 판별·문항 정리 (choice면 마지막 선택지 "모르겠어요" 보정) */
export async function judgeProfQuestion(input: P2Input): Promise<P2Result | null> {
  // TODO(T-42, A)
  return null;
}

/** P3 교수 질문 응답 분석 (분포는 호출 전에 코드로 계산) */
export async function analyzeAnswers(input: P3Input): Promise<P3Result | null> {
  // TODO(T-43, A)
  return null;
}

/** P6 교안 PDF 핵심 용어 추출 */
export async function extractGlossary(text: string): Promise<string[] | null> {
  // TODO(T-44, A)
  return null;
}
