export function taskDateKey(date = new Date()) {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function compareTasks(a, b) {
    const dateA = a.dueDate || "9999-12-31";
    const dateB = b.dueDate || "9999-12-31";
    return dateA.localeCompare(dateB) ||
        (a.dueTime || "99:99").localeCompare(b.dueTime || "99:99") ||
        (Number(a.position) || 0) - (Number(b.position) || 0) ||
        String(a.title || "").localeCompare(String(b.title || ""));
}

export function groupTasks(tasks, today = taskDateKey()) {
    const groups = { overdue: [], today: [], upcoming: [], anytime: [], completed: [] };
    for (const task of tasks || []) {
        if (task.status === "completed") groups.completed.push(task);
        else if (!task.dueDate) groups.anytime.push(task);
        else if (task.dueDate < today) groups.overdue.push(task);
        else if (task.dueDate === today) groups.today.push(task);
        else groups.upcoming.push(task);
    }
    Object.values(groups).forEach((items) => items.sort(compareTasks));
    groups.completed.sort((a, b) =>
        String(b.completedAt || b.updatedAt || "").localeCompare(String(a.completedAt || a.updatedAt || "")),
    );
    return groups;
}

export function mergeTaskResponse(tasks, task) {
    return tasks.map((candidate) => candidate.id === task.id ? task : candidate);
}

export function selectGlanceTasks(tasks, today = taskDateKey(), limit = 3) {
    const groups = groupTasks(tasks, today);
    return [...groups.overdue, ...groups.today].slice(0, limit);
}
