import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createTaskRepository, TaskStoreError } from '../task-store.js';

function withRepository(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'covey-tasks-'));
  const filePath = path.join(directory, 'tasks.json');
  let tick = 0;
  const repository = createTaskRepository(filePath, {
    createId: () => 'task-1',
    now: () => new Date(Date.UTC(2026, 9, 11, 12, tick++)),
  });
  try {
    return run(repository, filePath);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('persists local tasks and returns incremental changes', () => {
  withRepository((tasks, filePath) => {
    const created = tasks.create({
      title: ' Take recycling out ',
      dueDate: '2026-10-12',
      assigneeIds: ['vince'],
    });
    assert.equal(created.id, 'task-1');
    assert.equal(created.title, 'Take recycling out');
    assert.equal(created.status, 'open');
    assert.equal(created.revision, 1);
    assert.equal(fs.statSync(filePath).mode & 0o777, 0o600);

    const changed = tasks.update(created.id, {
      revision: created.revision,
      title: 'Take recycling and compost out',
      notes: 'Before breakfast',
    });
    assert.equal(changed.revision, 2);
    assert.equal(tasks.list(1).tasks[0].notes, 'Before breakfast');

    const completed = tasks.setCompleted(changed.id, changed.revision, true);
    assert.equal(completed.status, 'completed');
    assert.equal(completed.revision, 3);
    assert.ok(completed.completedAt);

    const reopened = tasks.setCompleted(completed.id, completed.revision, false);
    assert.equal(reopened.status, 'open');
    assert.equal(reopened.completedAt, null);

    const deleted = tasks.delete(reopened.id, reopened.revision);
    assert.deepEqual(tasks.list(reopened.revision), {
      revision: deleted.revision,
      tasks: [],
      deleted: ['task-1'],
    });

    const reloaded = createTaskRepository(filePath);
    assert.equal(reloaded.list().revision, deleted.revision);
    assert.deepEqual(reloaded.list().tasks, []);
  });
});

test('prevents stale task updates from overwriting another device', () => {
  withRepository((tasks) => {
    const task = tasks.create({ title: 'Pack lunches' });
    const changed = tasks.update(task.id, { revision: task.revision, title: 'Pack school lunches' });

    assert.throws(
      () => tasks.update(task.id, { revision: task.revision, title: 'Old title' }),
      (error) => {
        assert.ok(error instanceof TaskStoreError);
        assert.equal(error.status, 409);
        assert.equal(error.current.revision, changed.revision);
        return true;
      },
    );
  });
});

test('validates task dates, times, assignees, and required revisions', () => {
  withRepository((tasks) => {
    assert.throws(() => tasks.create({ title: '' }), /title must be 1-120/);
    assert.throws(
      () => tasks.create({ title: 'Invalid date', dueDate: '2026-02-30' }),
      /valid YYYY-MM-DD/,
    );
    assert.throws(
      () => tasks.create({ title: 'No date', dueTime: '09:00' }),
      /due date before adding a due time/,
    );
    assert.throws(
      () => tasks.create({ title: 'Duplicate', assigneeIds: ['vince', 'vince'] }),
      /each assignee only once/,
    );
    const task = tasks.create({ title: 'Valid task' });
    assert.throws(() => tasks.delete(task.id), /revision is required/);
  });
});
