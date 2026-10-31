// اختبارات وحدة لمنطق الالتزام (الدوال الخالصة).

import { describe, it, expect } from 'vitest';
import {
  calcOverall,
  adherenceBand,
  DEFAULT_AXES,
} from '../../src/platform/adherence';

describe('adherence — calcOverall', () => {
  it('النسبة الموزونة: Σ(درجة × وزن) / 100', () => {
    // الوجبات 30 + النصائح 25 + الماء 25 + النشاط 20
    const scores = [100, 80, 60, 50];
    // 100*0.3 + 80*0.25 + 60*0.25 + 50*0.2 = 30 + 20 + 15 + 10 = 75
    expect(calcOverall(scores, DEFAULT_AXES)).toBe(75);
  });

  it('كل الدرجات صفر → صفر', () => {
    expect(calcOverall([0, 0, 0, 0], DEFAULT_AXES)).toBe(0);
  });

  it('كل الدرجات 100 → 100', () => {
    expect(calcOverall([100, 100, 100, 100], DEFAULT_AXES)).toBe(100);
  });

  it('الدرجات خارج النطاق تُقص (clamp)', () => {
    expect(calcOverall([150, -10, 100, 100], DEFAULT_AXES)).toBe(
      calcOverall([100, 0, 100, 100], DEFAULT_AXES),
    );
  });
});

describe('adherence — adherenceBand', () => {
  it('75–100: ممتاز', () => {
    expect(adherenceBand(75)).toBe('excellent');
    expect(adherenceBand(100)).toBe('excellent');
  });

  it('50–75: متوسط', () => {
    expect(adherenceBand(50)).toBe('average');
    expect(adherenceBand(74.9)).toBe('average');
  });

  it('تحت 50: ضعيف', () => {
    expect(adherenceBand(49.9)).toBe('weak');
    expect(adherenceBand(0)).toBe('weak');
  });
});

describe('adherence — DEFAULT_AXES', () => {
  it('4 محاور والمجموع 100', () => {
    expect(DEFAULT_AXES).toHaveLength(4);
    const sum = DEFAULT_AXES.reduce((s, a) => s + a.weight, 0);
    expect(sum).toBe(100);
  });
});
