import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const STORE_VERSION = 1;
const TASK_STATUSES = new Set(['open', 'completed']);

export class TaskStoreError extends Error {
  constructor(message, status = 400, current = null) {
    super(message);
    this.name = 'TaskStoreError';
    this.status = status;
    this.current = current;
  }
}

const validDate = (value) => {
  if (value === null) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const validTime = (value) => value === null || (
  typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
);

const normalizeAssignees = (value) => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100 || value.some((id) => typeof id !== 'string' || !id.trim())) {
    throw new TaskStoreError('Task assignees must be a list of person IDs.');
  }
  const ids = value.map((id) => id.trim());
  if (new Set(ids).size !== ids.length) throw new TaskStoreError('Choose each assignee only once.');
  return ids;
};

const normalizeTaskInput = (input = {}) => {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  const dueDate = input.dueDate == null || input.dueDate === '' ? null : input.dueDate;
  const dueTime = input.dueTime == null || input.dueTime === '' ? null : input.dueTime;
  const listId = typeof input.listId === 'string' && input.listId.trim()
    ? input.listId.trim()
    : 'household';
  if (!title || title.length > 120) throw new TaskStoreError('Task title must be 1-120 characters.');
  if (notes.length > 1000) throw new TaskStoreError('Task notes must be 1000 characters or fewer.');
  if (!validDate(dueDate)) throw new TaskStoreError('Task due date must be a valid YYYY-MM-DD date.');
  if (!validTime(dueTime)) throw new TaskStoreError('Task due time must be a valid 24-hour time.');
  if (dueTime && !dueDate) throw new TaskStoreError('Choose a due date before adding a due time.');
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(listId)) throw new TaskStoreError('Task list ID is invalid.');
  return {
    title,
    notes,
    dueDate,
    dueTime,
    assigneeIds: normalizeAssignees(input.assigneeIds),
    listId,
  };
};

const normalizeStoredTask = (task) => {
  if (!task || typeof task !== 'object' || typeof task.id !== 'string') {
    throw new Error('Task store contains an invalid task.');
  }
  const normalized = normalizeTaskInput(task);
  if (!TASK_STATUSES.has(task.status)) throw new Error(`Task ${task.id} has an invalid status.`);
  if (!Number.isInteger(task.revision) || task.revision < 1) throw new Error(`Task ${task.id} has an invalid revision.`);
  return {
    id: task.id,
    ...normalized,
    status: task.status,
    position: Number.isFinite(task.position) ? task.position : 0,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.status === 'completed' ? task.completedAt : null,
    revision: task.revision,
  };
};

function readStore(filePath) {
  if (!fs.existsSync(filePath)) return { version: STORE_VERSION, revision: 0, tasks: [], tombstones: [] };
  let value;
  try {
    value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read task store at ${filePath}: ${error.message}`);
  }
  if (value?.version !== STORE_VERSION || !Number.isInteger(value.revision) || value.revision < 0) {
    throw new Error(`Unsupported task store version at ${filePath}.`);
  }
  const tasks = Array.isArray(value.tasks) ? value.tasks.map(normalizeStoredTask) : null;
  const tombstones = Array.isArray(value.tombstones)
    ? value.tombstones.filter((item) => item && typeof item.id === 'string' && Number.isInteger(item.revision))
    : null;
  if (!tasks || !tombstones) throw new Error('Task store must contain task and tombstone arrays.');
  return { version: STORE_VERSION, revision: value.revision, tasks, tombstones };
}

function writeStore(filePath, state) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    try { fs.rmSync(temporaryPath, { force: true }); } catch {}
    throw error;
  }
}

export function createTaskRepository(filePath, {
  now = () => new Date(),
  createId = () => crypto.randomUUID(),
} = {}) {
  let state = readStore(filePath);
  if (!fs.existsSync(filePath)) writeStore(filePath, state);

  const persist = (nextState) => {
    writeStore(filePath, nextState);
    state = nextState;
  };
  const find = (id) => state.tasks.find((task) => task.id === id);
  const requireTask = (id) => {
    const task = find(id);
    if (!task) throw new TaskStoreError('Task not found.', 404);
    return task;
  };
  const requireRevision = (task, revision) => {
    if (!Number.isInteger(revision)) throw new TaskStoreError('Task revision is required.');
    if (task.revision !== revision) throw new TaskStoreError('Task changed on another device.', 409, task);
  };
  const timestamp = () => now().toISOString();

  return {
    list(since = null) {
      if (since !== null && (!Number.isInteger(since) || since < 0)) {
        throw new TaskStoreError('Task revision must be a non-negative integer.');
      }
      return {
        revision: state.revision,
        tasks: state.tasks.filter((task) => since === null || task.revision > since),
        deleted: state.tombstones.filter((item) => since !== null && item.revision > since).map((item) => item.id),
      };
    },
    create(input) {
      const values = normalizeTaskInput(input);
      const stamp = timestamp();
      const revision = state.revision + 1;
      const position = Number.isFinite(input.position)
        ? input.position
        : Math.max(0, ...state.tasks.map((task) => task.position)) + 1024;
      const task = {
        id: createId(),
        ...values,
        status: 'open',
        position,
        createdAt: stamp,
        updatedAt: stamp,
        completedAt: null,
        revision,
      };
      persist({ ...state, revision, tasks: [...state.tasks, task] });
      return task;
    },
    update(id, input) {
      const current = requireTask(id);
      requireRevision(current, input.revision);
      const values = normalizeTaskInput({ ...current, ...input });
      const revision = state.revision + 1;
      const task = {
        ...current,
        ...values,
        position: Number.isFinite(input.position) ? input.position : current.position,
        updatedAt: timestamp(),
        revision,
      };
      persist({
        ...state,
        revision,
        tasks: state.tasks.map((candidate) => candidate.id === id ? task : candidate),
      });
      return task;
    },
    setCompleted(id, revision, completed) {
      const current = requireTask(id);
      requireRevision(current, revision);
      const stamp = timestamp();
      const task = {
        ...current,
        status: completed ? 'completed' : 'open',
        completedAt: completed ? stamp : null,
        updatedAt: stamp,
        revision: state.revision + 1,
      };
      persist({
        ...state,
        revision: task.revision,
        tasks: state.tasks.map((candidate) => candidate.id === id ? task : candidate),
      });
      return task;
    },
    delete(id, revision) {
      const current = requireTask(id);
      requireRevision(current, revision);
      const nextRevision = state.revision + 1;
      persist({
        ...state,
        revision: nextRevision,
        tasks: state.tasks.filter((task) => task.id !== id),
        tombstones: [...state.tombstones, { id, revision: nextRevision }],
      });
      return { id, revision: nextRevision };
    },
  };
}
