/**
 * 교수 질문 감지 요청을 언제·무엇으로 보낼지 정하는 순수 로직 (화면 훅과 평가 스크립트가 같이 쓴다).
 *
 * - 빠른 경로: 질문 어미로 끝나는 문장이 오면 그 문장만 바로 후보로 잡는다
 * - AI 경로: 그 밖의 문장도 scanLines개가 모이거나, 교수가 silenceMs 동안 말을 멈추면 묶어서 AI(P2)에게 보낸다.
 *   "풀어 보세요", "손 들어 보세요"처럼 어미 규칙에 안 걸리는 요청형 질문을 AI가 판단하게 하기 위함
 * - 후보를 잡은 뒤 waitMs 동안의 이후 발화(after)를 모아 함께 보낸다 (교수가 스스로 답하면 수사적 질문)
 * - 요청은 한 번에 하나. 결과(result)가 오기 전까지 들어온 문장은 보류했다가
 *   질문이 감지됐으면 버리고(같은 질문의 연장, 중복 알림 방지), 아니면 바로 다음 판단으로 보낸다
 */

/** 1차 신호: 질문 어미. 여기에 안 걸려도 AI 경로로 판단한다 */
export const QUESTION_END = /(까요|나요|습니까|ㅂ니까|인가요|일까|을까|ㄹ까|뭘까|뭐죠|뭐예요|어때요|어떨까|있죠|맞죠|알겠죠|\?|？)\s*[?？]?\s*$/;

export interface DetectRequest {
  spoken: string;
  after: string;
}

export interface DetectPlannerOptions {
  /** 이만큼 문장이 모이면 AI에게 보낸다. Infinity면 AI 경로를 끈다 (어미 규칙만) */
  scanLines: number;
  /** 후보 뒤 이후 발화를 모으는 시간 */
  waitMs: number;
  /** 이만큼 말이 없으면 모인 문장을 보낸다 */
  silenceMs: number;
}

export function createDetectPlanner({ scanLines, waitMs, silenceMs }: DetectPlannerOptions) {
  const aiPath = Number.isFinite(scanLines);
  let unscanned: string[] = []; // 아직 판단에 보내지 않은 문장
  let idleDue: number | null = null;
  let buffer: { spoken: string; after: string[]; due: number } | null = null; // 이후 발화를 모으는 중
  let awaiting = false; // 보낸 요청의 결과를 기다리는 중
  let held: string[] = []; // 이후 발화 수집·결과 대기 중에 들어온 문장

  const startBuffer = (spoken: string, now: number) => {
    buffer = { spoken, after: [], due: now + waitMs };
    idleDue = null;
  };

  const take = (text: string, now: number) => {
    if (QUESTION_END.test(text)) {
      // 질문 문장 하나만 보낸다 (앞 설명까지 묶으면 수사적 질문 판단이 흐려짐). 앞 문장들은 다음 묶음에서 본다
      startBuffer(text, now);
      return;
    }
    if (!aiPath) return;
    unscanned.push(text);
    if (unscanned.length >= scanLines) {
      startBuffer(unscanned.join(' '), now);
      unscanned = [];
    } else idleDue = now + silenceMs;
  };

  return {
    /** 확정 문장 하나가 들어옴 */
    push(text: string, now: number) {
      if (buffer) {
        buffer.after.push(text);
        held.push(text);
        return;
      }
      if (awaiting) {
        held.push(text);
        return;
      }
      take(text, now);
    },

    /** 시간이 흐름. 지금 보낼 감지 요청을 돌려준다 (결과는 result로 알려 줘야 다음 요청이 나간다) */
    tick(now: number): DetectRequest[] {
      if (awaiting) return [];
      if (buffer && now >= buffer.due) {
        const req = { spoken: buffer.spoken, after: buffer.after.join(' ') };
        buffer = null;
        awaiting = true;
        return [req];
      }
      // 말이 silenceMs 동안 멈춤 → 모인 문장을 바로 보낸다 (요청 뒤에는 보통 침묵이 온다)
      if (!buffer && idleDue !== null && now >= idleDue && unscanned.length) {
        const req = { spoken: unscanned.join(' '), after: '' };
        unscanned = [];
        idleDue = null;
        awaiting = true;
        return [req];
      }
      return [];
    },

    /** 직전 요청의 결과. 감지됐으면 보류 문장은 같은 질문의 연장이라 버리고, 아니면 바로 다시 판단한다 */
    result(detected: boolean, now: number) {
      awaiting = false;
      const pending = held;
      held = [];
      if (detected) {
        unscanned = [];
        idleDue = null;
        return;
      }
      if (!aiPath) {
        // 어미 규칙만 쓸 때는 보류 중 들어온 질문 어미 문장만 다시 본다
        const q = pending.find((t) => QUESTION_END.test(t));
        if (q) startBuffer(q, now);
        return;
      }
      // 이후 발화로 들어온 문장들은 기다리지 않고 묶어서 바로 판단 (그 안의 요청이 늦게 감지되지 않게)
      if (pending.length) {
        startBuffer([...unscanned, ...pending].join(' '), now);
        unscanned = [];
      }
    },
  };
}
