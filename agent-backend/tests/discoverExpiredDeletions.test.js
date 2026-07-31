import { jest } from '@jest/globals';
import Project from '../src/modules/projects/project.model.js';

const mockEnqueue = jest.fn();
jest.unstable_mockModule('../src/modules/jobs/cleanupDeletedProject.job.js', () => ({
  enqueueProjectCleanup: mockEnqueue,
}));

const { default: discoverExpiredDeletions } =
  await import('../src/modules/cron/discoverExpiredDeletions.js');

/**
 * Developer Platform (blueprint Phase 10, PR-53, AD-08 §28). This is the
 * discovery *trigger* only — it must never perform cleanup itself, only
 * find eligible Projects and hand them to Agenda.
 */
describe('discoverExpiredDeletions cron trigger (blueprint Phase 10, PR-53)', () => {
  let mockSelect;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSelect = jest.fn();
    jest.spyOn(Project, 'find').mockReturnValue({ select: mockSelect });
  });

  test('enqueues cleanup for every DELETING Project past its grace period', async () => {
    mockSelect.mockResolvedValue([{ _id: 'p1' }, { _id: 'p2' }]);

    const result = await discoverExpiredDeletions();

    expect(Project.find).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'DELETING',
        deletionRequestedAt: { $lt: expect.any(Date) },
      })
    );
    expect(mockEnqueue).toHaveBeenCalledTimes(2);
    expect(mockEnqueue).toHaveBeenCalledWith('p1');
    expect(mockEnqueue).toHaveBeenCalledWith('p2');
    expect(result).toEqual({ enqueuedCount: 2 });
  });

  test('enqueues nothing and returns a zero count when no Projects are past their grace period', async () => {
    mockSelect.mockResolvedValue([]);

    const result = await discoverExpiredDeletions();

    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(result).toEqual({ enqueuedCount: 0 });
  });

  test('the cutoff is computed from the configured grace period, not a hardcoded value', async () => {
    mockSelect.mockResolvedValue([]);
    const before = Date.now();

    await discoverExpiredDeletions();

    const [[filter]] = Project.find.mock.calls;
    const cutoff = filter.deletionRequestedAt.$lt.getTime();
    // Default grace period is 7 days — the cutoff must be strictly in the
    // past, roughly 7 days before "now" at call time.
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(cutoff).toBeLessThan(before);
    expect(before - cutoff).toBeGreaterThanOrEqual(sevenDaysMs - 1000);
    expect(before - cutoff).toBeLessThan(sevenDaysMs + 5000);
  });
});
