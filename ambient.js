const pad = (value) => String(value).padStart(2, "0");

export function localDateKey(date) {
    return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-");
}

export function ambientPeriod(date) {
    const hour = date.getHours();
    if (hour >= 6 && hour < 9) return "morning";
    if (hour >= 9 && hour < 16) return "day";
    if (hour >= 16 && hour < 21) return "evening";
    return "night";
}

function eventMinutes(event, key) {
    const value = event[key];
    if (!/^\d\d:\d\d$/.test(value || "")) return null;
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
}

export function classifyAmbientEvents(events, now) {
    const today = localDateKey(now);
    const tomorrowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const tomorrow = localDateKey(tomorrowDate);
    const currentMinute = now.getHours() * 60 + now.getMinutes();
    const byTime = (left, right) =>
        (left.tm || "99:99").localeCompare(right.tm || "99:99") ||
        String(left.t || "").localeCompare(String(right.t || ""));
    const todayEvents = events.filter((event) => event.d === today).sort(byTime);
    const tomorrowEvents = events.filter((event) => event.d === tomorrow).sort(byTime);
    const allDay = todayEvents.filter((event) => eventMinutes(event, "tm") === null);
    const timed = todayEvents.filter((event) => eventMinutes(event, "tm") !== null);
    const current = [];
    const upcoming = [];
    const completed = [];

    timed.forEach((event) => {
        const start = eventMinutes(event, "tm");
        let end = eventMinutes(event, "te");
        if (end === null || end <= start) end = Math.min(1440, start + 60);
        if (currentMinute < start) upcoming.push(event);
        else if (currentMinute < end) current.push(event);
        else completed.push(event);
    });

    const conflicts = new Set();
    timed.forEach((event, index) => {
        const start = eventMinutes(event, "tm");
        let end = eventMinutes(event, "te");
        if (end === null || end <= start) end = Math.min(1440, start + 60);
        timed.slice(index + 1).forEach((other) => {
            const otherStart = eventMinutes(other, "tm");
            let otherEnd = eventMinutes(other, "te");
            if (otherEnd === null || otherEnd <= otherStart)
                otherEnd = Math.min(1440, otherStart + 60);
            if (start < otherEnd && otherStart < end) {
                conflicts.add(event);
                conflicts.add(other);
            }
        });
    });

    return {
        today,
        tomorrow,
        allDay,
        current,
        upcoming,
        completed,
        tomorrowEvents,
        conflicts,
        next: upcoming[0] || null,
    };
}

export function minutesUntil(event, now) {
    if (event?.d !== localDateKey(now)) return null;
    const start = eventMinutes(event, "tm");
    if (start === null) return null;
    return start - (now.getHours() * 60 + now.getMinutes());
}

export function ambientEventKey(event) {
    return [event?.url, event?.id, event?.d, event?.tm, event?.t]
        .filter(Boolean)
        .join("|");
}

export function newlyStartedAmbientEvent(currentEvents, previousKeys) {
    if (!(previousKeys instanceof Set)) return null;
    return currentEvents.find((event) => !previousKeys.has(ambientEventKey(event))) || null;
}

export const AMBIENT_THEME_NAMES = [
    "sand",
    "ocean",
    "forest",
    "blossom",
    "slate",
    "amber",
];

export function ambientEventKind(event) {
    if (event?.kind === "reminder")
        return { key: "reminder", label: "Reminder", icon: "bell" };
    if (event?.kind === "dinner")
        return { key: "dinner", label: "Dinner", icon: "utensils" };
    return { key: "event", label: "Event", icon: "calendar-days" };
}

export function selectAmbientFocus(model, slot = "day") {
    if (slot === "night") return model.tomorrowEvents?.[0] || null;
    return model.current?.at(-1) || model.next || model.allDay?.[0] || null;
}

export function ambientWeatherState({ enabled, location, status, weather }) {
    if (!enabled) return "off";
    if (!location) return "needs-location";
    if (status === "loading") return "loading";
    if (status === "error") return "error";
    return weather ? "ready" : "loading";
}

export function ambientLayerState(forecastOpen) {
    return {
        view: forecastOpen ? "forecast" : "glance",
        briefingHidden: Boolean(forecastOpen),
        forecastHidden: !forecastOpen,
    };
}
