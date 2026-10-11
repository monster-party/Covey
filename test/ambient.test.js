import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    AMBIENT_THEME_NAMES,
    ambientEventKind,
    ambientEventKey,
    ambientLayerState,
    ambientPeriod,
    ambientWeatherState,
    classifyAmbientEvents,
    localDateKey,
    minutesUntil,
    newlyStartedAmbientEvent,
    selectAmbientFocus,
} from "../ambient.js";

const at = (hour, minute = 0, day = 7) => new Date(2026, 9, day, hour, minute);
const event = (title, date, start, end) => ({
    id: title,
    t: title,
    d: date,
    ...(start ? { tm: start } : {}),
    ...(end ? { te: end } : {}),
});

test("selects Glance periods at their boundaries", () => {
    assert.equal(ambientPeriod(at(5, 59)), "night");
    assert.equal(ambientPeriod(at(6)), "morning");
    assert.equal(ambientPeriod(at(9)), "day");
    assert.equal(ambientPeriod(at(16)), "evening");
    assert.equal(ambientPeriod(at(21)), "night");
});

test("classifies current, upcoming, completed, all-day, and tomorrow events", () => {
    const result = classifyAmbientEvents(
        [
            event("Breakfast", "2026-10-07", "07:00", "08:00"),
            event("School", "2026-10-07", "08:30", "15:00"),
            event("Practice", "2026-10-07", "17:00", "18:00"),
            event("Holiday", "2026-10-07"),
            event("Dentist", "2026-10-08", "09:00", "10:00"),
        ],
        at(10),
    );

    assert.deepEqual(result.completed.map((item) => item.t), ["Breakfast"]);
    assert.deepEqual(result.current.map((item) => item.t), ["School"]);
    assert.deepEqual(result.upcoming.map((item) => item.t), ["Practice"]);
    assert.deepEqual(result.allDay.map((item) => item.t), ["Holiday"]);
    assert.deepEqual(result.tomorrowEvents.map((item) => item.t), ["Dentist"]);
    assert.equal(result.next.t, "Practice");
});

test("detects overlapping timed events", () => {
    const first = event("Pickup", "2026-10-07", "15:00", "16:00");
    const second = event("Appointment", "2026-10-07", "15:30", "16:30");
    const separate = event("Dinner", "2026-10-07", "18:00", "19:00");
    const result = classifyAmbientEvents([first, second, separate], at(12));

    assert.equal(result.conflicts.has(first), true);
    assert.equal(result.conflicts.has(second), true);
    assert.equal(result.conflicts.has(separate), false);
});

test("handles midnight and reports minutes until the next event", () => {
    const now = at(23, 50);
    const nextDay = new Date(2026, 9, 8, 0, 5);
    assert.equal(localDateKey(nextDay), "2026-10-08");
    assert.equal(minutesUntil(event("Late snack", "2026-10-07", "23:55"), now), 5);
    assert.equal(minutesUntil(event("Breakfast", "2026-10-08", "07:00"), now), null);
});

test("detects an event that starts while Glance is already open", () => {
    const school = event("School", "2026-10-07", "08:30", "15:00");
    const practice = event("Practice", "2026-10-07", "17:00", "18:00");
    assert.equal(newlyStartedAmbientEvent([school], null), null);
    assert.equal(
        newlyStartedAmbientEvent([school], new Set([ambientEventKey(school)])),
        null,
    );
    assert.equal(
        newlyStartedAmbientEvent(
            [school, practice],
            new Set([ambientEventKey(school)]),
        ),
        practice,
    );
});

test("prioritizes current, upcoming, all-day, and tomorrow events for Glance", () => {
    const allDay = event("School holiday", "2026-10-07");
    const current = event("Swimming", "2026-10-07", "09:30", "10:30");
    const upcoming = event("Dinner", "2026-10-07", "18:00", "19:00");
    const tomorrow = event("Dentist", "2026-10-08", "08:00", "09:00");
    const model = classifyAmbientEvents([allDay, current, upcoming, tomorrow], at(10));

    assert.equal(selectAmbientFocus(model, "day"), current);
    assert.equal(selectAmbientFocus(model, "night"), tomorrow);
    assert.equal(
        selectAmbientFocus(classifyAmbientEvents([allDay], at(10)), "day"),
        allDay,
    );
});

test("maps every Glance event type to a restrained label and icon", () => {
    assert.deepEqual(ambientEventKind({ kind: "event" }), {
        key: "event",
        label: "Event",
        icon: "calendar-days",
    });
    assert.equal(ambientEventKind({ kind: "reminder" }).label, "Reminder");
    assert.equal(ambientEventKind({ kind: "dinner" }).icon, "utensils");
    assert.equal(ambientEventKind({ calendarId: "sports" }).label, "Event");
});

test("exposes weather navigation states and all Covey Glance themes", () => {
    assert.equal(ambientWeatherState({ enabled: false }), "off");
    assert.equal(ambientWeatherState({ enabled: true, location: "" }), "needs-location");
    assert.equal(
        ambientWeatherState({ enabled: true, location: "Toronto", status: "error" }),
        "error",
    );
    assert.equal(
        ambientWeatherState({
            enabled: true,
            location: "Toronto",
            status: "ready",
            weather: { temperature: 18 },
        }),
        "ready",
    );
    assert.deepEqual(AMBIENT_THEME_NAMES, [
        "sand",
        "ocean",
        "forest",
        "blossom",
        "slate",
        "amber",
    ]);
});

test("defines light and dark Glance surfaces with reduced-motion fallbacks", () => {
    const css = readFileSync(new URL("../style.css", import.meta.url), "utf8");
    AMBIENT_THEME_NAMES.forEach((theme) => {
        assert.match(css, new RegExp(`data-ambient-theme=["']${theme}["']\\]\\[data-ambient-mode=["']light["']`));
        assert.match(css, new RegExp(`data-ambient-theme=["']${theme}["']\\]\\[data-ambient-mode=["']dark["']`));
    });
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /\.ambient-drift span,[^}]*animation:none !important/s);
});

test("exposes only one Glance surface to assistive technology", () => {
    assert.deepEqual(ambientLayerState(false), {
        view: "glance",
        briefingHidden: false,
        forecastHidden: true,
    });
    assert.deepEqual(ambientLayerState(true), {
        view: "forecast",
        briefingHidden: true,
        forecastHidden: false,
    });
});

test("uses a full-pane push over one persistent Glance background", () => {
    const css = readFileSync(new URL("../style.css", import.meta.url), "utf8");
    assert.match(
        css,
        /data-ambient-view=["']forecast["']\] \.ambient-glance\s*\{[^}]*translate3d\(-100%,0,0\)/,
    );
    assert.match(
        css,
        /data-ambient-view=["']forecast["']\] \.ambient-forecast-view\s*\{[^}]*translate3d\(0,0,0\)/,
    );
    assert.match(css, /\.ambient-forecast-view\s*\{[^}]*background:transparent/);
    assert.match(css, /\.ambient-pane\s*\{[^}]*transition:transform 360ms/);
    assert.match(
        css,
        /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.ambient-pane\s*\{[^}]*transition:none !important/,
    );
});
