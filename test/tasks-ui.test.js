import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { groupTasks, mergeTaskResponse, selectGlanceTasks } from "../tasks.js";

const task = (id, values = {}) => ({
    id,
    title: id,
    status: "open",
    dueDate: null,
    dueTime: null,
    position: 0,
    revision: 1,
    ...values,
});

test("groups open household tasks by urgency and sorts due time before position", () => {
    const grouped = groupTasks([
        task("anytime"),
        task("later", { dueDate: "2026-10-13" }),
        task("today-late", { dueDate: "2026-10-12", dueTime: "17:00", position: 1 }),
        task("today-early", { dueDate: "2026-10-12", dueTime: "08:00", position: 99 }),
        task("overdue", { dueDate: "2026-10-11" }),
        task("done", { status: "completed" }),
    ], "2026-10-12");
    assert.deepEqual(grouped.overdue.map(({ id }) => id), ["overdue"]);
    assert.deepEqual(grouped.today.map(({ id }) => id), ["today-early", "today-late"]);
    assert.deepEqual(grouped.upcoming.map(({ id }) => id), ["later"]);
    assert.deepEqual(grouped.anytime.map(({ id }) => id), ["anytime"]);
    assert.deepEqual(grouped.completed.map(({ id }) => id), ["done"]);
});

test("reconciles an optimistic task with the authoritative response", () => {
    const original = task("one");
    const server = task("one", { status: "completed", revision: 2 });
    assert.deepEqual(mergeTaskResponse([original], server), [server]);
});

test("adds a newly created authoritative task to the local collection", () => {
    const existing = task("one");
    const created = task("two");
    assert.deepEqual(mergeTaskResponse([existing], created), [existing, created]);
});

test("keeps Glance quiet at zero tasks and caps overdue/today summaries at three", () => {
    assert.deepEqual(selectGlanceTasks([], "2026-10-12"), []);
    assert.deepEqual(
        selectGlanceTasks([task("one", { dueDate: "2026-10-12" })], "2026-10-12").map(({ id }) => id),
        ["one"],
    );
    const many = [
        task("future", { dueDate: "2026-10-13" }),
        task("today-c", { dueDate: "2026-10-12", dueTime: "12:00" }),
        task("late", { dueDate: "2026-10-10" }),
        task("today-a", { dueDate: "2026-10-12", dueTime: "08:00" }),
        task("today-b", { dueDate: "2026-10-12", dueTime: "10:00" }),
    ];
    assert.deepEqual(selectGlanceTasks(many, "2026-10-12").map(({ id }) => id), ["late", "today-a", "today-b"]);
});

test("task UI includes rollback, conflict adoption, completion, and empty states", () => {
    const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
    assert.match(app, /householdTasks = mergeTaskResponse\(householdTasks, optimistic\)/);
    assert.match(app, /householdTasks = mergeTaskResponse\(householdTasks, previous\)/);
    assert.match(app, /response\.status === 409[\s\S]*?result\.current[\s\S]*?fetchTasks\(\)/);
    assert.match(app, /Everything’s taken care of/);
    assert.match(app, /"complete" : "reopen"/);
    assert.match(app, /ambient-task-module/);
});

test("task UI creates tasks from its contextual companion action", () => {
    const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
    assert.match(app, /fetch\("\/api\/tasks", \{[\s\S]*?method: "POST"/);
    assert.match(app, /householdTasks = mergeTaskResponse\(householdTasks, result\.task\)/);
    assert.match(app, /task-composer-form["']\)\.onsubmit = createTask/);
    assert.match(app, /assigneeIds: \[\.\.\.taskAssigneeIds\]/);
    assert.match(app, /function renderTaskAssigneeOptions\(\)/);
    assert.match(app, /activePage === "tasks"\) setTaskComposerOpen\(true, \$\("addbtn"\)\)/);
    assert.doesNotMatch(app, /taskBeingEdited|removeTask|method: "DELETE"/);
    assert.match(app, /task-complete\.mp3/);
    assert.match(app, /classList\.add\("is-completing"\)/);
    assert.match(app, /playTaskCompleteSound\(\)/);
});
