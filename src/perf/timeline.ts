import type { TimelineMark } from '@/types';

export class Timeline {
  private readonly marks: TimelineMark[] = [];

  mark(label: string): void {
    this.marks.push({ label, t: performance.now() });
  }

  getMarks(): readonly TimelineMark[] {
    return this.marks;
  }

  /** ラベル間の ms。同一ラベルが複数ある場合は隣接ペアを順に返す */
  segmentDurations(): Record<string, number> {
    const out: Record<string, number> = {};
    for (let i = 1; i < this.marks.length; i += 1) {
      const prev = this.marks[i - 1];
      const cur = this.marks[i];
      const key = `${prev.label}→${cur.label}`;
      out[key] = cur.t - prev.t;
    }
    return out;
  }

  spanMs(fromLabel: string, toLabel: string): number | undefined {
    const from = this.marks.find((m) => m.label === fromLabel);
    const to = this.marks.find((m) => m.label === toLabel);
    if (!from || !to) return undefined;
    return to.t - from.t;
  }

  totalMs(fromLabel = 't0_press', toLabel = 't_done'): number | undefined {
    return this.spanMs(fromLabel, toLabel);
  }
}