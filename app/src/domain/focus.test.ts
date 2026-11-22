import { describe, expect, it } from 'vitest';
import { focusEyebrow, focusTask, stepProgress } from './focus';
import type { Assignment, Task } from './types';

const a = (person: Assignment['person'], status: Assignment['status'] = 'todo', steps: Assignment['steps'] = []): Assignment => ({ person, status, steps });
const task = (id: string, over: Partial<Task> = {}, assignments: Assignment[] = [a('nikita')]): Task => ({ id, title: id, urgent: false, updatedBy: 'claude', assignments, ...over });

describe('focusTask', () => {
  it('picks the nearest due date, overdue first', () => {
    const list = [task('later', { due: '2026-12-17' }), task('overdue', { due: '2026-11-20' }), task('soon', { due: '2026-11-27', urgent: true })];
    expect(focusTask(list, 'nikita')?.id).toBe('overdue');
  });

  it('breaks a tie on the date with urgent first', () => {
    const list = [task('b', { due: '2026-11-27' }), task('a', { due: '2026-11-27', urgent: true })];
    expect(focusTask(list, 'nikita')?.id).toBe('a');
  });

  it('skips tasks the person has done', () => {
    const list = [task('done', { due: '2026-11-22' }, [a('nikita', 'done')]), task('open', { due: '2026-11-30' })];
    expect(focusTask(list, 'nikita')?.id).toBe('open');
  });

  it('falls back to the first urgent undated task', () => {
    const list = [task('plain'), task('Zeta', { urgent: true }), task('Alpha', { urgent: true })];
    expect(focusTask(list, 'nikita')?.id).toBe('Alpha');
  });

  it('is empty when nothing is dated or urgent', () => {
    expect(focusTask([task('plain')], 'nikita')).toBeUndefined();
    expect(focusTask([], 'nikita')).toBeUndefined();
  });

  it('in the shared view, a task stays open until both are done', () => {
    const half = task('half', { due: '2026-11-25' }, [a('nikita', 'done'), a('daryna')]);
    const both = task('both', { due: '2026-11-23' }, [a('nikita', 'done'), a('daryna', 'done')]);
    expect(focusTask([both, half], null)?.id).toBe('half');
  });
});

describe('focusEyebrow', () => {
  it('reads the weekday, date and days left', () => {
    expect(focusEyebrow(task('t', { due: '2026-11-27' }), '2026-11-22')).toEqual({ text: 'Due Fri 27 Nov · 5 days left', alert: false });
    expect(focusEyebrow(task('t', { due: '2026-11-23' }), '2026-11-22')).toEqual({ text: 'Due Mon 23 Nov · 1 day left', alert: false });
  });

  it('alerts when due today or overdue', () => {
    expect(focusEyebrow(task('t', { due: '2026-11-22' }), '2026-11-22')).toEqual({ text: 'Due Sun 22 Nov · today', alert: true });
    expect(focusEyebrow(task('t', { due: '2026-11-20' }), '2026-11-22')).toEqual({ text: 'Due Fri 20 Nov · 2 days overdue', alert: true });
  });

  it('says Urgent for an undated task', () => {
    expect(focusEyebrow(task('t', { urgent: true }), '2026-11-22')).toEqual({ text: 'Urgent · no due date', alert: true });
  });
});

describe('stepProgress', () => {
  it('counts the person’s own steps only', () => {
    const t = task('t', {}, [
      a('nikita', 'in_progress', [{ id: '1', title: 'x', done: true }, { id: '2', title: 'y', done: false }]),
      a('daryna', 'todo', [{ id: '1', title: 'x', done: true }]),
    ]);
    expect(stepProgress(t, 'nikita')).toEqual({ done: 1, total: 2 });
    expect(stepProgress(t, 'daryna')).toEqual({ done: 1, total: 1 });
    expect(stepProgress(task('none'), 'nikita')).toEqual({ done: 0, total: 0 });
  });
});
