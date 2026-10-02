import { describe, it, expect } from 'vitest';
import { createDetectPlanner } from './detectPlanner';

const opts = { scanLines: 3, waitMs: 5000, silenceMs: 10000 };

describe('detectPlanner', () => {
  it('질문 어미 문장은 그 문장만, 5초 동안의 이후 발화와 함께 보낸다', () => {
    const p = createDetectPlanner(opts);
    p.push('특성방정식을 풀면 람다가 2와 5가 나옵니다', 0);
    p.push('이 행렬은 고윳값이 몇 개일까요', 1000);
    p.push('옆 사람이랑 생각해 보세요', 3000);
    expect(p.tick(5900)).toEqual([]);
    expect(p.tick(6000)).toEqual([{ spoken: '이 행렬은 고윳값이 몇 개일까요', after: '옆 사람이랑 생각해 보세요' }]);
  });

  it('어미가 없어도 3문장이 모이면 묶어서 보낸다 (AI 경로)', () => {
    const p = createDetectPlanner(opts);
    ['가', '나', '30초 동안 계산해 보세요'].forEach((t, i) => p.push(t, i * 1000));
    expect(p.tick(7000)).toEqual([{ spoken: '가 나 30초 동안 계산해 보세요', after: '' }]);
  });

  it('말이 10초 멈추면 모인 문장을 바로 보낸다 (요청 뒤 침묵)', () => {
    const p = createDetectPlanner(opts);
    p.push('손 들어 보세요', 0);
    expect(p.tick(9500)).toEqual([]);
    expect(p.tick(10000)).toEqual([{ spoken: '손 들어 보세요', after: '' }]);
  });

  it('결과를 받기 전에는 다음 요청을 보내지 않는다', () => {
    const p = createDetectPlanner(opts);
    p.push('고윳값이 몇 개일까요', 0);
    expect(p.tick(5000)).toHaveLength(1);
    p.push('가', 6000);
    p.push('나', 6500);
    p.push('다', 7000);
    expect(p.tick(30000)).toEqual([]);
  });

  it('감지됐으면 그사이 문장은 같은 질문의 연장이라 버린다 (중복 알림 방지)', () => {
    const p = createDetectPlanner(opts);
    p.push('모든 행렬이 대각화가 될까요', 0);
    p.push('누가 한번 대답해 볼까요', 3000);
    expect(p.tick(5000)).toEqual([{ spoken: '모든 행렬이 대각화가 될까요', after: '누가 한번 대답해 볼까요' }]);
    p.result(true, 6000);
    expect(p.tick(30000)).toEqual([]);
  });

  it('감지 안 됐으면 그사이 들어온 문장(요청 포함)을 바로 다시 판단', () => {
    const p = createDetectPlanner(opts);
    ['가', '나', '다'].forEach((t, i) => p.push(t, i * 1000));
    p.push('이해한 사람 손 들어 보세요', 4000);
    expect(p.tick(7000)).toEqual([{ spoken: '가 나 다', after: '이해한 사람 손 들어 보세요' }]);
    p.result(false, 8000);
    p.push('좋아요', 9000);
    expect(p.tick(13000)).toEqual([{ spoken: '이해한 사람 손 들어 보세요', after: '좋아요' }]);
  });

  it('scanLines=Infinity면 어미 규칙만 (이전 방식)', () => {
    const p = createDetectPlanner({ ...opts, scanLines: Infinity });
    ['가', '나', '손 들어 보세요'].forEach((t, i) => p.push(t, i * 1000));
    expect(p.tick(60000)).toEqual([]);
  });
});
