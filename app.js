            import "./theme.js";
            import {
                ambientEventKey,
                ambientEventKind,
                ambientLayerState,
                ambientPeriod,
                ambientWeatherState,
                classifyAmbientEvents,
                localDateKey,
                minutesUntil,
                newlyStartedAmbientEvent,
                selectAmbientFocus,
            } from "./ambient.js";
            import { mountCalendarShell } from "./components/calendar-shell.js";
            import { mountEventDialogs } from "./components/event-dialogs.js";
            import { mountSettingsDialog } from "./components/settings-dialog.js";
            import { groupTasks, mergeTaskResponse, selectGlanceTasks, taskDateKey } from "./tasks.js";

            mountCalendarShell(document.getElementById("app-root"));
            mountEventDialogs(document.getElementById("dialogs-root"));
            mountSettingsDialog(document.getElementById("settings-root"));

            const eventStartChime = new Audio(
                new URL("./sounds/event-start-chime.mp3", import.meta.url).href,
            );
            const taskCompleteSound = new Audio(
                new URL("./sounds/task-complete.mp3", import.meta.url).href,
            );
            eventStartChime.preload = "auto";
            taskCompleteSound.preload = "auto";
            let eventStartChimePrimed = false;
            function playEventStartChime() {
                eventStartChime.volume = todayEventChimeVolume / 100;
                eventStartChime.pause();
                eventStartChime.currentTime = 0;
                eventStartChime.play().catch(() => {
                    // Browsers may withhold audio until the page has received a
                    // user gesture. The visual alert still remains available.
                });
            }
            function playTaskCompleteSound() {
                taskCompleteSound.volume = todayEventChimeVolume / 100;
                taskCompleteSound.pause();
                taskCompleteSound.currentTime = 0;
                taskCompleteSound.play().catch(() => {});
            }
            function primeEventStartChime() {
                if (eventStartChimePrimed) return;
                eventStartChimePrimed = true;
                const volume = eventStartChime.volume;
                eventStartChime.volume = 0;
                eventStartChime.play().then(() => {
                    eventStartChime.pause();
                    eventStartChime.currentTime = 0;
                    eventStartChime.volume = volume;
                }).catch(() => {
                    eventStartChimePrimed = false;
                    eventStartChime.volume = volume;
                });
            }
            addEventListener("pointerdown", primeEventStartChime, { once: true });
            addEventListener("keydown", primeEventStartChime, { once: true });

            /*
             * Covey browser application.
             *
             * app.js owns the interactive calendar: local state, iCloud API
             * calls, rendering, preferences, settings, and input handling.
             * It expects theme.js to have initialized the global GT object
             * before this script runs, and expects the DOM from index.html.
             */

            // Inline SVG paths keep the app independent of an icon runtime.
            // Lucide icons (inlined)
            const P = {
                "chevron-left": '<path d="m15 18-6-6 6-6"/>',
                "chevron-right": '<path d="m9 18 6-6-6-6"/>',
                "chevron-down": '<path d="m6 9 6 6 6-6"/>',
                "arrow-left": '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
                check: '<path d="m20 6-11 11-5-5"/>',
                umbrella: '<path d="M22 12a10.06 10.06 0 0 0-20 0Z"/><path d="M12 12v8a2 2 0 0 0 4 0"/>',
                wind: '<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8.6A2.5 2.5 0 1 1 19 13H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>',
                sunset: '<path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m16 6-4 4-4-4"/><path d="M16 18a4 4 0 0 0-8 0"/>',
                sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
                cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
                "cloud-sun": '<path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.95 12.65a4 4 0 0 0-5.93-4.13"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
                "cloud-moon": '<path d="M19.5 13.5A7 7 0 0 1 10.5 4.5 7 7 0 1 0 19.5 13.5Z"/><path d="M17.5 21H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
                "cloud-fog": '<path d="M17.5 15H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="M3 19h18"/><path d="M5 22h14"/>',
                "cloud-drizzle": '<path d="M17.5 15H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="M8 19v1"/><path d="M12 19v1"/><path d="M16 19v1"/>',
                "cloud-rain": '<path d="M17.5 15H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="m8 19-1 2"/><path d="m16 19-1 2"/><path d="m12 20-1 2"/>',
                "cloud-sun-rain": '<path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.95 12.65a4 4 0 0 0-5.93-4.13"/><path d="M13 18H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/><path d="m8 21-1 2"/><path d="m16 21-1 2"/><path d="m12 21-1 2"/>',
                "cloud-snow": '<path d="M17.5 15H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="M8 19v.01"/><path d="M12 21v.01"/><path d="M16 19v.01"/>',
                "cloud-lightning": '<path d="M17.5 15H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="m13 15-3 5h4l-2 4"/>',
                moon: '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>',
                settings:
                    '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>',
                "paintbrush-vertical":
                    '<path d="M10 2v2"/><path d="M14 2v4"/><path d="M17 2a1 1 0 0 1 1 1v9H6V3a1 1 0 0 1 1-1z"/><path d="M6 12a1 1 0 0 0-1 1v1a2 2 0 0 0 2 2h2a1 1 0 0 1 1 1v2.9a2 2 0 1 0 4 0V17a1 1 0 0 1 1-1h2a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1"/>',
                "maximize-2":
                    '<path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/>',
                "minimize-2":
                    '<path d="m14 10 7-7"/><path d="M20 10h-6V4"/><path d="m3 21 7-7"/><path d="M4 14h6v6"/>',
                x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
                plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
                bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
                calendar:
                    '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>',
                "calendar-days":
                    '<path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/>',
                "columns-3":
                    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>',
                list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
                utensils:
                    '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
                briefcase:
                    '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
                house:
                    '<path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9"/><path d="M9 21v-7h6v7"/>',
                heart:
                    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
                "book-open":
                    '<path d="M12 7v14"/><path d="M3 18V5a2 2 0 0 1 2-2h3a4 4 0 0 1 4 4 4 4 0 0 1 4-4h3a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-4a3 3 0 0 0-3 2 3 3 0 0 0-3-2H5a2 2 0 0 1-2-2Z"/>',
                music:
                    '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
                dumbbell:
                    '<path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>',
                "shopping-bag":
                    '<path d="M6 7h12l1 14H5L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
                users: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
                baby: '<path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1 4.7c0 5-3.5 9-8 9s-8-4-8-9a9 9 0 0 1 1.3-4.7"/><path d="M12 2c1.5 0 3 .5 4.5 1.5"/>',
                pencil:
                    '<path d="m16 5 3 3"/><path d="m4 20 4-.8L19 8a2.12 2.12 0 0 0-3-3L5 16l-1 4Z"/>',
                "trash-2":
                    '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
            };
            const ic = (n, s = 20) =>
                '<svg xmlns="http://www.w3.org/2000/svg" width="' +
                s +
                '" height="' +
                s +
                '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                P[n] +
                "</svg>";
            // Calendar colors and family filters are intentionally kept in one
            // place so event rendering and settings use the same definitions.
            // Only entries with on:true appear as filters and in the "who" picker.
            // The others are kept (they still color older events) so a person can be re-added by setting on:true.
            const M = [
                { n: "Parent 1", c: "#ffdcd6", d: "#9a5144", on: false },
                { n: "Parent 2", c: "#dce6ff", d: "#405a90", on: false },
                { n: "Kid 1", c: "#d9f3e7", d: "#356653", on: false },
                { n: "Kid 2", c: "#fff0b8", d: "#755b1e", on: false },
                { n: "Family", c: "#eadffc", d: "#5f498e", on: true },
            ];
            const AVATAR_EMOJI = {
                person: "🙂",
                child: "🧒",
                baby: "👶",
                bird: "🐦",
            };
            const PERSON_BIRD_IMAGES = [
                { name: "Nuthatch", src: "/images/Nuthatch.png" },
                { name: "Blue jay", src: "/images/robin.png" },
                { name: "Cardinal", src: "/images/cardinal.png" },
                { name: "Goldfinch", src: "/images/goldfinch.png" },
                { name: "Robin", src: "/images/blue-jay.png" },
            ];

            const CALENDAR_COLORS = {
                coral: { label: "Coral", bg: "#ffdcd6", fg: "#9a5144" },
                blue: { label: "Blue", bg: "#dce6ff", fg: "#405a90" },
                green: { label: "Green", bg: "#d9f3e7", fg: "#356653" },
                amber: { label: "Amber", bg: "#fff0b8", fg: "#755b1e" },
                violet: { label: "Violet", bg: "#eadffc", fg: "#5f498e" },
                teal: { label: "Teal", bg: "#d5f3ee", fg: "#28695f" },
                rose: { label: "Rose", bg: "#f8dce9", fg: "#824463" },
                slate: { label: "Slate", bg: "#e8edf5", fg: "#50596d" },
            };
            const CALENDAR_ICON_LABELS = {
                calendar: "Calendar",
                briefcase: "Work",
                house: "Home",
                heart: "Health",
                "book-open": "Reading",
                music: "Music",
                dumbbell: "Fitness",
                "shopping-bag": "Shopping",
                users: "People",
                baby: "Kids",
            };
            const K = {
                reminder: {
                    n: "Reminders",
                    c: "#e9edf6",
                    d: "#505a70",
                    i: "bell",
                },
                dinner: {
                    n: "Dinner",
                    c: "#ffe7c7",
                    d: "#80501f",
                    i: "utensils",
                },
            };
            const calendarForEvent = (e) =>
                calendarConfigs.find((calendar) => calendar.id === e.calendarId);
            const sty = (e) => {
                const calendar = calendarForEvent(e);
                const color = calendar && CALENDAR_COLORS[calendar.color];
                if (color) return { n: calendar.name, c: color.bg, d: color.fg };
                return K[e.kind] || M[mi(e.m)];
            };
            const tag = (n, e) => {
                const calendar = calendarForEvent(e);
                const icon = calendar?.icon || K[e.kind]?.i;
                if (icon)
                    n.insertAdjacentHTML(
                        "afterbegin",
                        '<span class="inline-block align-[-2px] mr-1">' +
                            ic(icon, 14) +
                            "</span>",
                    );
                return n;
            };
            const mi = (n) => {
                const i = M.findIndex((x) => x.n === n);
                return i < 0 ? M.length - 1 : i;
            };
            const $ = (id) => document.getElementById(id);
            const SPLASH_MIN_MS = 900; // allow the launch mark one calm breath before revealing the calendar
            const splashStart = Date.now();
            function hideSplash() {
                const s = $("splash");
                if (!s || s.dataset.leaving === "true") return;
                s.dataset.leaving = "true";
                const wait = Math.max(
                    0,
                    SPLASH_MIN_MS - (Date.now() - splashStart),
                );
                setTimeout(() => {
                    const reducedMotion = window.matchMedia(
                        "(prefers-reduced-motion: reduce)",
                    ).matches;
                    document.body.classList.add("app-revealing");
                    s.classList.add("is-leaving");
                    setTimeout(() => {
                        s.remove();
                        document.body.classList.remove(
                            "app-loading",
                            "app-revealing",
                        );
                    }, reducedMotion ? 0 : 900);
                }, wait);
            }
            setTimeout(hideSplash, 8000); // safety net in case the initial load never settles
            const pad = (n) => String(n).padStart(2, "0");
            const iso = (d) =>
                d.getFullYear() +
                "-" +
                pad(d.getMonth() + 1) +
                "-" +
                pad(d.getDate());
            const parse = (k) => {
                const [a, b, c] = k.split("-").map(Number);
                return new Date(a, b - 1, c);
            };
            const formatTime = (date, options) =>
                date.toLocaleTimeString([], {
                    ...options,
                    ...(timeFormat === "12"
                        ? { hour12: true }
                        : timeFormat === "24"
                          ? { hour12: false }
                          : {}),
                });
            const tfmt = (t) => {
                const [h, m] = t.split(":").map(Number);
                return formatTime(new Date(2000, 0, 1, h, m), {
                    hour: "numeric",
                    minute: "2-digit",
                });
            };
            const tshort = (t) =>
                tfmt(t).replace(/\s?([AP])M/i, (_, x) => x.toLowerCase());
            const demo = !window.GAGGLE_SERVER;
            const addDays = (k, n) => {
                const d = parse(k);
                d.setDate(d.getDate() + n);
                return iso(d);
            };
            const sunday = (k) => addDays(k, -parse(k).getDay());
            // Restore the user's calendar and appearance preferences before the
            // first render. Calendar events use a separate local preview store.
            let days = 5,
                txt = "md",
                pal = "sand",
                auto = false,
                dFrom = "19:00",
                dTo = "07:00",
                manual = null,
                ovr = null,
                initView = null,
                timeFormat = "device",
                compactWeek = false,
                keepScreenAwake = false,
                todayViewEnabled = true,
                soundsEnabled = true,
                todayEventChimeEnabled = true,
                taskCompleteSoundEnabled = true,
                todayEventChimeVolume = 55,
                todayWeatherEnabled = true,
                todayWeatherLocation = "",
                todayTemperatureUnit = "F";
            let people = [];
            const hide = { event: false, reminder: false, dinner: false };
            try {
                const st = JSON.parse(
                    localStorage.getItem("gaggle-settings") || "{}",
                );
                if (st.days >= 1 && st.days <= 7) days = st.days;
                if (st.hide) Object.assign(hide, st.hide);
                if (st.palette && GT.T.hasOwnProperty(st.palette))
                    pal = st.palette;
                if (st.text && GT.TX.hasOwnProperty(st.text)) txt = st.text;
                auto = !!st.auto;
                if (/^\d\d:\d\d$/.test(st.darkFrom)) dFrom = st.darkFrom;
                if (/^\d\d:\d\d$/.test(st.darkTo)) dTo = st.darkTo;
                if (
                    st.view === "month" ||
                    st.view === "week" ||
                    st.view === "list"
                )
                    initView = st.view;
                if (["device", "12", "24"].includes(st.timeFormat))
                    timeFormat = st.timeFormat;
                compactWeek = !!st.compactWeek;
                keepScreenAwake = !!st.keepScreenAwake;
                todayViewEnabled = st.todayViewEnabled !== false;
                soundsEnabled = st.soundsEnabled !== false;
                todayEventChimeEnabled = st.todayEventChimeEnabled !== false;
                taskCompleteSoundEnabled = st.taskCompleteSoundEnabled !== false;
                if (Number.isFinite(st.todayEventChimeVolume))
                    todayEventChimeVolume = Math.min(
                        100,
                        Math.max(10, Math.round(st.todayEventChimeVolume / 5) * 5),
                    );
                todayWeatherEnabled = st.todayWeatherEnabled !== false;
                if (typeof st.todayWeatherLocation === "string")
                    todayWeatherLocation = st.todayWeatherLocation.slice(0, 100);
                if (["F", "C"].includes(st.todayTemperatureUnit))
                    todayTemperatureUnit = st.todayTemperatureUnit;
            } catch (e) {}
            try {
                const mo = localStorage.getItem("gaggle-theme");
                if (mo === "light" || mo === "dark") manual = mo;
            } catch (e) {}
            const home = () =>
                days === 7 ? sunday(iso(new Date())) : iso(new Date());
            let selectedPersonIds = new Set(),
                personSelectionTouched = false;
            let calendarConfigs = [],
                addCalendarColor = "teal",
                addCalendarIcon = "calendar",
                addCalendarPickerOpen = null,
                calendarFormOpen = false,
                calendarSaving = false,
                personFormOpen = false,
                personSaving = false,
                editingPersonId = null,
                addPersonAvatar = "person",
                addPersonImage = null,
                addPersonCalendarIds = new Set();
            let syncState = "pending",
                lastSyncAt = null;
            let ev = [],
                local = [],
                kinds = ["event", "reminder", "dinner"],
                addKind = "event",
                view = initView || "week",
                sel = iso(new Date()),
                wstart = home(),
                cur = new Date(),
                sheet = false,
                detailEvent = null,
                detailReturnFocus = null,
                activePage = "glance",
                todayOverlayOpen = null,
                todayOverlaySignature = "",
                ambientCurrentEventKeys = null,
                todayWeatherPanelOpen = false,
                todayWeatherTransitioning = false,
                todayWeatherTransitionTimer = null,
                todayWeather = null,
                todayWeatherRequestDate = "",
                todayWeatherStatus = "idle",
                todayWeatherMessage = "",
                todayWeatherLastRequestAt = 0,
                loadedMonths = [],
                todayEventCacheDate = "",
                todayEventCache = [],
                todayEventsLoadingFor = "",
                todayEventsError = "",
                tomorrowEventCacheDate = "",
                tomorrowEventCache = [],
                tomorrowEventsLoadingFor = "",
                tomorrowEventsError = "",
                setOpen = false,
                setTab = "calendars",
                settingsReturnFocus = null;
            let householdTasks = [],
                tasksStatus = "idle",
                tasksMessage = "",
                tasksRequest = null,
                taskComposerOpen = false,
                taskAssigneeIds = new Set(),
                taskComposerReturnFocus = null;
            let screenWakeLock = null,
                wakeLockMessage = "";
            cur.setDate(1);
            try {
                local = JSON.parse(localStorage.getItem("gaggle") || "[]");
            } catch (e) {}
            // Demo mode persists events locally; server mode persists them in
            // iCloud and only uses these browser stores for UI preferences.
            const saveLocal = () => {
                try {
                    localStorage.setItem("gaggle", JSON.stringify(local));
                } catch (e) {}
            };
            const saveSet = () => {
                try {
                    localStorage.setItem(
                        "gaggle-settings",
                        JSON.stringify({
                            days,
                            hide,
                            text: txt,
                            palette: pal,
                            auto,
                            darkFrom: dFrom,
                            darkTo: dTo,
                            view,
                            timeFormat,
                            compactWeek,
                            keepScreenAwake,
                            todayViewEnabled,
                            soundsEnabled,
                            todayEventChimeEnabled,
                            taskCompleteSoundEnabled,
                            todayEventChimeVolume,
                            todayWeatherEnabled,
                            todayWeatherLocation,
                            todayTemperatureUnit,
                        }),
                    );
                } catch (e) {}
            };
            function renderWakeLockSettings() {
                const input = $("keep-screen-awake");
                const message = $("wake-lock-status");
                if (!input || !message) return;
                const supported = "wakeLock" in navigator;
                input.checked = keepScreenAwake;
                input.disabled = !supported;
                message.textContent = !supported
                    ? "Screen wake lock is not supported by this browser."
                    : wakeLockMessage;
            }
            async function requestScreenWakeLock() {
                if (
                    !keepScreenAwake ||
                    document.visibilityState !== "visible" ||
                    !("wakeLock" in navigator) ||
                    screenWakeLock
                )
                    return;
                try {
                    const lock = await navigator.wakeLock.request("screen");
                    if (!keepScreenAwake || document.visibilityState !== "visible") {
                        await lock.release();
                        return;
                    }
                    screenWakeLock = lock;
                    wakeLockMessage = "";
                    lock.addEventListener("release", () => {
                        if (screenWakeLock === lock) screenWakeLock = null;
                        wakeLockMessage = "";
                        renderWakeLockSettings();
                    });
                } catch (error) {
                    wakeLockMessage =
                        "Could not keep the screen awake. Check browser or battery settings.";
                }
                renderWakeLockSettings();
            }
            async function updateScreenWakeLock() {
                if (keepScreenAwake) {
                    await requestScreenWakeLock();
                    return;
                }
                wakeLockMessage = "";
                const lock = screenWakeLock;
                screenWakeLock = null;
                if (lock && !lock.released) await lock.release();
                renderWakeLockSettings();
            }
            // Keep connection and preview-mode feedback in every status region.
            const status = (m) => {
                const t =
                    m ||
                    (demo
                        ? "Preview mode: events are saved in this browser only."
                        : "");
                document
                    .querySelectorAll(".status")
                    .forEach((e) => (e.textContent = t));
            };
            function timeAgo(d) {
                if (!d) return "";
                const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
                if (s < 45) return "just now";
                const m = Math.round(s / 60);
                if (m < 60) return m + (m === 1 ? " minute ago" : " minutes ago");
                const h = Math.round(m / 60);
                if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
                const days = Math.round(h / 24);
                return days + (days === 1 ? " day ago" : " days ago");
            }
            function updateSyncBadge() {
                const btn = $("syncbtn"),
                    dot = $("syncdot"),
                    label = $("syncsub");
                if (!btn) return;
                btn.classList.toggle("hidden", demo);
                btn.classList.toggle("flex", !demo);
                if (demo) return;
                if (syncState === "pending") {
                    dot.className = "w-2 h-2 rounded-full bg-mute shrink-0 animate-pulse";
                    label.textContent = "Syncing\u2026";
                    btn.title = "Connecting to iCloud\u2026";
                } else if (syncState === "ok") {
                    dot.className = "w-2 h-2 rounded-full bg-emerald-500 shrink-0";
                    label.textContent = "Synced";
                    btn.title = "Last synced " + timeAgo(lastSyncAt);
                } else {
                    dot.className = "w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse";
                    label.textContent = lastSyncAt ? "Offline" : "Can\u2019t connect";
                    btn.title = lastSyncAt
                        ? "Can\u2019t reach iCloud \u2014 last synced " + timeAgo(lastSyncAt)
                        : "Can\u2019t reach iCloud yet \u2014 tap to retry";
                }
            }
            function el(t, c, x) {
                const e = document.createElement(t);
                if (c) e.className = c;
                if (x != null) e.textContent = x;
                return e;
            }
            function peopleForEvent(event) {
                const ids = Array.isArray(event.personIds) && event.personIds.length
                    ? event.personIds
                    : event.personId
                      ? [event.personId]
                      : [];
                const byId = ids
                    .map((id) => people.find((person) => person.id === id))
                    .filter(Boolean);
                if (byId.length) return byId;
                const categories = Array.isArray(event.members)
                    ? event.members
                    : event.m
                      ? [event.m]
                      : [];
                const byCategory = people.filter((person) =>
                    categories.some(
                        (name) =>
                            person.name.toLocaleLowerCase() ===
                            String(name).toLocaleLowerCase(),
                    ),
                );
                return byCategory.length
                    ? byCategory
                    : personTitleMatches(
                          [event.t, event.notes].filter(Boolean).join("\n"),
                      );
            }
            const eventMemberName = (event) => {
                const assigned = peopleForEvent(event);
                return assigned.length
                    ? assigned.map((person) => person.name).join(", ")
                    : event.m || "Family";
            };
            const eventDisplayTitle = (event) => {
                const assigned = peopleForEvent(event),
                    mentioned = personTitleMatches(event.t || ""),
                    unmentionedNames = assigned
                        .filter(
                            (person) =>
                                !mentioned.some((match) => match.id === person.id),
                        )
                        .map((person) => person.name),
                    member = assigned.length
                        ? unmentionedNames.join(", ")
                        : eventMemberName(event);
                return event.kind === "event" && member && member !== "Family"
                    ? event.t + " · " + member
                    : event.t;
            };
            function avatarNode(person, size = 24) {
                const avatar = el(
                    "span",
                    "inline-grid place-items-center overflow-hidden rounded-full shrink-0 bg-accent text-on font-medium",
                );
                avatar.style.width = size + "px";
                avatar.style.height = size + "px";
                avatar.style.fontSize = Math.max(9, Math.round(size * 0.58)) + "px";
                avatar.setAttribute("aria-hidden", "true");

                if (person.image) {
                    const image = el("img", "w-full h-full object-cover");
                    image.src = person.image;
                    image.alt = "";
                    avatar.append(image);
                } else {
                    avatar.textContent = AVATAR_EMOJI[person.avatar] ||
                        String(person.name || person.n || "?").slice(0, 1).toUpperCase();
                }
                return avatar;
            }

            function taskPeople(task) {
                return (task.assigneeIds || [])
                    .map((id) => people.find((person) => person.id === id))
                    .filter(Boolean);
            }
            function taskFacePile(task, compact = false) {
                const assigned = taskPeople(task);
                if (!assigned.length) return null;
                const pile = el("div", compact ? "task-face-pile is-compact" : "task-face-pile");
                const names = assigned.map((person) => person.name).join(", ");
                pile.setAttribute("aria-label", `Assigned to ${names}`);
                pile.title = names;
                assigned.slice(0, 3).forEach((person) => {
                    const avatar = avatarNode(person, compact ? 24 : 34);
                    avatar.classList.add("task-avatar");
                    avatar.title = person.name;
                    pile.append(avatar);
                });
                if (assigned.length > 3)
                    pile.append(el("span", "task-avatar task-avatar-more", `+${assigned.length - 3}`));
                return pile;
            }
            function taskDueText(task, today = taskDateKey()) {
                if (!task.dueDate) return task.notes || "Anytime";
                const date = new Date(`${task.dueDate}T12:00:00`);
                let label;
                if (task.dueDate < today) label = "Overdue · " + date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                else if (task.dueDate === today) label = "Today";
                else {
                    const tomorrow = new Date();
                    tomorrow.setHours(12, 0, 0, 0);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    label = task.dueDate === taskDateKey(tomorrow)
                        ? "Tomorrow"
                        : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                }
                if (task.dueTime) {
                    const [hours, minutes] = task.dueTime.split(":").map(Number);
                    const time = new Date();
                    time.setHours(hours, minutes, 0, 0);
                    label += ` · ${formatTime(time)}`;
                }
                return task.notes ? `${label} · ${task.notes}` : label;
            }
            async function fetchTasks({ announce = false } = {}) {
                if (tasksRequest) return tasksRequest;
                tasksStatus = householdTasks.length ? "refreshing" : "loading";
                tasksMessage = "";
                renderTaskSurfaces();
                tasksRequest = fetch("/api/tasks")
                    .then(async (response) => {
                        const result = await response.json().catch(() => ({}));
                        if (!response.ok) throw new Error(result.error || "Could not load tasks.");
                        householdTasks = Array.isArray(result.tasks) ? result.tasks : [];
                        tasksStatus = "ready";
                        if (announce) tasksMessage = "Tasks updated.";
                        renderTaskSurfaces();
                    })
                    .catch((error) => {
                        tasksStatus = "error";
                        tasksMessage = error.message || "Could not load tasks.";
                        renderTaskSurfaces();
                    })
                    .finally(() => { tasksRequest = null; });
                return tasksRequest;
            }
            function setTaskComposerOpen(open, returnFocus = null) {
                taskComposerOpen = open;
                if (open) taskComposerReturnFocus = returnFocus || document.activeElement;
                const composer = $("task-composer");
                composer.classList.toggle("hidden", !open);
                composer.classList.toggle("flex", open);
                $("covey-pages").inert =
                    setOpen || sheet || !!detailEvent || taskComposerOpen;
                if (open) {
                    $("task-composer-form").reset();
                    taskAssigneeIds = new Set();
                    renderTaskAssigneeOptions();
                    $("task-due-date").min = taskDateKey();
                    $("task-due-time").disabled = true;
                    $("task-composer-title").textContent = "Add a task";
                    $("task-create").textContent = "Add task";
                    $("task-create-status").textContent = "";
                    requestAnimationFrame(() => $("task-title").focus());
                } else {
                    const target = taskComposerReturnFocus;
                    taskComposerReturnFocus = null;
                    requestAnimationFrame(() => {
                        if (target?.isConnected) target.focus();
                        else $("addbtn")?.focus();
                    });
                }
            }
            function renderTaskAssigneeOptions() {
                const options = $("task-assignees");
                options.innerHTML = "";
                if (!people.length) {
                    options.append(
                        el("p", "task-assignee-empty", "No people have been added yet."),
                    );
                    return;
                }
                people.forEach((person) => {
                    const button = el("button", "task-assignee-option");
                    button.type = "button";
                    button.setAttribute(
                        "aria-pressed",
                        String(taskAssigneeIds.has(person.id)),
                    );
                    button.append(
                        avatarNode(person, 32),
                        el("span", "", person.name),
                    );
                    button.onclick = () => {
                        if (taskAssigneeIds.has(person.id))
                            taskAssigneeIds.delete(person.id);
                        else taskAssigneeIds.add(person.id);
                        button.setAttribute(
                            "aria-pressed",
                            String(taskAssigneeIds.has(person.id)),
                        );
                    };
                    options.append(button);
                });
            }
            async function createTask(event) {
                event.preventDefault();
                const button = $("task-create");
                if (button.disabled) return;
                const payload = {
                    title: $("task-title").value.trim(),
                    dueDate: $("task-due-date").value || null,
                    dueTime: $("task-due-time").value || null,
                    notes: $("task-notes").value.trim(),
                    assigneeIds: [...taskAssigneeIds],
                };
                if (!payload.title) return $("task-title").focus();
                button.disabled = true;
                button.setAttribute("aria-busy", "true");
                $("task-create-status").textContent = "Adding task…";
                try {
                    const response = await fetch("/api/tasks", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    });
                    const result = await response.json().catch(() => ({}));
                    if (!response.ok)
                        throw new Error(result.error || "Could not add task.");
                    householdTasks = mergeTaskResponse(householdTasks, result.task);
                    tasksStatus = "ready";
                    tasksMessage = `${result.task.title} added.`;
                    renderTaskSurfaces();
                    setTaskComposerOpen(false);
                } catch (error) {
                    $("task-create-status").textContent =
                        error.message || "Could not add task.";
                } finally {
                    button.disabled = false;
                    button.removeAttribute("aria-busy");
                }
            }
            async function setTaskCompleted(task, completed, button) {
                if (button.disabled) return;
                if (completed) {
                    button.disabled = true;
                    button.closest(".task-row")?.classList.add("is-completing");
                    if (soundsEnabled && taskCompleteSoundEnabled)
                        playTaskCompleteSound();
                    await new Promise((resolve) => setTimeout(resolve, 420));
                }
                const previous = task;
                const optimistic = {
                    ...task,
                    status: completed ? "completed" : "open",
                    completedAt: completed ? new Date().toISOString() : null,
                };
                householdTasks = mergeTaskResponse(householdTasks, optimistic);
                tasksMessage = `${task.title} ${completed ? "completed" : "reopened"}.`;
                renderTaskSurfaces();
                try {
                    const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/${completed ? "complete" : "reopen"}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ revision: task.revision }),
                    });
                    const result = await response.json().catch(() => ({}));
                    if (response.status === 409) {
                        if (result.current) householdTasks = mergeTaskResponse(householdTasks, result.current);
                        tasksMessage = "This task changed on another device. Tasks were refreshed.";
                        renderTaskSurfaces();
                        await fetchTasks();
                        return;
                    }
                    if (!response.ok) throw new Error(result.error || "Could not update task.");
                    householdTasks = mergeTaskResponse(householdTasks, result.task);
                    renderTaskSurfaces();
                } catch (error) {
                    householdTasks = mergeTaskResponse(householdTasks, previous);
                    tasksMessage = `${error.message || "Could not update task."} Your change was undone.`;
                    renderTaskSurfaces();
                }
            }
            function taskRow(task, completed = false) {
                const row = el("article", `task-row${completed ? " is-done" : ""}`);
                const check = el("button", `task-check${completed ? " is-checked" : ""}`);
                check.type = "button";
                check.setAttribute("aria-label", `${completed ? "Reopen" : "Complete"} ${task.title}`);
                check.append(el("span"));
                if (completed) check.firstElementChild.innerHTML = ic("check", 16);
                check.onclick = (event) => {
                    event.stopPropagation();
                    setTaskCompleted(task, !completed, check);
                };
                const copy = el("div", "task-copy");
                copy.append(el("h3", "", task.title));
                const meta = el("p", task.dueDate && task.dueDate < taskDateKey() ? "is-overdue" : "", completed
                    ? `Completed${task.completedAt ? " " + new Date(task.completedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}`
                    : taskDueText(task));
                copy.append(meta);
                row.append(check, copy);
                const pile = taskFacePile(task);
                if (pile) row.append(pile);
                return row;
            }
            function renderTasksPage() {
                const page = $("tasks-page");
                if (!page) return;
                page.innerHTML = "";
                const shell = el("div", "tasks-screen");
                const header = el("header", "tasks-header");
                const heading = el("div");
                heading.append(
                    el("p", "tasks-date", new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })),
                    el("h1", "", "Tasks"),
                );
                const openCount = householdTasks.filter((task) => task.status !== "completed").length;
                const summary = el("div", "tasks-summary");
                summary.append(el("strong", "", String(openCount)), el("span", "", "left to do"));
                header.append(heading, summary);
                const content = el("main", "tasks-scroll");
                content.setAttribute("aria-busy", String(tasksStatus === "loading" || tasksStatus === "refreshing"));
                if (tasksStatus === "loading") {
                    content.append(el("div", "tasks-state", "Loading household tasks…"));
                } else if (tasksStatus === "error" && !householdTasks.length) {
                    const state = el("div", "tasks-state");
                    state.append(el("h2", "", "Tasks aren’t available"), el("p", "", tasksMessage));
                    const retry = el("button", "tasks-retry", "Try again");
                    retry.onclick = () => fetchTasks({ announce: true });
                    state.append(retry);
                    content.append(state);
                } else {
                    const grouped = groupTasks(householdTasks);
                    const sections = [
                        ["overdue", "Overdue"], ["today", "Today"],
                        ["upcoming", "Upcoming"], ["anytime", "Anytime"],
                    ];
                    sections.forEach(([key, label]) => {
                        if (!grouped[key].length) return;
                        const section = el("section", `task-section${key === "overdue" ? " danger-section" : ""}`);
                        const title = el("div", "task-section-heading");
                        title.append(el("h2", "", label), el("span", "", String(grouped[key].length)));
                        section.append(title, ...grouped[key].map((task) => taskRow(task)));
                        content.append(section);
                    });
                    if (!openCount) {
                        const empty = el("div", "tasks-empty");
                        empty.innerHTML = `${ic("check", 28)}<h2>Everything’s taken care of</h2><p>Your household is all caught up.</p>`;
                        content.append(empty);
                    }
                    if (grouped.completed.length) {
                        const details = el("details", "tasks-completed");
                        const summaryNode = el("summary");
                        summaryNode.append(el("span", "", "Completed"), el("b", "", String(grouped.completed.length)));
                        const arrow = el("span", "tasks-completed-arrow");
                        arrow.innerHTML = ic("chevron-down", 17);
                        summaryNode.append(arrow);
                        const list = el("div", "tasks-completed-list");
                        grouped.completed.forEach((task) => list.append(taskRow(task, true)));
                        details.append(summaryNode, list);
                        content.append(details);
                    }
                }
                const status = el("output", "sr-only tasks-live", tasksMessage);
                status.setAttribute("aria-live", "polite");
                shell.append(header, content, status);
                page.append(shell);
            }
            function renderTaskSurfaces() {
                renderTasksPage();
                if (todayOverlayOpen) renderTodayOverlay(true);
            }

            function renderWhoOptions() {
                const options = $("who-options");
                options.innerHTML = "";
                people.forEach((person) => {
                    const selected = selectedPersonIds.has(person.id),
                        button = el(
                            "button",
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-sm font-medium " +
                                (selected
                                    ? "border-accent bg-accent/10 ring-1 ring-accent"
                                    : "border-line bg-bg"),
                        );
                    button.type = "button";
                    button.setAttribute("aria-pressed", selected);
                    button.setAttribute(
                        "aria-label",
                        (selected ? "Remove " : "Add ") + person.name,
                    );
                    button.append(
                        avatarNode(person, 20),
                        el("span", null, person.name),
                    );
                    button.onclick = () => {
                        if (selected) selectedPersonIds.delete(person.id);
                        else selectedPersonIds.add(person.id);
                        personSelectionTouched = true;
                        renderWhoOptions();
                    };
                    options.append(button);
                });
            }
            function syncTitlePeople(title) {
                if (personSelectionTouched) return;
                selectedPersonIds = new Set(
                    personTitleMatches(title).map((person) => person.id),
                );
                renderWhoOptions();
            }
            function personTitleMatches(title) {
                const normalized = title.toLocaleLowerCase().replace(/’/g, "'"),
                    isWordCharacter = (character) =>
                        !!character && /[\p{L}\p{N}]/u.test(character),
                    occurrences = [];
                people.forEach((person) => {
                    const name = person.name.toLocaleLowerCase().replace(/’/g, "'");
                    let start = -1;
                    while ((start = normalized.indexOf(name, start + 1)) >= 0) {
                        const before = normalized[start - 1] || "";
                        let end = start + name.length;
                        if (normalized.slice(end, end + 2) === "'s") end += 2;
                        const after = normalized[end] || "";
                        if (!isWordCharacter(before) && !isWordCharacter(after))
                            occurrences.push({ person, start, end, nameLength: name.length });
                    }
                });
                const matchedIds = new Set(
                    occurrences
                        .filter(
                            (occurrence) =>
                                !occurrences.some(
                                    (other) =>
                                        other.person.id !== occurrence.person.id &&
                                        other.nameLength > occurrence.nameLength &&
                                        other.start <= occurrence.start &&
                                        other.end >= occurrence.end,
                                ),
                        )
                        .map((occurrence) => occurrence.person.id),
                );
                return people.filter((person) => matchedIds.has(person.id));
            }
            // All server-backed event operations go through this small JSON API
            // wrapper so errors are surfaced consistently in the UI.
            async function api(method, url, body) {
                const r = await fetch(url, {
                    method,
                    headers: body ? { "Content-Type": "application/json" } : {},
                    body: body ? JSON.stringify(body) : undefined,
                });
                let j = null;
                try {
                    j = await r.json();
                } catch (e) {}
                if (!r.ok) {
                    if (
                        r.status === 404 &&
                        method === "POST" &&
                        (url === "/api/config/calendars" ||
                            url === "/api/config/people")
                    ) {
                        throw new Error(
                            "The running server is out of date. Stop and restart Covey to load the latest settings API.",
                        );
                    }
                    const message = (j && j.error) || `Request failed (HTTP ${r.status})`;
                    if (
                        r.status === 400 &&
                        method === "POST" &&
                        url === "/api/config/calendars" &&
                        ["users", "baby"].includes(body?.icon) &&
                        /available.*icons/i.test(message)
                    ) {
                        throw new Error(
                            "The running server has an older calendar icon list. Stop and restart Covey, then refresh the page to use People or Kids icons.",
                        );
                    }
                    throw new Error(message);
                }
                return j;
            }
            const mkey = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1);
            function months() {
                if (view === "month") return [mkey(cur)];
                return [
                    ...new Set([
                        mkey(parse(wstart)),
                        mkey(parse(addDays(wstart, days - 1))),
                    ]),
                ];
            }
            // Load only the months needed by the current view. In preview mode,
            // the same filtering is performed against the local event store.
            async function load() {
                try {
                    const requestedMonths = months();
                    const p = await Promise.all(
                        requestedMonths.map((k) =>
                            demo
                                ? local.filter((e) => e.d.startsWith(k))
                                : api("GET", "/api/events?month=" + k),
                        ),
                    );
                    ev = p.flat();
                    loadedMonths = requestedMonths;
                    status("");
                    syncState = "ok";
                    lastSyncAt = new Date();
                } catch (e) {
                    status("Can't reach iCloud: " + e.message);
                    syncState = "error";
                }
                updateSyncBadge();
                render();
            }
            function go(dir) {
                needScroll = true;
                armIdleReset();
                if (view === "month") {
                    cur.setMonth(cur.getMonth() + dir);
                    const t = new Date();
                    sel = mkey(cur) === mkey(t) ? iso(t) : iso(cur);
                } else {
                    wstart = addDays(wstart, dir * days);
                    sel = wstart;
                    const d = parse(wstart);
                    cur = new Date(d.getFullYear(), d.getMonth(), 1);
                }
                load();
            }
            function setView(v) {
                needScroll = true;
                armIdleReset();
                if (v !== "month" && view === "month")
                    wstart = days === 7 ? sunday(sel) : sel;
                if (v === "month") {
                    const d = parse(wstart);
                    cur = new Date(d.getFullYear(), d.getMonth(), 1);
                    if (mkey(parse(sel)) !== mkey(cur)) sel = iso(cur);
                }
                view = v;
                saveSet();
                load();
            }
            function setDays(n) {
                needScroll = true;
                armIdleReset();
                days = n;
                if (n === 7) wstart = sunday(wstart);
                saveSet();
                load();
            }
            // Theme changes are delegated to theme.js; this layer decides which
            // mode is currently effective, including temporary manual overrides.
            const sysMode = () =>
                matchMedia("(prefers-color-scheme: dark)").matches
                    ? "dark"
                    : "light";
            function eff() {
                const sc = auto ? GT.sched(dFrom, dTo) : null;
                if (ovr && sc !== ovr.base) ovr = null;
                return ovr ? ovr.mode : auto ? sc : manual || sysMode();
            }
            function paint() {
                GT.apply(pal, eff());
                document.body.dataset.ambientTheme = pal;
                document.body.dataset.ambientMode = eff();
                if ($("darkmode")) $("darkmode").checked = eff() === "dark";
            }
            function setDarkMode(enabled) {
                const nx = enabled ? "dark" : "light";
                if (auto) ovr = { mode: nx, base: GT.sched(dFrom, dTo) };
                else {
                    manual = nx;
                    try {
                        localStorage.setItem("gaggle-theme", nx);
                    } catch (e) {}
                }
                paint();
                if (setOpen) render();
            }
            matchMedia("(prefers-color-scheme: dark)").addEventListener(
                "change",
                () => {
                    paint();
                    if (setOpen) render();
                },
            );
            function tick() {
                paint();
                const n = new Date();
                updateSyncBadge();
                checkTodayView(n);
                refreshTodayWeatherIfDue(n);
            }
            function renderTodaySettings() {
                $("today-enabled").checked = todayViewEnabled;
                $("sounds-enabled").checked = soundsEnabled;
                $("today-event-chime").checked = todayEventChimeEnabled;
                $("task-complete-sound").checked = taskCompleteSoundEnabled;
                $("today-event-chime").disabled = !soundsEnabled;
                $("task-complete-sound").disabled = !soundsEnabled;
                $("today-chime-volume").value = todayEventChimeVolume;
                $("today-chime-volume-value").textContent = `${todayEventChimeVolume}%`;
                $("today-chime-volume").disabled = !soundsEnabled;
                $("today-chime-preview").disabled =
                    !soundsEnabled || !todayEventChimeEnabled;
                $("task-complete-preview").disabled =
                    !soundsEnabled || !taskCompleteSoundEnabled;
                $("sound-volume-controls").setAttribute(
                    "aria-disabled",
                    String(!soundsEnabled),
                );
                $("today-preview").disabled = !todayViewEnabled;
                document.querySelectorAll("[data-ambient-preview]").forEach((button) => {
                    button.disabled = !todayViewEnabled;
                    button.classList.toggle("opacity-50", !todayViewEnabled);
                });
                $("today-weather-enabled").checked = todayWeatherEnabled;
                $("today-temperature-unit").value = todayTemperatureUnit;
                if (document.activeElement !== $("today-weather-location"))
                    $("today-weather-location").value = todayWeatherLocation;
                $("today-temperature-unit").disabled = !todayWeatherEnabled;
                $("today-weather-location").disabled = !todayWeatherEnabled;
                $("today-weather-location-save").disabled =
                    !todayWeatherEnabled ||
                    !$("today-weather-location").value.trim();
                $("today-weather-fields").style.opacity = todayWeatherEnabled
                    ? "1"
                    : ".55";
                $("today-weather-fields").setAttribute(
                    "aria-disabled",
                    String(!todayWeatherEnabled),
                );
            }
            function ensureTodayEvents(date) {
                if (demo) {
                    todayEventCacheDate = date;
                    todayEventCache = local.filter((event) => event.d === date);
                    todayEventsError = "";
                    return;
                }
                const month = mkey(parse(date));
                if (loadedMonths.includes(month)) {
                    todayEventCacheDate = date;
                    todayEventCache = ev.filter((event) => event.d === date);
                    todayEventsLoadingFor = "";
                    todayEventsError = "";
                    return;
                }
                if (todayEventCacheDate === date || todayEventsLoadingFor === date) return;
                todayEventsLoadingFor = date;
                todayEventsError = "";
                api("GET", "/api/events?month=" + month)
                    .then((events) => {
                        if (todayEventsLoadingFor !== date) return;
                        todayEventCacheDate = date;
                        todayEventCache = events.filter((event) => event.d === date);
                        todayEventsLoadingFor = "";
                        todayEventsError = "";
                        renderTodayOverlay(true);
                    })
                    .catch((error) => {
                        if (todayEventsLoadingFor !== date) return;
                        todayEventCacheDate = date;
                        todayEventCache = [];
                        todayEventsLoadingFor = "";
                        todayEventsError = error.message || "Could not load today’s events.";
                        renderTodayOverlay(true);
                    });
            }
            function ensureTomorrowEvents(date) {
                if (demo) {
                    tomorrowEventCacheDate = date;
                    tomorrowEventCache = local.filter((event) => event.d === date);
                    tomorrowEventsError = "";
                    return;
                }
                const month = mkey(parse(date));
                if (loadedMonths.includes(month)) {
                    tomorrowEventCacheDate = date;
                    tomorrowEventCache = ev.filter((event) => event.d === date);
                    tomorrowEventsLoadingFor = "";
                    tomorrowEventsError = "";
                    return;
                }
                if (
                    tomorrowEventCacheDate === date ||
                    tomorrowEventsLoadingFor === date
                )
                    return;
                tomorrowEventsLoadingFor = date;
                tomorrowEventsError = "";
                api("GET", "/api/events?month=" + month)
                    .then((events) => {
                        if (tomorrowEventsLoadingFor !== date) return;
                        tomorrowEventCacheDate = date;
                        tomorrowEventCache = events.filter(
                            (event) => event.d === date,
                        );
                        tomorrowEventsLoadingFor = "";
                        tomorrowEventsError = "";
                        renderTodayOverlay(true);
                    })
                    .catch((error) => {
                        if (tomorrowEventsLoadingFor !== date) return;
                        tomorrowEventsLoadingFor = "";
                        tomorrowEventsError =
                            error.message || "Could not load tomorrow’s events.";
                        renderTodayOverlay(true);
                    });
            }
            function retryTodayEvents() {
                todayEventCacheDate = "";
                todayEventsError = "";
                ensureTodayEvents(iso(new Date()));
                renderTodayOverlay(true);
            }
            function visibleTodayEvents(date) {
                return (todayEventCacheDate === date ? todayEventCache : [])
                    .filter((event) => event.d === date)
                    .filter((event) => {
                        const custom = event.calendarId &&
                            !["event", "reminder", "dinner"].includes(event.calendarId);
                        if (custom) return !hide["calendar:" + event.calendarId];
                        return K[event.kind] ? !hide[event.kind] : !hide.event;
                    })
                    .sort((a, b) => (a.tm || "").localeCompare(b.tm || ""));
            }
            function visibleTomorrowEvents(date) {
                return (tomorrowEventCacheDate === date
                    ? tomorrowEventCache
                    : []
                )
                    .filter((event) => event.d === date)
                    .filter((event) => {
                        const custom =
                            event.calendarId &&
                            !["event", "reminder", "dinner"].includes(
                                event.calendarId,
                            );
                        if (custom)
                            return !hide["calendar:" + event.calendarId];
                        return K[event.kind]
                            ? !hide[event.kind]
                            : !hide.event;
                    })
                    .sort((a, b) => (a.tm || "").localeCompare(b.tm || ""));
            }

            const COVEY_PAGES = ["glance", "calendar", "tasks"];
            function openGlobalSettings(returnFocus = document.activeElement) {
                settingsReturnFocus = returnFocus;
                setOpen = true;
                render();
            }
            function restoreSettingsFocus() {
                const target = settingsReturnFocus;
                settingsReturnFocus = null;
                requestAnimationFrame(() => {
                    if (target?.isConnected) target.focus();
                    else $("setbtn")?.focus();
                });
            }
            function alignPagePagination() {
                const controls = $("surface-controls");
                const footer = $("today-overlay").querySelector(
                    ".ambient-glance-footer",
                );
                if (!footer) return;
                const viewport = $("covey-pages").getBoundingClientRect();
                const footerBounds = footer.getBoundingClientRect();
                const footerCenter = footerBounds.top + footerBounds.height / 2;
                const bottom = Math.max(
                    0,
                    viewport.bottom - footerCenter - controls.offsetHeight / 2,
                );
                controls.style.bottom = `${bottom}px`;
            }
            function setActivePage(page, { userInitiated = false, focus = false } = {}) {
                if (!COVEY_PAGES.includes(page)) return;
                activePage = page;
                const shell = $("covey-pages");
                const track = $("covey-page-track");
                shell.dataset.activePage = page;
                track.classList.remove("is-dragging");
                track.style.removeProperty("transform");
                COVEY_PAGES.forEach((name) => {
                    const section = $(`${name}-page`);
                    const current = name === page;
                    section.inert = !current;
                    section.setAttribute("aria-hidden", String(!current));
                    const control = document.querySelector(`[data-page="${name}"]`);
                    if (current) control.setAttribute("aria-current", "page");
                    else control.removeAttribute("aria-current");
                });
                document.body.classList.toggle("calendar-page-active", page === "calendar");
                const add = $("addbtn");
                add.hidden = page === "glance";
                add.setAttribute("aria-label", page === "tasks" ? "Add task" : "Add event");
                add.querySelector("span").textContent = page === "tasks" ? "Add task" : "Add event";
                if (userInitiated) {
                    ambientReadyAt = Date.now() + AMBIENT_IDLE_MS;
                    wakeChrome();
                }
                if (page !== "glance" && todayOverlayOpen?.preview)
                    todayOverlayOpen.preview = false;
                if (page === "glance") renderTodayOverlay(true);
                else if (page === "tasks") {
                    renderTasksPage();
                    fetchTasks({ announce: tasksStatus === "ready" });
                }
                requestAnimationFrame(alignPagePagination);
                if (focus)
                    document.querySelector(`[data-page="${page}"]`)?.focus();
            }
            function openTodayOverlay(slot, preview = false, navigate = true) {
                const date = iso(new Date());
                todayWeatherPanelOpen = false;
                todayOverlayOpen = {
                    slot,
                    preview,
                    key: date + ":" + (preview ? "preview" : slot),
                };
                todayOverlaySignature = "";
                ambientCurrentEventKeys = null;
                renderTodayOverlay(true);
                if (navigate) setActivePage("glance");
            }
            function navigateAmbientWeather(open) {
                if (!todayOverlayOpen || todayWeatherTransitioning || open === todayWeatherPanelOpen)
                    return;
                const overlay = $("today-overlay");
                const page = overlay.querySelector(".ambient-page");
                const glance = overlay.querySelector(".ambient-glance");
                const forecast = overlay.querySelector(".ambient-forecast-view");
                if (!page || !glance || !forecast) return;
                todayWeatherTransitioning = true;
                todayWeatherPanelOpen = open;
                if (open) {
                    $("surface-controls").hidden = true;
                }
                const source = open ? glance : forecast;
                const destination = open ? forecast : glance;
                destination.hidden = false;
                source.inert = true;
                destination.inert = true;
                page.dataset.ambientNavigating = "true";
                const finish = () => {
                    clearTimeout(todayWeatherTransitionTimer);
                    todayWeatherTransitionTimer = null;
                    source.hidden = true;
                    source.inert = true;
                    source.setAttribute("aria-hidden", "true");
                    destination.hidden = false;
                    destination.inert = false;
                    destination.setAttribute("aria-hidden", "false");
                    page.removeAttribute("data-ambient-navigating");
                    todayWeatherTransitioning = false;
                    if (!open) {
                        $("surface-controls").hidden = false;
                        requestAnimationFrame(alignPagePagination);
                    }
                    (open ? $("ambient-weather-back") : $("ambient-weather-open"))?.focus();
                };
                if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                    page.dataset.ambientView = open ? "forecast" : "glance";
                    finish();
                    return;
                }
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    page.dataset.ambientView = open ? "forecast" : "glance";
                    todayWeatherTransitionTimer = setTimeout(finish, 380);
                }));
            }
            function checkTodayView(now = new Date()) {
                if (todayOverlayOpen?.preview && activePage === "glance") return;
                const slot = ambientPeriod(now);
                const key = localDateKey(now) + ":" + slot;
                if (todayOverlayOpen?.key !== key)
                    openTodayOverlay(slot, false, false);
                else renderTodayOverlay();
                if (
                    todayViewEnabled &&
                    Date.now() >= ambientReadyAt &&
                    !setOpen &&
                    !sheet &&
                    !detailEvent &&
                    activePage !== "glance"
                )
                    setActivePage("glance");
            }
            function formatTodayTemperature(value) {
                if (!Number.isFinite(value)) return "—";
                const temperature = todayTemperatureUnit === "C" ? (value - 32) * 5 / 9 : value;
                return Math.round(temperature) + "°" + todayTemperatureUnit;
            }
            function weatherIcon(code, isDay) {
                if (code === 0) return isDay ? "sun" : "moon";
                if ([1, 2].includes(code)) return isDay ? "cloud-sun" : "cloud-moon";
                if (code === 3) return "cloud";
                if ([45, 48].includes(code)) return "cloud-fog";
                if ([51, 53, 55, 56, 57].includes(code)) return "cloud-drizzle";
                if ([80, 81, 82].includes(code)) return isDay ? "cloud-sun-rain" : "cloud-rain";
                if ([61, 63, 65, 66, 67].includes(code)) return "cloud-rain";
                if ([71, 73, 75, 77, 85, 86].includes(code)) return "cloud-snow";
                if ([95, 96, 99].includes(code)) return "cloud-lightning";
                return "cloud";
            }
            function refreshTodayWeatherIfDue(now = new Date()) {
                if (
                    !todayOverlayOpen ||
                    !todayWeatherEnabled ||
                    !todayWeatherLocation ||
                    todayWeatherStatus === "loading" ||
                    !todayWeatherLastRequestAt ||
                    now.getTime() - todayWeatherLastRequestAt < 15 * 60 * 1000
                )
                    return;
                todayWeatherStatus = "idle";
                loadTodayWeather();
            }
            function weatherDescription(code) {
                if (code === 0) return "Clear skies";
                if ([1, 2].includes(code)) return "Partly cloudy";
                if (code === 3) return "Cloudy";
                if ([45, 48].includes(code)) return "Foggy";
                if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
                if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
                if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
                if ([95, 96, 99].includes(code)) return "Thunderstorms";
                return "Current conditions";
            }
            function weatherConditionTone(code, isDay) {
                if (!isDay) return "night";
                if (code === 0) return "sunny";
                if ([1, 2, 3].includes(code)) return "cloudy";
                if ([45, 48].includes(code)) return "fog";
                if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
                if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
                if ([95, 96, 99].includes(code)) return "storm";
                return "cloudy";
            }

            async function loadTodayWeather() {
                if (
                    !todayWeatherEnabled ||
                    !todayWeatherLocation ||
                    todayWeatherStatus === "loading"
                )
                    return;
                const location = todayWeatherLocation;
                const requestDate = iso(new Date());
                todayWeatherRequestDate = requestDate;
                todayWeatherLastRequestAt = Date.now();
                todayWeatherStatus = "loading";
                todayWeatherMessage = "";
                renderTodayOverlay(true);
                try {
                    const geocodeQuery = new URLSearchParams({
                        name: location,
                        count: "1",
                        language: "en",
                        format: "json",
                    });
                    const geocodeResponse = await fetch(
                        "https://geocoding-api.open-meteo.com/v1/search?" + geocodeQuery,
                    );
                    if (!geocodeResponse.ok)
                        throw new Error("Location search is unavailable.");
                    const places = await geocodeResponse.json();
                    const place = places.results?.[0];
                    if (!place)
                        throw new Error("Could not find that city or postal code.");
                    const query = new URLSearchParams({
                        latitude: String(place.latitude),
                        longitude: String(place.longitude),
                        current: "temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m",
                        hourly: "temperature_2m,precipitation_probability,weather_code,is_day",
                        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset",
                        temperature_unit: "fahrenheit",
                        timezone: place.timezone || "auto",
                        forecast_days: "5",
                    });
                    const response = await fetch(
                        "https://api.open-meteo.com/v1/forecast?" + query,
                    );
                    if (!response.ok) throw new Error("Weather service is unavailable.");
                    const forecast = await response.json();
                    if (
                        location !== todayWeatherLocation ||
                        requestDate !== iso(new Date()) ||
                        todayWeatherRequestDate !== requestDate
                    )
                        return;
                    todayWeather = {
                        date: requestDate,
                        location: [place.name, place.admin1, place.country]
                            .filter((part, index, parts) => part && parts.indexOf(part) === index)
                            .join(", "),
                        temperature: forecast.current?.temperature_2m,
                        code: forecast.current?.weather_code ?? forecast.daily?.weather_code?.[0],
                        isDay: forecast.current?.is_day === 1,
                        feelsLike: forecast.current?.apparent_temperature,
                        wind: forecast.current?.wind_speed_10m,
                        high: forecast.daily?.temperature_2m_max?.[0],
                        low: forecast.daily?.temperature_2m_min?.[0],
                        rain: forecast.daily?.precipitation_probability_max?.[0],
                        sunset: forecast.daily?.sunset?.[0],
                        hourly: (forecast.hourly?.time || []).map((time, index) => ({
                            time,
                            temperature: forecast.hourly?.temperature_2m?.[index],
                            rain: forecast.hourly?.precipitation_probability?.[index],
                            code: forecast.hourly?.weather_code?.[index],
                            isDay: forecast.hourly?.is_day?.[index] === 1,
                        })),
                        daily: (forecast.daily?.time || []).map((day, index) => ({
                            day,
                            code: forecast.daily?.weather_code?.[index],
                            high: forecast.daily?.temperature_2m_max?.[index],
                            low: forecast.daily?.temperature_2m_min?.[index],
                            rain: forecast.daily?.precipitation_probability_max?.[index],
                            wind: forecast.daily?.wind_speed_10m_max?.[index],
                            sunrise: forecast.daily?.sunrise?.[index],
                            sunset: forecast.daily?.sunset?.[index],
                        })),
                    };
                    todayWeatherStatus = "ready";
                } catch (error) {
                    if (
                        requestDate !== iso(new Date()) ||
                        todayWeatherRequestDate !== requestDate ||
                        location !== todayWeatherLocation
                    )
                        return;
                    todayWeatherStatus = "error";
                    todayWeatherMessage = error.message || "Could not load the forecast.";
                }
                renderTodayOverlay(true);
            }
            function renderTodayOverlay(force = false) {
                const overlay = $("today-overlay");
                const active = todayOverlayOpen;
                $("covey-pages").inert =
                    setOpen || sheet || !!detailEvent || taskComposerOpen;
                if (!active) {
                    todayOverlaySignature = "";
                    return;
                }
                if (todayWeatherTransitioning) return;
                const date = iso(new Date());
                const tomorrowDate = addDays(date, 1);
                if (
                    (todayWeather && todayWeather.date !== date) ||
                    (todayWeatherRequestDate && todayWeatherRequestDate !== date)
                ) {
                    todayWeather = null;
                    todayWeatherRequestDate = "";
                    todayWeatherStatus = "idle";
                    todayWeatherMessage = "";
                    todayWeatherLastRequestAt = 0;
                }
                ensureTodayEvents(date);
                ensureTomorrowEvents(tomorrowDate);
                const todayEvents = visibleTodayEvents(date);
                const tomorrowEvents = visibleTomorrowEvents(tomorrowDate);
                const now = new Date();
                const ambientModel = classifyAmbientEvents(
                    [...todayEvents, ...tomorrowEvents],
                    now,
                );
                const startedEvent = !active.preview && !todayWeatherPanelOpen
                    ? newlyStartedAmbientEvent(
                        ambientModel.current,
                        ambientCurrentEventKeys,
                    )
                    : null;
                ambientCurrentEventKeys = new Set(
                    ambientModel.current.map(ambientEventKey),
                );
                const remainingEvents = [
                    ...ambientModel.allDay,
                    ...ambientModel.current,
                    ...ambientModel.upcoming,
                ];
                const events =
                    active.slot === "morning"
                        ? todayEvents
                        : active.slot === "night"
                          ? tomorrowEvents
                          : remainingEvents;
                const signature = JSON.stringify([
                    active.key,
                    date,
                    now.getHours(),
                    now.getMinutes(),
                    todayEvents.map((event) => [
                        event.url,
                        event.id,
                        event.t,
                        event.tm,
                        event.te,
                        event.kind,
                        eventMemberName(event),
                        peopleForEvent(event).map((person) => [
                            person.id,
                            person.name,
                            person.avatar,
                            person.image,
                        ]),
                    ]),
                    todayEventsLoadingFor === date,
                    todayEventsError,
                    tomorrowEvents.map((event) => [
                        event.url,
                        event.id,
                        event.t,
                        event.tm,
                        event.te,
                        event.kind,
                    ]),
                    tomorrowEventsLoadingFor === tomorrowDate,
                    tomorrowEventsError,
                    todayWeatherEnabled,
                    todayWeatherLocation,
                    todayTemperatureUnit,
                    todayWeatherStatus,
                    todayWeather,
                    todayWeatherMessage,
                    householdTasks.map((task) => [task.id, task.status, task.revision, task.title, task.dueDate, task.dueTime]),
                ]);
                if (!force && signature === todayOverlaySignature) return;
                const focusedId = overlay.contains(document.activeElement)
                    ? document.activeElement.id
                    : "";
                overlay.innerHTML = "";
                overlay.setAttribute("role", "region");
                overlay.removeAttribute("aria-modal");
                overlay.setAttribute("aria-label", "Family calendar for today");
                overlay.onkeydown = (event) => {
                    if (event.key === "Escape") {
                        if (todayWeatherTransitioning) return;
                        if (todayWeatherPanelOpen) {
                            event.preventDefault();
                            event.stopPropagation();
                            navigateAmbientWeather(false);
                        }
                    }
                };
                const page = el("main", "ambient-page");
                const layerState = ambientLayerState(todayWeatherPanelOpen);
                $("surface-controls").hidden = todayWeatherPanelOpen;
                page.dataset.ambientView = layerState.view;
                page.dataset.ambientTheme = pal;
                page.dataset.ambientMode = eff();
                page.dataset.condition = todayWeather
                    ? weatherConditionTone(todayWeather.code, todayWeather.isDay)
                    : "calm";
                const drift = el("div", "ambient-drift");
                drift.setAttribute("aria-hidden", "true");
                drift.append(el("span"), el("span"), el("span"));
                page.append(drift, el("div", "ambient-grain"));
                const content = el("div", "ambient-glance ambient-pane");
                content.hidden = layerState.briefingHidden;
                content.inert = layerState.briefingHidden;
                content.setAttribute("aria-hidden", String(layerState.briefingHidden));
                const header = el("header", "ambient-glance-header");
                const dateTime = el("div");
                dateTime.append(
                    el("p", "ambient-date", now.toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                    })),
                    el("h1", "ambient-clock", formatTime(now, {
                        hour: "numeric",
                        minute: "2-digit",
                    })),
                );
                const weatherState = ambientWeatherState({
                    enabled: todayWeatherEnabled,
                    location: todayWeatherLocation,
                    status: todayWeatherStatus,
                    weather: todayWeather,
                });
                const weatherButton = el("button", "ambient-weather-summary");
                weatherButton.id = "ambient-weather-open";
                weatherButton.type = "button";
                weatherButton.setAttribute("aria-haspopup", "dialog");
                const weatherIconNode = el("span", "ambient-weather-summary-icon");
                weatherIconNode.innerHTML = ic(
                    todayWeather
                        ? weatherIcon(todayWeather.code, todayWeather.isDay)
                        : "cloud",
                    36,
                );
                const weatherCopy = el("span", "ambient-weather-summary-copy");
                const weatherPrimary = weatherState === "ready"
                    ? formatTodayTemperature(todayWeather.temperature)
                    : weatherState === "loading"
                      ? "Loading"
                      : "Weather";
                const weatherSecondary = weatherState === "ready"
                    ? weatherDescription(todayWeather.code)
                    : weatherState === "needs-location"
                      ? "Choose a location"
                      : weatherState === "off"
                        ? "Turned off"
                        : weatherState === "error"
                          ? "Forecast unavailable"
                          : todayWeatherLocation;
                weatherCopy.append(
                    el("strong", null, weatherPrimary),
                    el("small", null, weatherSecondary),
                );
                weatherButton.append(weatherIconNode, weatherCopy);
                weatherButton.insertAdjacentHTML("beforeend", ic("chevron-right", 18));
                weatherButton.setAttribute(
                    "aria-label",
                    `Open weather forecast: ${weatherPrimary}, ${weatherSecondary}`,
                );
                weatherButton.onclick = () => {
                    navigateAmbientWeather(true);
                };
                header.append(dateTime, weatherButton);

                const glanceMain = el("div", "ambient-glance-main");
                const focusEvent = selectAmbientFocus(ambientModel, active.slot);
                const focusPanel = el("section", "ambient-next-panel");
                if (startedEvent && focusEvent === startedEvent)
                    focusPanel.classList.add("is-starting");
                focusPanel.setAttribute("aria-labelledby", "ambient-next-title");
                const focusKicker = el("div", "ambient-next-kicker");
                focusKicker.append(el("span", "ambient-pulse"));
                let kicker = active.slot === "night" ? "First tomorrow" : "Up next";
                if (ambientModel.current.includes(focusEvent)) kicker = "Happening now";
                const remaining = focusEvent ? minutesUntil(focusEvent, now) : null;
                if (remaining > 0) {
                    const hours = Math.floor(remaining / 60);
                    const mins = remaining % 60;
                    kicker += hours ? ` · in ${hours}h ${mins ? mins + "m" : ""}` : ` · in ${mins}m`;
                }
                focusKicker.append(document.createTextNode(kicker));
                const focusTitle = el(
                    "h2",
                    null,
                    focusEvent?.t || (active.slot === "night" ? "Tomorrow is open" : "A little breathing room"),
                );
                focusTitle.id = "ambient-next-title";
                const focusTime = el(
                    "p",
                    "ambient-next-time",
                    focusEvent
                        ? focusEvent.tm
                            ? trange(focusEvent)
                            : "All day"
                        : "Nothing else is scheduled.",
                );
                focusPanel.append(focusKicker, focusTitle, focusTime);
                if (startedEvent) {
                    const announcement = el(
                        "p",
                        "sr-only",
                        `Starting now: ${startedEvent.t || "Calendar event"}`,
                    );
                    announcement.setAttribute("role", "status");
                    announcement.setAttribute("aria-live", "polite");
                    focusPanel.append(announcement);
                }
                if (focusEvent) {
                    const kind = ambientEventKind(focusEvent);
                    const metadata = el("div", "ambient-next-meta");
                    const kindIcon = el("span", "ambient-kind-icon");
                    kindIcon.innerHTML = ic(calendarForEvent(focusEvent)?.icon || kind.icon, 17);
                    const member = eventMemberName(focusEvent);
                    metadata.append(kindIcon, el("span", null, `${kind.label}${member ? " · " + member : ""}`));
                    focusPanel.append(metadata);
                }

                const scheduleEvents = active.slot === "night"
                    ? tomorrowEvents
                    : [...ambientModel.allDay, ...ambientModel.current, ...ambientModel.upcoming];
                const rail = el("aside", "ambient-day-rail");
                rail.setAttribute("aria-label", active.slot === "night" ? "Tomorrow" : "Rest of today");
                const railHeading = el("div", "ambient-rail-heading");
                railHeading.append(
                    el("h2", null, active.slot === "night" ? "Tomorrow" : "Rest of today"),
                    el("span", null, `${scheduleEvents.length} ${scheduleEvents.length === 1 ? "plan" : "plans"}`),
                );
                rail.append(railHeading);
                const eventsLoading = active.slot === "night"
                    ? tomorrowEventsLoadingFor === tomorrowDate
                    : todayEventsLoadingFor === date;
                const eventsError = active.slot === "night" ? tomorrowEventsError : todayEventsError;
                if (!scheduleEvents.length) {
                    rail.append(el("p", "ambient-empty", eventsLoading
                        ? "Checking the calendar…"
                        : eventsError || "Nothing else is planned."));
                } else {
                    scheduleEvents.slice(0, 4).forEach((event) => {
                        const kind = ambientEventKind(event);
                        const item = el("article", "ambient-rail-event ambient-kind-" + kind.key);
                        if (event === focusEvent) item.classList.add("is-next");
                        item.append(
                            el("time", null, event.tm ? tfmt(event.tm) : "All day"),
                            el("strong", null, event.t || "(no title)"),
                        );
                        const meta = el("span", "ambient-event-type");
                        meta.innerHTML = ic(calendarForEvent(event)?.icon || kind.icon, 13);
                        meta.append(document.createTextNode(`${kind.label} · ${eventMemberName(event)}`));
                        item.append(meta);
                        rail.append(item);
                    });
                    if (scheduleEvents.length > 4)
                        rail.append(el("p", "ambient-more", `+${scheduleEvents.length - 4} more on the calendar`));
                }
                const dayStack = el("div", "ambient-day-stack");
                dayStack.append(rail);
                const relevantTasks = selectGlanceTasks(householdTasks);
                if (relevantTasks.length) {
                    const taskModule = el("button", "ambient-task-module");
                    taskModule.type = "button";
                    taskModule.setAttribute("aria-label", `Open Tasks, ${relevantTasks.length} needing attention`);
                    const taskHeading = el("span", "ambient-task-heading");
                    taskHeading.append(el("strong", "", "Tasks"), el("small", "", String(relevantTasks.length)));
                    taskModule.append(taskHeading);
                    relevantTasks.forEach((task) => {
                        const item = el("span", "ambient-task-item");
                        item.append(el("span", "ambient-task-title", task.title));
                        const pile = taskFacePile(task, true);
                        if (pile) item.append(pile);
                        taskModule.append(item);
                    });
                    taskModule.onclick = () => setActivePage("tasks", { userInitiated: true });
                    dayStack.append(taskModule);
                }
                glanceMain.append(focusPanel, dayStack);
                const footer = el("footer", "ambient-glance-footer");
                const sync = el("span");
                sync.innerHTML = ic("check", 17);
                sync.append(document.createTextNode(
                    demo
                        ? "Saved on this device"
                        : syncState === "pending"
                          ? "Syncing…"
                          : syncState === "ok"
                            ? `Synced ${timeAgo(lastSyncAt) || "just now"}`
                            : lastSyncAt
                              ? `Offline · synced ${timeAgo(lastSyncAt)}`
                              : "Calendar unavailable",
                ));
                footer.append(sync);
                content.append(header, glanceMain, footer);

                const weatherView = el("section", "ambient-forecast-view ambient-pane");
                weatherView.hidden = layerState.forecastHidden;
                weatherView.inert = layerState.forecastHidden;
                weatherView.setAttribute("aria-hidden", String(layerState.forecastHidden));
                weatherView.setAttribute("aria-labelledby", "ambient-forecast-title");
                const weatherHeader = el("header", "ambient-forecast-header");
                const weatherBack = el("button", "ambient-weather-back", "Today");
                weatherBack.id = "ambient-weather-back";
                weatherBack.type = "button";
                weatherBack.insertAdjacentHTML("afterbegin", ic("arrow-left", 17));
                weatherBack.onclick = () => {
                    navigateAmbientWeather(false);
                };
                const weatherHeading = el("div");
                weatherHeading.append(
                    el("p", null, `${todayWeather?.location || todayWeatherLocation || "Local weather"} · ${now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}`),
                    el("h2", null, weatherState === "ready" ? weatherDescription(todayWeather.code) : "Weather forecast"),
                );
                weatherHeading.querySelector("h2").id = "ambient-forecast-title";
                const nowWeather = el("div", "ambient-weather-now");
                if (weatherState === "ready") {
                    nowWeather.innerHTML = ic(weatherIcon(todayWeather.code, todayWeather.isDay), 48);
                    nowWeather.append(
                        el("strong", null, formatTodayTemperature(todayWeather.temperature)),
                        el("span", null, Number.isFinite(todayWeather.feelsLike) ? `Feels like ${formatTodayTemperature(todayWeather.feelsLike)}` : "Current temperature"),
                    );
                }
                weatherHeader.append(weatherBack, weatherHeading, nowWeather);
                weatherView.append(weatherHeader);
                if (weatherState !== "ready") {
                    const weatherStatePanel = el("div", "ambient-weather-state");
                    weatherStatePanel.append(
                        el("h3", null, weatherState === "loading" ? "Loading the forecast" : weatherSecondary),
                        el("p", null, weatherState === "error"
                            ? todayWeatherMessage
                            : weatherState === "off"
                              ? "Turn weather on in Today settings."
                              : weatherState === "needs-location"
                                ? "Add a city or postal code in Today settings."
                                : "The local forecast will appear shortly."),
                    );
                    const stateAction = el("button", "ambient-weather-action", weatherState === "error" ? "Try again" : "Open weather settings");
                    stateAction.type = "button";
                    stateAction.onclick = weatherState === "error"
                        ? loadTodayWeather
                        : () => {
                              setTab = "today";
                              openGlobalSettings(stateAction);
                              $(todayWeatherEnabled ? "today-weather-location" : "today-weather-enabled")?.focus();
                          };
                    weatherStatePanel.append(stateAction);
                    weatherView.append(weatherStatePanel);
                } else {
                    const forecastLayout = el("div", "ambient-forecast-layout");
                    const planning = el("section", "ambient-planning-card");
                    planning.append(el("p", "ambient-weather-label", "Daily outlook"));
                    const outlook = todayWeather.rain >= 60
                        ? "Rain is likely today. Plan for wet trips and extra travel time."
                        : todayWeather.code === 0
                          ? "Clear conditions make today easy for time outside."
                          : todayWeather.rain >= 30
                            ? "A passing shower is possible. Keep a light layer nearby."
                            : "A comfortable day with changing cloud cover.";
                    planning.append(el("h3", null, outlook));
                    const lookouts = el("div", "ambient-lookouts");
                    const sunsetValue = todayWeather.sunset
                        ? formatTime(new Date(todayWeather.sunset), { hour: "numeric", minute: "2-digit" })
                        : "—";
                    [
                        ["umbrella", Number.isFinite(todayWeather.rain) ? todayWeather.rain + "%" : "—", "Rain chance"],
                        ["wind", Number.isFinite(todayWeather.wind) ? Math.round(todayWeather.wind) + " km/h" : "—", "Wind"],
                        ["sunset", sunsetValue, "Sunset"],
                    ].forEach(([iconName, value, label]) => {
                        const item = el("div");
                        item.innerHTML = ic(iconName, 22);
                        const copy = el("span");
                        copy.append(el("strong", null, value), document.createTextNode(label));
                        item.append(copy);
                        lookouts.append(item);
                    });
                    planning.append(lookouts);
                    const hourlyCard = el("section", "ambient-hourly-card");
                    const hourlyHeading = el("div", "ambient-forecast-card-heading");
                    hourlyHeading.append(el("h3", null, "Next few hours"), el("span", null, "Hourly"));
                    hourlyCard.append(hourlyHeading);
                    const hourlyStrip = el("div", "ambient-hourly-strip");
                    const currentHour = new Date();
                    currentHour.setMinutes(0, 0, 0);
                    const futureHourly = (todayWeather.hourly || [])
                        .filter((hour) => new Date(hour.time) >= currentHour)
                        .slice(0, 5);
                    futureHourly.forEach((hour, index) => {
                        const item = el("article", index === 0 ? "is-now" : "");
                        item.append(el("time", null, index === 0 ? "Now" : formatTime(new Date(hour.time), { hour: "numeric" })));
                        const hourIcon = el("span");
                        hourIcon.innerHTML = ic(weatherIcon(hour.code, hour.isDay), 30);
                        item.append(
                            hourIcon,
                            el("strong", null, formatTodayTemperature(hour.temperature)),
                            el("span", null, Number.isFinite(hour.rain) ? hour.rain + "%" : "—"),
                        );
                        hourlyStrip.append(item);
                    });
                    hourlyCard.append(hourlyStrip);
                    const weekCard = el("section", "ambient-week-card");
                    const weekHeading = el("div", "ambient-forecast-card-heading");
                    weekHeading.append(el("h3", null, "Next 5 days"), el("span", null, "High · Low"));
                    weekCard.append(weekHeading);
                    const weekGrid = el("div", "ambient-week-grid");
                    (todayWeather.daily || []).slice(0, 5).forEach((day, index) => {
                        const item = el("article");
                        item.append(el("time", null, index === 0 ? "Today" : new Date(day.day + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" })));
                        const dayIcon = el("span");
                        dayIcon.innerHTML = ic(weatherIcon(day.code, true), 36);
                        const temperatures = el("strong", null, formatTodayTemperature(day.high) + " ");
                        temperatures.append(el("span", null, formatTodayTemperature(day.low)));
                        item.append(dayIcon, temperatures, el("small", null, Number.isFinite(day.rain) ? day.rain + "%" : "—"));
                        weekGrid.append(item);
                    });
                    weekCard.append(weekGrid);
                    forecastLayout.append(planning, hourlyCard, weekCard);
                    weatherView.append(forecastLayout);
                }
                page.append(content, weatherView);
                overlay.append(page);
                todayOverlaySignature = signature;
                alignPagePagination();
                if (startedEvent && soundsEnabled && todayEventChimeEnabled)
                    playEventStartChime();
                if (focusedId) overlay.querySelector("#" + focusedId)?.focus();
                if (
                    todayWeatherEnabled &&
                    todayWeatherLocation &&
                    todayWeatherStatus === "idle"
                )
                    loadTodayWeather();
                else
                    refreshTodayWeatherIfDue();
            }
            renderWhoOptions();
            function openSheet(k) {
                sel = k;
                sheet = true;
                render();
            }
            function closeSheet() {
                sheet = false;
                render();
            }
            function openEventDetails(event) {
                detailReturnFocus = document.activeElement;
                detailEvent = event;
                render();
                $("event-detail-close").focus();
            }
            function closeEventDetails() {
                detailEvent = null;
                render();
                const returnFocus = detailReturnFocus?.isConnected
                    ? detailReturnFocus
                    : sheet
                      ? $("close")
                      : $("addbtn");
                returnFocus?.focus();
                detailReturnFocus = null;
            }
            function activateEventNode(node, event) {
                if (node.tagName !== "BUTTON") {
                    node.setAttribute("role", "button");
                    node.tabIndex = 0;
                    node.onkeydown = (keyEvent) => {
                        if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
                        keyEvent.preventDefault();
                        keyEvent.stopPropagation();
                        openEventDetails(event);
                    };
                }
                node.onclick = (clickEvent) => {
                    clickEvent.stopPropagation();
                    openEventDetails(event);
                };
            }
            // Month, week, and list views share one event model; each has a
            // separate layout path suited to its calendar presentation.
            function monthCell(k, num, list, max, td) {
                const c = el(
                    "div",
                    "bg-card text-left p-1.5 flex flex-col gap-1 overflow-hidden min-h-0 cursor-pointer",
                );
                const dayButton = el(
                    "button",
                    "text-sm lg:text-base font-medium w-7 h-7 grid place-items-center rounded-full shrink-0 " +
                        (k === td ? "bg-accent text-on" : ""),
                    num,
                );
                dayButton.type = "button";
                dayButton.setAttribute("aria-label", "Open events for " + k);
                dayButton.onclick = (clickEvent) => {
                    clickEvent.stopPropagation();
                    openSheet(k);
                };
                c.append(dayButton);
                list.slice(0, max).forEach((e) => {
                    const m = sty(e),
                        p = el(
                            "span",
                            "block truncate rounded-md px-1.5 py-1 text-xs lg:text-sm font-medium",
                            (e.tm ? tshort(e.tm) + " " : "") +
                                eventDisplayTitle(e),
                        );
                    p.style.background = m.c;
                    p.style.color = m.d;
                    const eventTag = tag(p, e);
                    activateEventNode(eventTag, e);
                    c.append(eventTag);
                });
                if (list.length > max)
                    c.append(
                        el(
                            "span",
                            "text-xs text-mute",
                            "+" + (list.length - max) + " more",
                        ),
                    );
                c.onclick = () => openSheet(k);
                return c;
            }
            let H = 72;
            const GUT = "52px";
            const mins = (t) => {
                const [h, m] = t.split(":").map(Number);
                return h * 60 + m;
            };
            const trange = (e) =>
                tfmt(e.tm) + (e.te && e.te !== e.tm ? " – " + tfmt(e.te) : "");
            let needScroll = true;
            // Scrolling or navigating starts a quiet timer that returns the view
            // to the current day and time after the user has stopped interacting.
            const NOW_IDLE_MS = 3 * 60 * 1000; // how long to wait after the user stops interacting before snapping back to "now"
            const AMBIENT_IDLE_MS = 2 * 60 * 1000;
            let nowIdleTimer = null,
                suppressScrollEvents = false,
                ambientReadyAt = Date.now() + AMBIENT_IDLE_MS;
            function goToNow() {
                if (sheet || detailEvent || setOpen) {
                    armIdleReset();
                    return;
                } // don't yank the view while a sheet/modal is open; just keep checking
                needScroll = true;
                const t = new Date();
                sel = iso(t);
                wstart = home();
                cur = new Date(t.getFullYear(), t.getMonth(), 1);
                load();
            }
            function armIdleReset() {
                clearTimeout(nowIdleTimer);
                nowIdleTimer = setTimeout(goToNow, NOW_IDLE_MS);
            }
            // Secondary navigation fades while the calendar is idle, but any
            // pointer, touch, keyboard, or wheel activity brings it back.
            const CHROME_IDLE_MS = 6000; // hide nav chrome after this long without interaction
            const CHROME_COLLAPSE_MS = 320;
            let chromeIdleTimer = null,
                chromeSettleTimer = null;
            function hideChrome() {
                document.body.classList.add("chrome-idle");
                clearTimeout(chromeSettleTimer);
                if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
                    document.body.classList.add("chrome-idle-settled");
                    return;
                }
                chromeSettleTimer = setTimeout(() => {
                    if (document.body.classList.contains("chrome-idle"))
                        document.body.classList.add("chrome-idle-settled");
                }, CHROME_COLLAPSE_MS);
            }
            function wakeChrome() {
                document.body.classList.remove("chrome-idle", "chrome-idle-settled");
                clearTimeout(chromeIdleTimer);
                clearTimeout(chromeSettleTimer);
                chromeIdleTimer = setTimeout(() => {
                    if ($("topbar")?.matches(":focus-within")) {
                        wakeChrome();
                        return;
                    }
                    if (!sheet && !detailEvent && !setOpen) hideChrome();
                }, CHROME_IDLE_MS);
            }
            function noteUserActivity(event) {
                if (activePage !== "glance") {
                    ambientReadyAt = Date.now() + AMBIENT_IDLE_MS;
                    wakeChrome();
                }
            }
            function layoutDay(list) {
                const items = list
                    .filter((e) => e.tm)
                    .map((e) => {
                        const s = mins(e.tm),
                            f0 = e.te ? mins(e.te) : s + 60;
                        return {
                            e,
                            s,
                            f: Math.min(1440, f0 > s ? f0 : s + 60),
                        };
                    })
                    .sort((a, b) => a.s - b.s || b.f - a.f);
                let cl = [],
                    ends = [],
                    cend = 0;
                const flush = () => {
                    const primary = cl.reduce(
                        (longest, item) =>
                            item.f - item.s > longest.f - longest.s
                                ? item
                                : longest,
                        cl[0],
                    );
                    const primaryDuration = primary
                        ? primary.f - primary.s
                        : 0;
                    const peers = new Map();
                    cl.forEach((i) => {
                        const key = `${i.s}:${i.e.kind || "event"}`;
                        if (!peers.has(key)) peers.set(key, []);
                        peers.get(key).push(i);
                    });
                    cl.forEach((i) => {
                        const group = peers.get(
                            `${i.s}:${i.e.kind || "event"}`,
                        );
                        i.n = ends.length;
                        i.primary = i === primary;
                        i.primaryDuration = primaryDuration;
                        i.sideBySide = group.length > 1;
                        i.peerCount = group.length;
                        i.peerIndex = group.indexOf(i);
                        i.z = i.sideBySide
                            ? 200 + i.peerIndex
                            : i.primary
                              ? 0
                              : 1 +
                                Math.round(
                                    ((i.f - i.s) / primaryDuration) * 100,
                                );
                    });
                    cl = [];
                    ends = [];
                    cend = 0;
                };
                items.forEach((i) => {
                    if (cl.length && i.s >= cend) flush();
                    let l = ends.findIndex((x) => x <= i.s);
                    if (l < 0) {
                        l = ends.length;
                        ends.push(0);
                    }
                    ends[l] = i.f;
                    i.l = l;
                    cl.push(i);
                    cend = Math.max(cend, i.f);
                });
                flush();
                return items;
            }
            function renderList(keys, td, on) {
                const list = $("listview");
                list.innerHTML = "";
                keys.forEach((k) => {
                    const date = parse(k),
                        today = k === td,
                        items = ev
                            .filter((e) => on(e, k))
                            .sort((a, b) => {
                                if (!a.tm && b.tm) return -1;
                                if (a.tm && !b.tm) return 1;
                                if (a.tm !== b.tm)
                                    return (a.tm || "").localeCompare(
                                        b.tm || "",
                                    );
                                return a.t.localeCompare(b.t);
                            }),
                        section = el(
                            "section",
                            "px-3 py-3 border-b border-line last:border-b-0",
                        ),
                        heading = el(
                            "button",
                            "w-full flex items-center gap-3 text-left mb-2",
                        ),
                        dayNumber = el(
                            "span",
                            "w-10 h-10 shrink-0 grid place-items-center rounded-full text-lg font-medium " +
                                (today ? "bg-accent text-on" : "bg-bg"),
                            date.getDate(),
                        ),
                        dateLabel = el(
                            "span",
                            "flex-1 text-sm font-medium",
                            date.toLocaleDateString(undefined, {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                            }),
                        );
                    section.dataset.day = k;
                    heading.setAttribute(
                        "aria-label",
                        "Add event on " + dateLabel.textContent,
                    );
                    heading.append(dayNumber, dateLabel);
                    heading.onclick = () => openSheet(k);
                    section.append(heading);
                    if (!items.length) {
                        section.append(
                            el(
                                "p",
                                "pl-[52px] text-sm text-mute",
                                "No events",
                            ),
                        );
                    } else {
                        items.forEach((event) => {
                            const color = sty(event),
                                card = el(
                                    "button",
                                    "w-full min-w-0 flex items-start gap-3 rounded-xl border border-line px-3 py-2.5 mb-2 last:mb-0 text-left",
                                ),
                                time = el(
                                    "span",
                                    "w-[4.5rem] shrink-0 pt-0.5 text-xs font-medium text-mute",
                                    event.tm ? trange(event) : "All day",
                                ),
                                title = tag(
                                    el(
                                        "span",
                                        "block min-w-0 truncate text-sm font-medium",
                                        eventDisplayTitle(event),
                                    ),
                                    event,
                                );
                            card.style.background = color.c;
                            card.style.color = color.d;
                            card.style.borderColor = "color-mix(in srgb, " + color.d + " 18%, transparent)";
                            card.setAttribute(
                                "aria-label",
                                (event.tm ? trange(event) : "All day") +
                                    ": " +
                                    eventDisplayTitle(event),
                            );
                            card.append(time, title);
                            activateEventNode(card, event);
                            section.append(card);
                        });
                    }
                    list.append(section);
                });
                if (needScroll) {
                    const focus = list.querySelector(
                        '[data-day="' +
                            (keys.includes(sel) ? sel : keys[0]) +
                            '"]',
                    );
                    if (focus)
                        list.scrollTop =
                            focus.getBoundingClientRect().top -
                            list.getBoundingClientRect().top +
                            list.scrollTop;
                    needScroll = false;
                }
            }
            function renderWeek(keys, td, on) {
                const tg = $("tg"),
                    st = tg.scrollTop,
                    hourStart = compactWeek ? 8 : 0,
                    hourEnd = compactWeek ? 20 : 24,
                    rangeStart = hourStart * 60,
                    rangeEnd = hourEnd * 60;
                suppressScrollEvents = true;
                tg.innerHTML = "";
                const cols =
                    "grid-template-columns:" +
                    GUT +
                    " repeat(" +
                    keys.length +
                    ",minmax(0,1fr))";
                const head = el(
                    "div",
                    "sticky top-0 z-10 bg-card border-b border-line",
                );
                const hr = el("div", "grid");
                hr.style.cssText = cols;
                hr.append(el("div"));
                keys.forEach((k) => {
                    const d = parse(k),
                        c = el(
                            "button",
                            "text-left p-2 border-l border-line flex flex-col items-start",
                        );
                    c.append(
                        el(
                            "span",
                            "text-xs uppercase tracking-wide text-mute",
                            d.toLocaleDateString(undefined, {
                                weekday: "short",
                            }),
                        ),
                        el(
                            "span",
                            "text-2xl lg:text-3xl font-medium w-10 h-10 lg:w-12 lg:h-12 grid place-items-center rounded-full " +
                                (k === td ? "bg-accent text-on" : ""),
                            d.getDate(),
                        ),
                    );
                    const outsideCount = compactWeek
                        ? ev.filter((e) => {
                              if (!on(e, k) || !e.tm) return false;
                              const start = mins(e.tm);
                              let end = e.te ? mins(e.te) : start + 60;
                              if (end <= start) end += 1440;
                              return start < rangeStart || end > rangeEnd;
                          }).length
                        : 0;
                    if (outsideCount) {
                        c.append(
                            el(
                                "span",
                                "text-[9px] leading-tight text-mute",
                                outsideCount + " outside",
                            ),
                        );
                        c.setAttribute(
                            "aria-label",
                            `${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}, ${outsideCount} events outside 8 AM to 8 PM`,
                        );
                    }
                    c.onclick = () => openSheet(k);
                    hr.append(c);
                });
                head.append(hr);
                const ad = keys.map((k) => ev.filter((e) => on(e, k) && !e.tm));
                if (ad.some((a) => a.length)) {
                    const ar = el("div", "grid border-t border-line");
                    ar.style.cssText = cols;
                    ar.append(
                        el(
                            "div",
                            "text-[10px] text-mute p-1 text-right",
                            "all-day",
                        ),
                    );
                    ad.forEach((a, i) => {
                        const c = el(
                            "div",
                            "border-l border-line p-1 flex flex-col gap-1 min-w-0",
                        );
                        a.forEach((e) => {
                            const m = sty(e),
                                p = el(
                                    "div",
                                    "truncate rounded-md px-2 py-1 text-xs lg:text-sm font-medium",
                                    eventDisplayTitle(e),
                                );
                            p.style.background = m.c;
                            p.style.color = m.d;
                            const eventTag = tag(p, e);
                            activateEventNode(eventTag, e);
                            c.append(eventTag);
                        });
                        c.onclick = () => openSheet(keys[i]);
                        ar.append(c);
                    });
                    head.append(ar);
                }
                tg.append(head);
                if (tg.clientHeight > 0) {
                    const bottomPadding =
                        parseFloat(getComputedStyle(tg).paddingBottom) || 0;
                    const available =
                        tg.clientHeight - head.offsetHeight - bottomPadding;
                    const nh = compactWeek
                        ? Math.max(24, Math.floor(available / (hourEnd - hourStart)))
                        : Math.max(56, Math.round(tg.clientHeight / 9.5));
                    if (nh !== H) {
                        H = nh;
                        needScroll = true;
                    }
                }
                const body = el("div", "grid relative");
                body.style.cssText =
                    cols + ";height:" + (hourEnd - hourStart) * H + "px;z-index:0";
                const gut = el("div", "relative");
                for (let h = hourStart; h < hourEnd; h++) {
                    const l = el(
                        "div",
                        "absolute right-1.5 text-[11px] lg:text-xs text-mute",
                        formatTime(new Date(2000, 0, 1, h), {
                            hour: "numeric",
                        }),
                    );
                    l.style.top =
                        Math.max(2, (h - hourStart) * H - 8) + "px";
                    gut.append(l);
                }
                body.append(gut);
                const now = new Date(),
                    nm = now.getHours() * 60 + now.getMinutes();
                keys.forEach((k) => {
                    const c = el(
                        "div",
                        "relative border-l border-line cursor-pointer",
                    );
                    c.style.backgroundImage =
                        "linear-gradient(to bottom,var(--line) 1px,transparent 1px)";
                    c.style.backgroundSize = "100% " + H + "px";
                    layoutDay(ev.filter((e) => on(e, k))).forEach((i) => {
                        const e = i.e,
                            m = sty(e),
                            displayStart = Math.max(i.s, rangeStart),
                            displayEnd = Math.min(i.f, rangeEnd);
                        if (displayEnd <= displayStart) return;
                        const duration = displayEnd - displayStart,
                            h = (duration / 60) * H - 3;
                        const p = el(
                            "div",
                            "absolute rounded-lg px-2 py-1 overflow-hidden",
                        );
                        const overlay =
                                i.n > 1 && !i.primary && !i.sideBySide,
                            width = i.sideBySide
                                ? 100 / i.peerCount
                                : overlay
                                  ? Math.min(
                                        84,
                                        56 +
                                            28 *
                                                (duration /
                                                    i.primaryDuration),
                                    )
                                  : 100,
                            left = i.sideBySide
                                ? (100 * i.peerIndex) / i.peerCount
                                : overlay
                                  ? 100 - width
                                  : 0,
                            fill = overlay
                                ? `color-mix(in srgb, ${m.c} 84%, var(--card))`
                                : m.c;
                        p.style.cssText =
                            "top:" +
                            (((displayStart - rangeStart) / 60) * H + 1) +
                            "px;height:" +
                            h +
                            "px;left:calc(" +
                            left +
                            "% + 2px);width:calc(" +
                            width +
                            "% - 4px);background:" +
                            m.c +
                            ";background:" +
                            fill +
                            ";color:" +
                            m.d +
                            ";border:2px solid var(--card);z-index:" +
                            i.z;
                        if (h >= 52)
                            p.append(
                                el(
                                    "div",
                                    "text-xs lg:text-sm opacity-70 truncate",
                                    trange(e),
                                ),
                                tag(
                                    el(
                                        "div",
                                        "text-sm lg:text-base font-medium leading-tight line-clamp-2 break-words",
                                        eventDisplayTitle(e),
                                    ),
                                    e,
                                ),
                            );
                        else
                            p.append(
                                tag(
                                    el(
                                        "div",
                                        "text-xs lg:text-sm font-medium truncate",
                                        tshort(e.tm) + " " + eventDisplayTitle(e),
                                    ),
                                    e,
                                ),
                            );
                        activateEventNode(p, e);
                        c.append(p);
                    });
                    if (
                        k === td &&
                        (!compactWeek || (nm >= rangeStart && nm <= rangeEnd))
                    ) {
                        const n = el(
                            "div",
                            "absolute left-0 right-0 pointer-events-none z-[5]",
                        );
                        n.style.cssText =
                            "top:" +
                            ((nm - rangeStart) / 60) * H +
                            "px;border-top:2px solid var(--accent)";
                        c.append(n);
                    }
                    c.onclick = () => openSheet(k);
                    body.append(c);
                });
                tg.append(body);
                if (needScroll && tg.clientHeight > 0) {
                    tg.scrollTop = compactWeek
                        ? 0
                        : (keys.includes(td) ? Math.max(0, nm / 60 - 1) : 7) * H;
                    needScroll = false;
                } else tg.scrollTop = st;
                requestAnimationFrame(() => {
                    suppressScrollEvents = false;
                });
            }
            function renderEventDetails(event) {
                $("event-detail-title").textContent = event.t || "(no title)";
                const content = $("event-detail-content");
                content.innerHTML = "";
                const addRow = (label, value, valueClass = "") => {
                    const row = el("section", "py-3 border-b border-line last:border-b-0");
                    row.append(
                        el("h3", "text-xs font-medium uppercase tracking-wide text-mute", label),
                        el("p", "mt-1 text-sm text-ink break-words " + valueClass, value),
                    );
                    content.append(row);
                };
                const when = parse(event.d).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                });
                addRow("When", when + " · " + (event.tm ? trange(event) : "All day"));
                const calendar = calendarForEvent(event);
                addRow("Calendar", calendar?.name || event.calendarName || sty(event).n);
                if (event.location) addRow("Location", event.location);
                const assignedPeople = peopleForEvent(event);
                if (assignedPeople.length) {
                    const row = el("section", "py-3 border-b border-line last:border-b-0");
                    row.append(el("h3", "text-xs font-medium uppercase tracking-wide text-mute", "People"));
                    const list = el("div", "mt-2 flex flex-wrap gap-2");
                    assignedPeople.forEach((person) => {
                        const chip = el("div", "inline-flex items-center gap-2 rounded-full border border-line bg-bg py-1 pl-1 pr-3");
                        chip.append(avatarNode(person, 28), el("span", "text-sm", person.name));
                        list.append(chip);
                    });
                    row.append(list);
                    content.append(row);
                } else {
                    addRow("People", eventMemberName(event));
                }
                if (event.notes)
                    addRow("Notes / description", event.notes, "whitespace-pre-wrap");
                if (event.rec) addRow("Repeats", "This is part of a repeating event.");
            }
            function render() {
                const td = iso(new Date()),
                    vis = (e) => {
                        const custom =
                            e.calendarId &&
                            !["event", "reminder", "dinner"].includes(e.calendarId);
                        if (custom && hide["calendar:" + e.calendarId]) return false;
                        if (!custom && K[e.kind] && hide[e.kind]) return false;
                        if (!custom && !K[e.kind] && hide.event) return false;
                        return true;
                    },
                    on = (e, k) => e.d === k && vis(e);
                $("vm").className =
                    "h-9 w-9 grid place-items-center rounded-full " +
                    (view === "month" ? "bg-accent text-on" : "");
                $("vw").className =
                    "h-9 w-9 grid place-items-center rounded-full " +
                    (view === "week" ? "bg-accent text-on" : "");
                $("vl").className =
                    "h-9 w-9 grid place-items-center rounded-full " +
                    (view === "list" ? "bg-accent text-on" : "");
                $("vm").setAttribute("aria-pressed", view === "month");
                $("vw").setAttribute("aria-pressed", view === "week");
                $("vl").setAttribute("aria-pressed", view === "list");
                $("dow").classList.toggle("hidden", view !== "month");
                const g = $("grid");
                g.innerHTML = "";
                g.style.display = view === "month" ? "" : "none";
                $("tg").style.display = view === "week" ? "" : "none";
                $("listview").style.display = view === "list" ? "" : "none";
                if (view === "month") {
                    $("mon").textContent = cur.toLocaleDateString(undefined, {
                        month: "long",
                        year: "numeric",
                    });
                    const first = cur.getDay(),
                        n = new Date(
                            cur.getFullYear(),
                            cur.getMonth() + 1,
                            0,
                        ).getDate(),
                        rows = Math.ceil((first + n) / 7);
                    const rem =
                            parseFloat(
                                getComputedStyle(document.documentElement)
                                    .fontSize,
                            ) || 16,
                        max = Math.max(
                            1,
                            Math.floor(
                                (g.clientHeight / rows - 2.25 * rem) /
                                    (1.875 * rem),
                            ),
                        );
                    g.style.gridTemplateRows =
                        "repeat(" + rows + ",minmax(0,1fr))";
                    g.style.gridTemplateColumns = "repeat(7,minmax(0,1fr))";
                    for (let i = 0; i < first; i++)
                        g.append(el("div", "bg-card"));
                    for (let d = 1; d <= n; d++) {
                        const k = iso(
                            new Date(cur.getFullYear(), cur.getMonth(), d),
                        );
                        g.append(
                            monthCell(
                                k,
                                d,
                                ev.filter((e) => on(e, k)),
                                max,
                                td,
                            ),
                        );
                    }
                    for (let i = first + n; i < rows * 7; i++)
                        g.append(el("div", "bg-card"));
                } else {
                    $("mon").textContent =
                        parse(wstart).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                        }) +
                        (days > 1
                            ? " – " +
                              parse(
                                  addDays(wstart, days - 1),
                              ).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                              })
                            : ", " + parse(wstart).getFullYear());
                    const keys = Array.from({ length: days }, (_, i) =>
                        addDays(wstart, i),
                    );
                    if (view === "week") renderWeek(keys, td, on);
                    else renderList(keys, td, on);
                }
                $("settings").classList.toggle("hidden", !setOpen);
                $("settings").classList.toggle("flex", setOpen);
                if (setOpen) {
                    const db = $("daybtns");
                    db.innerHTML = "";
                    const decreaseDays = el("button", null, "−");
                    decreaseDays.type = "button";
                    decreaseDays.disabled = days <= 1;
                    decreaseDays.setAttribute("aria-label", "Show one fewer day");
                    decreaseDays.onclick = () => setDays(days - 1);
                    const dayCount = el(
                        "output",
                        "settings-stepper-output",
                        `${days} ${days === 1 ? "day" : "days"}`,
                    );
                    dayCount.setAttribute("aria-live", "polite");
                    const increaseDays = el("button", null, "+");
                    increaseDays.type = "button";
                    increaseDays.disabled = days >= 7;
                    increaseDays.setAttribute("aria-label", "Show one more day");
                    increaseDays.onclick = () => setDays(days + 1);
                    db.append(decreaseDays, dayCount, increaseDays);
                    renderTabs();
                    renderCals();
                    renderTheme();
                    renderTimeFormat();
                    renderWeekHours();
                    renderWakeLockSettings();
                    renderTodaySettings();
                }
                $("sheet").classList.toggle("hidden", !sheet);
                $("sheet").classList.toggle("flex", sheet);
                $("event-detail").classList.toggle("hidden", !detailEvent);
                $("event-detail").classList.toggle("flex", !!detailEvent);
                if (detailEvent) renderEventDetails(detailEvent);
                renderTodayOverlay();
                if (!sheet) return;
                formKind();
                $("sd").textContent = parse(sel).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                });
                const l = $("list");
                l.innerHTML = "";
                const it = ev
                    .filter((e) => on(e, sel))
                    .sort((a, b) => (a.tm || "").localeCompare(b.tm || ""));
                if (!it.length)
                    l.append(el("p", "text-mute", "Nothing planned."));
                it.forEach((e) => {
                    const m = sty(e),
                        r = el(
                            "div",
                            "flex items-center gap-2.5 py-2 border-b border-line",
                        ),
                        b = el("span", "w-1 self-stretch rounded-sm");
                    b.style.background = m.d;
                    const t = el("div", "flex-1 min-w-0 flex flex-col");
                    const titleButton = el(
                        "button",
                        "w-full text-left truncate text-sm font-medium",
                        eventDisplayTitle(e),
                    );
                    titleButton.type = "button";
                    const titleTag = tag(titleButton, e);
                    activateEventNode(titleTag, e);
                    t.append(
                        titleTag,
                        el(
                            "small",
                            "text-mute",
                            (e.tm ? trange(e) + " · " : "") +
                                m.n +
                                (e.rec ? " · repeats" : ""),
                        ),
                    );
                    const x = el(
                        "button",
                        "text-mute w-9 h-9 grid place-items-center",
                    );
                    x.innerHTML = ic("trash-2", 18);
                    x.setAttribute("aria-label", "Delete event");
                    x.onclick = async () => {
                        if (
                            e.rec &&
                            !confirm(
                                "This event repeats. Delete the whole series?",
                            )
                        )
                            return;
                        try {
                            if (demo) {
                                local = local.filter((z) => z.url !== e.url);
                                saveLocal();
                            } else
                                await api(
                                    "DELETE",
                                    "/api/events?url=" +
                                        encodeURIComponent(e.url) +
                                        "&etag=" +
                                        encodeURIComponent(e.etag || ""),
                                );
                            await load();
                        } catch (err) {
                            status(err.message);
                        }
                    };
                    r.append(b, t, x);
                    l.append(r);
                });
            }
            // Settings content is rendered on demand so each tab reflects the
            // current state without duplicating controls in the HTML.
            function renderCalendarPage() {
                const main = $("calendar-main-view"),
                    add = $("calendar-add-view"),
                    subviewOpen = calendarFormOpen || personFormOpen,
                    back = $("calendar-add-back");
                main.classList.toggle("hidden", calendarFormOpen);
                add.classList.toggle("hidden", !calendarFormOpen);
                $("settings-sidebar").hidden = subviewOpen;
                $("stabs").style.display = subviewOpen ? "none" : "";
                $("settings-title").textContent = calendarFormOpen
                    ? "Add calendar"
                    : personFormOpen
                      ? editingPersonId
                          ? "Edit person"
                          : "Add person"
                      : ({
                            calendars: "Calendars",
                            people: "People",
                            view: "View",
                            today: "Today",
                            sounds: "Sounds",
                            appearance: "Appearance",
                            about: "About",
                        })[setTab];
                back.classList.toggle("hidden", !subviewOpen);
                back.classList.toggle("grid", subviewOpen);
                back.setAttribute(
                    "aria-label",
                    personFormOpen ? "Back to people" : "Back to calendars",
                );
                main.setAttribute("aria-hidden", calendarFormOpen);
                add.setAttribute("aria-hidden", !calendarFormOpen);
                main.inert = calendarFormOpen;
                add.inert = !calendarFormOpen;
            }
            function renderTabs() {
                const tb = $("stabs");
                tb.innerHTML = "";
                const tabs = [
                    ["calendars", "Calendars", "calendar-days", "Manage"],
                    ["people", "People", "users", "Manage"],
                    ["view", "View", "columns-3", "Preferences"],
                    ["today", "Today", "sun", "Preferences"],
                    ["sounds", "Sounds", "bell", "Preferences"],
                    ["appearance", "Appearance", "paintbrush-vertical", "Preferences"],
                    ["about", "About", "heart", "Covey"],
                ];
                if (demo) tabs.splice(1, 1);
                let currentGroup = "";
                tabs.forEach(([k, n, iconName, group]) => {
                    if (group !== currentGroup) {
                        const label = el("p", "settings-nav-label", group);
                        label.setAttribute("aria-hidden", "true");
                        tb.append(label);
                        currentGroup = group;
                    }
                    const b = el(
                        "button",
                        "settings-tab transition-colors",
                    );
                    b.type = "button";
                    b.innerHTML = ic(iconName, 18) + `<span>${n}</span>`;
                    b.setAttribute("role", "tab");
                    b.setAttribute("aria-selected", k === setTab);
                    b.setAttribute("aria-controls", "tab-" + k);
                    b.onclick = () => {
                        if (k !== "calendars") calendarFormOpen = false;
                        setTab = k;
                        render();
                    };
                    tb.append(b);
                    $("tab-" + k).style.display =
                        k === setTab && !calendarFormOpen ? "" : "none";
                });
                renderCalendarPage();
            }
            function mkSwitch(on) {
                const b = el(
                    "span",
                    "settings-switch-track relative shrink-0 block",
                );
                b.style.background = on ? "var(--accent)" : "var(--bg)";
                const k = el(
                    "span",
                    "settings-switch-thumb",
                );
                k.style.background = on ? "var(--on)" : "var(--mute)";
                k.style.transform = on ? "translateX(20px)" : "";
                b.append(k);
                return b;
            }
            function renderCalendarChoices() {
                const colorToggle = $("calendar-color-toggle");
                const selectedColor = CALENDAR_COLORS[addCalendarColor];
                colorToggle.innerHTML = `
                    <span class="settings-disclosure-main">
                        <span class="settings-disclosure-swatch" style="background:${selectedColor.bg}"></span>
                        <span class="settings-disclosure-copy"><strong>${selectedColor.label}</strong><small>Color</small></span>
                    </span>
                    ${ic("chevron-down", 18)}`;
                colorToggle.setAttribute(
                    "aria-expanded",
                    addCalendarPickerOpen === "color",
                );

                const colors = $("calendar-colors");
                colors.innerHTML = "";
                colors.classList.toggle(
                    "hidden",
                    addCalendarPickerOpen !== "color",
                );
                Object.entries(CALENDAR_COLORS).forEach(([key, color]) => {
                    const button = el(
                        "button",
                        "settings-choice flex-col",
                        color.label,
                    );
                    button.type = "button";
                    button.title = color.label;
                    button.setAttribute("aria-label", color.label + " calendar color");
                    button.setAttribute("aria-pressed", key === addCalendarColor);
                    const swatch = el("span", "h-6 w-6 rounded-full border border-line");
                    swatch.style.background = color.bg;
                    button.prepend(swatch);
                    button.onclick = () => {
                        addCalendarColor = key;
                        addCalendarPickerOpen = null;
                        renderCalendarChoices();
                    };
                    colors.append(button);
                });

                const iconToggle = $("calendar-icon-toggle");
                iconToggle.innerHTML = `
                    <span class="settings-disclosure-main">
                        <span class="h-5 w-5 grid shrink-0 place-items-center">${ic(addCalendarIcon, 18)}</span>
                        <span class="settings-disclosure-copy"><strong>${CALENDAR_ICON_LABELS[addCalendarIcon]}</strong><small>Icon</small></span>
                    </span>
                    ${ic("chevron-down", 18)}`;
                iconToggle.setAttribute(
                    "aria-expanded",
                    addCalendarPickerOpen === "icon",
                );

                const icons = $("calendar-icons");
                icons.innerHTML = "";
                icons.classList.toggle(
                    "hidden",
                    addCalendarPickerOpen !== "icon",
                );
                Object.entries(CALENDAR_ICON_LABELS).forEach(([key, label]) => {
                    const button = el(
                        "button",
                        "settings-choice flex-col",
                        label,
                    );
                    button.type = "button";
                    button.title = label;
                    button.setAttribute("aria-label", label + " calendar icon");
                    button.setAttribute("aria-pressed", key === addCalendarIcon);
                    const glyph = el("span", "h-6 w-6 grid place-items-center");
                    glyph.innerHTML = ic(key, 20);
                    button.prepend(glyph);
                    button.onclick = () => {
                        addCalendarIcon = key;
                        addCalendarPickerOpen = null;
                        renderCalendarChoices();
                    };
                    icons.append(button);
                });
            }
            function renderPersonCalendarChoices() {
                const choices = $("person-calendar-choices");
                choices.innerHTML = "";
                const eventCalendars = calendarConfigs.filter(
                    (calendar) => calendar.type === "event",
                );
                if (!eventCalendars.length) {
                    choices.append(
                        el("p", "text-xs text-mute", "No event calendars are configured."),
                    );
                    return;
                }
                eventCalendars.forEach((calendar) => {
                    const selected = addPersonCalendarIds.has(calendar.id);
                    const row = el(
                        "label",
                        "person-calendar-choice cursor-pointer",
                    );
                    const checkbox = el("input", "h-4 w-4 accent-accent");
                    checkbox.type = "checkbox";
                    checkbox.checked = selected;
                    checkbox.onchange = () => {
                        if (checkbox.checked) addPersonCalendarIds.add(calendar.id);
                        else addPersonCalendarIds.delete(calendar.id);
                    };
                    const swatch = el("span", "h-3 w-3 shrink-0 rounded-full");
                    swatch.style.background =
                        CALENDAR_COLORS[calendar.color]?.bg || "var(--soft-lavender)";
                    row.append(
                        checkbox,
                        swatch,
                        el("span", "truncate", calendar.name),
                    );
                    choices.append(row);
                });
            }
            function renderPersonAvatarChoices() {
                const choices = $("person-avatar-choices");
                choices.innerHTML = "";
                Object.entries({
                    person: "Person",
                    child: "Child",
                    baby: "Baby",
                    bird: "Bird",
                }).forEach(([key, label]) => {
                    const button = el(
                        "button",
                        "person-avatar-choice",
                    );
                    button.type = "button";
                    button.title = label;
                    button.setAttribute("aria-label", label + " avatar");
                    button.setAttribute(
                        "aria-pressed",
                        addPersonAvatar === key && !addPersonImage,
                    );
                    button.append(avatarNode({ avatar: key, name: label }, 28));
                    button.onclick = () => {
                        addPersonAvatar = key;
                        addPersonImage = null;
                        $("person-image").value = "";
                        renderPersonAvatarChoices();
                        renderPersonPreview();
                    };
                    choices.append(button);
                });
                const birdChoices = $("person-bird-choices");
                birdChoices.innerHTML = "";
                PERSON_BIRD_IMAGES.forEach(({ name, src }) => {
                    const selected = addPersonImage === src;
                    const button = el(
                        "button",
                        "person-avatar-choice",
                    );
                    button.type = "button";
                    button.title = name;
                    button.setAttribute("aria-label", name + " avatar");
                    button.setAttribute("aria-pressed", selected);
                    const image = el("img", "h-12 w-12 rounded-full object-cover");
                    image.src = src;
                    image.alt = "";
                    button.append(image);
                    button.onclick = () => {
                        addPersonAvatar = "bird";
                        addPersonImage = src;
                        $("person-image").value = "";
                        renderPersonAvatarChoices();
                        renderPersonPreview();
                    };
                    birdChoices.append(button);
                });
            }
            function renderPersonPreview() {
                const preview = $("person-avatar-preview");
                preview.innerHTML = "";
                const name = $("person-name").value.trim() || "Preview";
                preview.append(
                    avatarNode(
                        { name, avatar: addPersonAvatar, image: addPersonImage },
                        36,
                    ),
                    el("span", null, "Avatar preview"),
                );

            }
            function openPersonForm(person = null) {
                editingPersonId = person?.id || null;
                personFormOpen = true;
                setTab = "people";
                addPersonAvatar = person?.avatar || "person";
                addPersonImage = person?.image || null;
                addPersonCalendarIds = new Set(person?.calendarIds || []);
                $("person-name").value = person?.name || "";
                $("person-image").value = "";
                $("person-status").textContent = "";
                render();
                $("person-name").focus();
            }
            function renderPeopleAdmin() {
                const section = $("people-admin");
                section.style.display = demo ? "none" : "";
                if (demo) return;
                $("person-main-view").classList.toggle("hidden", personFormOpen);
                $("person-form").classList.toggle("hidden", !personFormOpen);
                const cards = $("person-cards");
                cards.innerHTML = "";
                $("person-list-status").textContent = "";
                if (!people.length)
                    cards.append(
                        el(
                            "p",
                            "text-xs text-mute py-1",
                            "No people yet. Add someone to assign events to them.",
                        ),
                    );
                people.forEach((person) => {
                    const row = el(
                        "div",
                        "person-row",
                    );
                    const linkedCalendars = (person.calendarIds || [])
                        .map((id) => calendarConfigs.find((calendar) => calendar.id === id))
                        .filter((calendar) => calendar?.type === "event");
                    const identity = el("div", "min-w-0 flex flex-col gap-1.5");
                    identity.append(el("span", "truncate text-sm font-medium", person.name));
                    const calendarTags = el("div", "person-calendar-tags");
                    if (linkedCalendars.length) {
                        linkedCalendars.forEach((calendar) =>
                            calendarTags.append(
                                el("span", "person-calendar-tag", calendar.name),
                            ),
                        );
                    } else {
                        calendarTags.append(
                            el("span", "text-xs text-mute", "No calendars associated"),
                        );
                    }
                    identity.append(calendarTags);
                    row.append(avatarNode(person, 48), identity);

                    const actions = el("div", "person-row-actions");
                    const edit = el(
                        "button",
                        "settings-icon-button grid place-items-center hover:bg-card/60",
                    );
                    edit.type = "button";
                    edit.innerHTML = ic("pencil", 16);
                    edit.setAttribute("aria-label", "Edit " + person.name);
                    edit.title = "Edit person";
                    edit.onclick = () => openPersonForm(person);
                    const remove = el(
                        "button",
                        "settings-icon-button grid place-items-center hover:bg-card/60 hover:text-rose-600",
                    );
                    remove.type = "button";
                    remove.innerHTML = ic("trash-2", 16);
                    remove.setAttribute("aria-label", "Remove " + person.name);
                    remove.title = "Remove person";
                    remove.onclick = () => removePerson(person);
                    actions.append(edit, remove);
                    row.append(actions);
                    cards.append(row);
                });
                $("person-add-toggle").classList.toggle("hidden", personFormOpen);
                $("person-add-save").disabled = personSaving;
                $("person-add-cancel").disabled = personSaving;
                $("person-add-save").textContent = personSaving
                    ? "Saving…"
                    : editingPersonId
                      ? "Save changes"
                      : "Save person";
                renderPersonCalendarChoices();
                renderPersonAvatarChoices();
                renderPersonPreview();
            }
            async function encodeAvatar(file) {
                if (!/^image\/(png|jpeg|webp)$/.test(file.type))
                    throw new Error("Choose a PNG, JPEG, or WebP image.");
                if (file.size > 10 * 1024 * 1024)
                    throw new Error("Choose an image smaller than 10 MB.");
                const url = URL.createObjectURL(file);
                try {
                    const image = new Image();
                    await new Promise((resolve, reject) => {
                        image.onload = resolve;
                        image.onerror = () => reject(new Error("Could not read that image."));
                        image.src = url;
                    });
                    const size = 256,
                        scale = Math.max(size / image.naturalWidth, size / image.naturalHeight),
                        width = image.naturalWidth * scale,
                        height = image.naturalHeight * scale,
                        canvas = document.createElement("canvas");
                    canvas.width = size;
                    canvas.height = size;
                    canvas.getContext("2d").drawImage(
                        image,
                        (size - width) / 2,
                        (size - height) / 2,
                        width,
                        height,
                    );
                    return canvas.toDataURL("image/webp", 0.82);
                } finally {
                    URL.revokeObjectURL(url);
                }
            }
            function resetPersonForm() {
                personFormOpen = false;
                personSaving = false;
                editingPersonId = null;
                addPersonAvatar = "person";
                addPersonImage = null;
                addPersonCalendarIds = new Set();
                $("person-name").value = "";
                $("person-image").value = "";
                $("person-status").textContent = "";
            }
            async function savePerson() {
                const name = $("person-name").value.trim();
                if (!name) {
                    $("person-status").textContent = "Enter a name for this person.";
                    return;
                }
                personSaving = true;
                $("person-add-save").disabled = true;
                $("person-add-save").textContent = "Saving…";
                $("person-status").textContent = "";
                try {
                    const result = await api(
                        editingPersonId ? "PUT" : "POST",
                        editingPersonId
                            ? "/api/config/people/" + encodeURIComponent(editingPersonId)
                            : "/api/config/people",
                        {
                            name,
                            avatar: addPersonAvatar,
                            image: addPersonImage,
                            calendarIds: [...addPersonCalendarIds],
                        },
                    );
                    people = result.people;
                    resetPersonForm();
                    syncTitlePeople($("title").value);
                    renderWhoOptions();
                    saveSet();
                    render();
                } catch (error) {
                    personSaving = false;
                    $("person-add-save").disabled = false;
                    $("person-add-cancel").disabled = false;
                    $("person-add-save").textContent = editingPersonId
                        ? "Save changes"
                        : "Save person";
                    $("person-status").textContent = error.message;
                }
            }
            async function removePerson(person) {
                if (!confirm(`Remove ${person.name}? Existing events will keep their saved name.`))
                    return;
                try {
                    const result = await api(
                        "DELETE",
                        "/api/config/people/" + encodeURIComponent(person.id),
                    );
                    people = result.people;
                    selectedPersonIds.delete(person.id);
                    syncTitlePeople($("title").value);
                    renderWhoOptions();
                    saveSet();
                    render();
                } catch (error) {
                    $("person-list-status").textContent = error.message;
                }
            }
            function renderCals() {
                renderCalendarChoices();
                const c = $("cals");
                c.innerHTML = "";
                const fam = M.find((m) => m.on) || M[M.length - 1];
                const addRow = (calendar, custom = false) => {
                    const { id, type, name, color, icon } = calendar;
                    const palette = color && CALENDAR_COLORS[color];
                    const fallback = type === "event" ? fam : K[type];
                    const col = palette
                        ? { c: palette.bg, d: palette.fg }
                        : fallback;
                    const iconName = icon || (type === "event" ? "calendar" : K[type]?.i);
                    const hiddenKey = custom ? "calendar:" + id : type;
                    const label = custom
                        ? name
                        : type === "event"
                          ? (name || "Family") + " calendar"
                          : name || K[type].n;
                    const row = el(
                        "div",
                        "flex items-center gap-2 py-2 w-full cursor-pointer",
                    );
                    const identity = el(
                        "div",
                        "flex flex-1 min-w-0 items-center gap-3",
                    );
                    const glyph = el(
                        "span",
                        "w-9 h-9 rounded-full grid place-items-center shrink-0",
                    );
                    glyph.style.background = col.c;
                    glyph.style.color = col.d;
                    glyph.innerHTML = ic(iconName, 18);
                    identity.append(
                        glyph,
                        el("span", "flex-1 text-sm font-medium", label),
                    );
                    const toggleCalendar = () => {
                        hide[hiddenKey] = !hide[hiddenKey];
                        saveSet();
                        render();
                    };
                    row.onclick = toggleCalendar;
                    if (custom) {
                        const remove = el(
                            "button",
                            "settings-icon-button grid place-items-center text-mute hover:text-rose-600",
                        );
                        remove.type = "button";
                        remove.innerHTML = ic("trash-2", 16);
                        remove.setAttribute(
                            "aria-label",
                            `Remove ${name} calendar from Covey`,
                        );
                        remove.title = "Remove from Covey";
                        remove.onclick = (event) => {
                            event.stopPropagation();
                            removeCalendar(calendar);
                        };
                        row.append(remove);
                    }
                    const toggle = el("button", "shrink-0");
                    toggle.type = "button";
                    toggle.setAttribute("role", "switch");
                    toggle.setAttribute("aria-checked", !hide[hiddenKey]);
                    toggle.setAttribute("aria-label", label);
                    toggle.append(mkSwitch(!hide[hiddenKey]));
                    toggle.onclick = (event) => {
                        event.stopPropagation();
                        toggleCalendar();
                    };
                    row.prepend(identity);
                    row.append(toggle);
                    c.append(row);
                };
                kinds
                    .filter((type) => type === "event" || K[type])
                    .forEach((type) => {
                        const configured = calendarConfigs.find(
                            (calendar) => calendar.id === type,
                        );
                        addRow({
                            id: type,
                            type,
                            name: configured?.name,
                            color: configured?.color,
                            icon: configured?.icon,
                        });
                    });
                calendarConfigs
                    .filter((calendar) => !["event", "reminder", "dinner"].includes(calendar.id))
                    .forEach((calendar) => addRow(calendar, true));
                $("calendar-add-section").style.display = demo ? "none" : "";
                renderPeopleAdmin();
                renderCalendarPage();
            }
            function renderTheme() {
                const ts = $("textsizes");
                ts.innerHTML = "";
                [
                    ["sm", "Small"],
                    ["md", "Medium"],
                    ["lg", "Large"],
                    ["xl", "X-Large"],
                ].forEach(([k, n]) => {
                    const b = el(
                        "button",
                        "flex-1 rounded-lg text-sm font-medium " +
                            (k === txt ? "bg-accent text-on" : ""),
                        n,
                    );
                    b.type = "button";
                    b.setAttribute("aria-pressed", k === txt ? "true" : "false");
                    b.onclick = () => {
                        txt = k;
                        GT.setText(k);
                        saveSet();
                        render();
                    };
                    ts.append(b);
                });
                const md = eff(),
                    tb = $("themes");
                tb.innerHTML = "";
                Object.entries(GT.T).forEach(([k, t]) => {
                    const c = t[md];
                    const b = el(
                        "button",
                        "appearance-theme-choice flex flex-col gap-1.5",
                    );
                    b.type = "button";
                    b.setAttribute("aria-pressed", k === pal ? "true" : "false");
                    const sw = el(
                        "span",
                        "appearance-theme-swatch flex w-full",
                    );
                    sw.style.borderColor = c.line;
                    [c.bg, c.card, c.accent].forEach((x) => {
                        const d = el("span", "flex-1");
                        d.style.background = x;
                        sw.append(d);
                    });
                    b.append(sw, el("span", null, t.n));
                    b.onclick = () => {
                        pal = k;
                        saveSet();
                        paint();
                        render();
                    };
                    tb.append(b);
                });
                $("autosw").checked = auto;
                $("darkmode").checked = eff() === "dark";
                $("autotimes").style.opacity = auto ? "1" : ".5";
                $("dfrom").disabled = $("dto").disabled = !auto;
                if (document.activeElement !== $("dfrom"))
                    $("dfrom").value = dFrom;
                if (document.activeElement !== $("dto")) $("dto").value = dTo;
            }
            function renderTimeFormat() {
                const choices = $("timeformats");
                choices.innerHTML = "";
                [
                    ["device", "Device"],
                    ["12", "12-hour"],
                    ["24", "24-hour"],
                ].forEach(([key, label]) => {
                    const button = el(
                        "button",
                        "flex-1 rounded-lg text-sm font-medium " +
                            (timeFormat === key ? "bg-accent text-on" : ""),
                        label,
                    );
                    button.type = "button";
                    button.setAttribute("aria-pressed", timeFormat === key);
                    button.onclick = () => {
                        timeFormat = key;
                        saveSet();
                        render();
                        tick();
                    };
                    choices.append(button);
                });
            }
            function renderWeekHours() {
                const choices = $("weekhours");
                choices.innerHTML = "";
                [
                    [false, "Full day"],
                    [true, "Compact"],
                ].forEach(([compact, label]) => {
                    const button = el(
                        "button",
                        "flex-1 rounded-lg text-sm font-medium " +
                            (compactWeek === compact
                                ? "bg-accent text-on"
                                : ""),
                        label,
                    );
                    button.type = "button";
                    button.setAttribute("aria-pressed", compactWeek === compact);
                    button.onclick = () => {
                        compactWeek = compact;
                        needScroll = true;
                        saveSet();
                        render();
                    };
                    choices.append(button);
                });
            }
            function formKind() {
                if (!kinds.includes(addKind)) addKind = "event";
                const ks = $("kindsel");
                ks.innerHTML = "";
                ks.style.display = kinds.length > 1 ? "" : "none";
                kinds.forEach((k) => {
                    const b = el(
                        "button",
                        "flex-1 h-9 rounded-full text-sm font-medium " +
                            (k === addKind ? "bg-accent text-on" : ""),
                        {
                            event: "Event",
                            reminder: "Reminder",
                            dinner: "Dinner",
                        }[k],
                    );
                    b.onclick = () => {
                        addKind = k;
                        formKind();
                    };
                    ks.append(b);
                });
                $("title").placeholder = {
                    event: "Add an event",
                    reminder: "Remind us to...",
                    dinner: "What's for dinner?",
                }[addKind];
                const calendarTarget = $("calendar-target");
                const previousCalendarId = calendarTarget.value;
                const eventCalendars = calendarConfigs.filter(
                    (calendar) => calendar.type === "event",
                );
                calendarTarget.innerHTML = "";
                eventCalendars.forEach((calendar) => {
                    const option = el("option", null, calendar.name);
                    option.value = calendar.id;
                    calendarTarget.append(option);
                });
                if (eventCalendars.some((calendar) => calendar.id === previousCalendarId))
                    calendarTarget.value = previousCalendarId;
                $("calendar-target-wrap").classList.toggle(
                    "hidden",
                    addKind !== "event" || eventCalendars.length <= 1,
                );
                const who = addKind === "event" && people.length > 0;
                const timed = addKind === "event";
                $("who-wrap").classList.toggle("hidden", !who);
                $("timewrap").style.display = timed ? "" : "none";
                $("endtimewrap").style.display = timed ? "" : "none";
            }
            // Create an event locally in preview mode or send it to the server,
            // then reload the active range so the new event is rendered normally.
            let adding = false;
            function setAdding(value) {
                const button = $("go");
                adding = value;
                button.disabled = value;
                button.setAttribute("aria-busy", value);
                $("go-label").classList.toggle("hidden", value);
                $("go-progress").classList.toggle("hidden", !value);
                $("go-progress-label").textContent = demo
                    ? "Saving…"
                    : "Saving to iCloud…";
            }
            async function add() {
                const t = $("title").value.trim();
                if (!t || adding) return;
                setAdding(true);
                const b = {
                    t,
                    d: sel,
                    tm: addKind === "event" ? $("time").value : "",
                    te: addKind === "event" ? $("endtime").value : "",
                    kind: addKind,
                };
                if (addKind === "event") {
                    const assignedPeople = personSelectionTouched
                        ? people.filter((person) => selectedPersonIds.has(person.id))
                        : personTitleMatches(t);
                    b.m = assignedPeople[0]?.name || "Family";
                    b.personIds = assignedPeople.map((person) => person.id);
                    if ($("calendar-target").value)
                        b.calendarId = $("calendar-target").value;
                }
                try {
                    if (demo) {
                        const id = String(Date.now() + Math.random());
                        local.push({ ...b, id, url: id, etag: "" });
                        saveLocal();
                    } else await api("POST", "/api/events", b);
                    const hiddenKey = b.calendarId &&
                        !["event", "reminder", "dinner"].includes(b.calendarId)
                        ? "calendar:" + b.calendarId
                        : addKind;
                    if (hide[hiddenKey]) {
                        hide[hiddenKey] = false;
                        saveSet();
                    }
                    $("title").value = "";
                    $("time").value = "";
                    $("endtime").value = "";
                    selectedPersonIds.clear();
                    personSelectionTouched = false;
                    renderWhoOptions();
                    closeSheet();
                    await load();
                } catch (e) {
                    status(e.message);
                } finally {
                    setAdding(false);
                }
            }
            function setCalendarAddStatus(message, error = false) {
                const output = $("calendar-add-status");
                output.textContent = message;
                output.className =
                    "mt-2 text-xs empty:hidden " +
                    (error ? "text-rose-600" : "text-mute");
            }
            function updateCalendarAddButton() {
                const button = $("calendar-add-save");
                button.disabled =
                    calendarSaving ||
                    !$("calendar-name").value.trim() ||
                    !$("calendar-confirm").checked;
                button.textContent = calendarSaving ? "Checking iCloud…" : "Add calendar";
            }
            async function saveCalendar() {
                const name = $("calendar-name").value.trim();
                if (calendarSaving || !name || !$("calendar-confirm").checked) return;
                calendarSaving = true;
                updateCalendarAddButton();
                setCalendarAddStatus("Checking that the calendar exists in iCloud…");
                try {
                    const config = await api("POST", "/api/config/calendars", {
                        name,
                        color: addCalendarColor,
                        icon: addCalendarIcon,
                        confirmedExisting: true,
                    });
                    calendarConfigs = config.calendars;
                    kinds = config.kinds;
                    hide["calendar:" + config.calendar.id] = false;
                    saveSet();
                    calendarFormOpen = false;
                    addCalendarPickerOpen = null;
                    $("calendar-name").value = "";
                    $("calendar-confirm").checked = false;
                    setCalendarAddStatus("");
                    updateCalendarAddButton();
                    render();
                    const listStatus = $("calendar-list-status");
                    listStatus.textContent = `Added “${config.calendar.name}”.`;
                    listStatus.className = "min-h-4 text-xs text-mute";
                    $("calendar-add-toggle").focus();
                    load();
                } catch (error) {
                    setCalendarAddStatus(error.message, true);
                } finally {
                    calendarSaving = false;
                    updateCalendarAddButton();
                }
            }
            async function removeCalendar(calendar) {
                if (
                    !confirm(
                        `Remove “${calendar.name}” from Covey? Its calendar and events will remain in iCloud.`,
                    )
                )
                    return;
                const output = $("calendar-list-status");
                output.textContent = `Removing “${calendar.name}”…`;
                output.className = "min-h-4 text-xs text-mute";
                try {
                    const config = await api(
                        "DELETE",
                        "/api/config/calendars/" + encodeURIComponent(calendar.id),
                    );
                    calendarConfigs = config.calendars;
                    kinds = config.kinds;
                    people = config.people || people;
                    addPersonCalendarIds.delete(calendar.id);
                    delete hide["calendar:" + calendar.id];
                    saveSet();
                    output.textContent = `Removed “${calendar.name}” from Covey.`;
                    render();
                    load();
                } catch (error) {
                    output.textContent = error.message;
                    output.className = "min-h-4 text-xs text-rose-600";
                }
            }
            // Wire the static controls from index.html to the state and render
            // functions above, then perform the initial data load.
            $("go").onclick = add;
            $("calendar-add-toggle").onclick = () => {
                calendarFormOpen = true;
                addCalendarPickerOpen = null;
                renderCalendarChoices();
                setCalendarAddStatus("");
                render();
                $("calendar-name").focus();
            };
            $("calendar-add-back").onclick = () => {
                if (calendarFormOpen) {
                    calendarFormOpen = false;
                    addCalendarPickerOpen = null;
                    render();
                    $("calendar-add-toggle").focus();
                } else if (personFormOpen) {
                    personFormOpen = false;
                    render();
                    $("person-add-toggle").focus();
                }
            };
            $("calendar-add-cancel").onclick = () => {
                calendarFormOpen = false;
                addCalendarPickerOpen = null;
                $("calendar-name").value = "";
                $("calendar-confirm").checked = false;
                setCalendarAddStatus("");
                updateCalendarAddButton();
                render();
                $("calendar-add-toggle").focus();
            };
            $("calendar-color-toggle").onclick = () => {
                addCalendarPickerOpen =
                    addCalendarPickerOpen === "color" ? null : "color";
                renderCalendarChoices();
            };
            $("calendar-icon-toggle").onclick = () => {
                addCalendarPickerOpen =
                    addCalendarPickerOpen === "icon" ? null : "icon";
                renderCalendarChoices();
            };
            $("calendar-name").oninput = () => {
                setCalendarAddStatus("");
                updateCalendarAddButton();
            };
            $("calendar-confirm").onchange = () => {
                setCalendarAddStatus("");
                updateCalendarAddButton();
            };
            $("calendar-add-save").onclick = saveCalendar;
            updateCalendarAddButton();
            $("person-add-toggle").onclick = () => openPersonForm();
            $("person-add-cancel").onclick = () => {
                resetPersonForm();
                render();
                $("person-add-toggle").focus();
            };
            $("person-add-save").onclick = savePerson;
            $("person-name").oninput = renderPersonPreview;
            $("person-image").onchange = async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const previousImage = addPersonImage;
                $("person-status").textContent = "Preparing avatar…";
                try {
                    addPersonImage = await encodeAvatar(file);
                    $("person-status").textContent = "";
                    renderPersonAvatarChoices();
                    renderPersonPreview();
                } catch (error) {
                    addPersonImage = previousImage;
                    event.target.value = "";
                    $("person-status").textContent = error.message;
                }
            };
            $("title").oninput = () => {
                syncTitlePeople($("title").value);
            };
            $("title").onkeydown = (e) => {
                if (e.key === "Enter") add();
            };
            $("close").onclick = closeSheet;
            $("sheet").onclick = (e) => {
                if (e.target === $("sheet")) closeSheet();
            };
            $("event-detail-close").onclick = closeEventDetails;
            $("event-detail").onclick = (e) => {
                if (e.target === $("event-detail")) closeEventDetails();
            };
            $("task-composer-form").onsubmit = createTask;
            $("task-composer-close").onclick = () =>
                setTaskComposerOpen(false);
            $("task-composer").onclick = (event) => {
                if (event.target === $("task-composer"))
                    setTaskComposerOpen(false);
            };
            $("task-due-date").onchange = (event) => {
                const time = $("task-due-time");
                time.disabled = !event.target.value;
                if (time.disabled) time.value = "";
            };
            document.addEventListener("keydown", (e) => {
                if (e.key !== "Escape") return;
                if (activePage === "glance" && todayWeatherPanelOpen) {
                    navigateAmbientWeather(false);
                    return;
                }
                if (taskComposerOpen) {
                    setTaskComposerOpen(false);
                } else if (detailEvent) {
                    closeEventDetails();
                } else if (setOpen) {
                    if (setTab === "calendars" && calendarFormOpen) {
                        calendarFormOpen = false;
                        render();
                        $("calendar-add-toggle").focus();
                    } else if (personFormOpen) {
                        resetPersonForm();
                        render();
                        $("person-add-toggle").focus();
                    } else {
                        setOpen = false;
                        calendarFormOpen = false;
                        render();
                        restoreSettingsFocus();
                    }
                } else if (sheet) {
                    sheet = false;
                    render();
                }
            });
            $("autosw").onchange = (event) => {
                auto = event.target.checked;
                ovr = null;
                saveSet();
                paint();
                render();
            };
            $("darkmode").onchange = (event) => {
                setDarkMode(event.target.checked);
            };
            $("dfrom").oninput = (e) => {
                if (e.target.value) {
                    dFrom = e.target.value;
                    saveSet();
                    paint();
                }
            };
            $("dto").oninput = (e) => {
                if (e.target.value) {
                    dTo = e.target.value;
                    saveSet();
                    paint();
                }
            };
            $("setbtn").onclick = () => openGlobalSettings($("setbtn"));
            $("keep-screen-awake").onchange = (event) => {
                keepScreenAwake = event.target.checked;
                saveSet();
                updateScreenWakeLock();
            };
            $("today-enabled").onchange = (event) => {
                todayViewEnabled = event.target.checked;
                saveSet();
                renderTodaySettings();
                if (todayViewEnabled) checkTodayView();
            };
            $("sounds-enabled").onchange = (event) => {
                soundsEnabled = event.target.checked;
                saveSet();
                renderTodaySettings();
            };
            $("today-event-chime").onchange = (event) => {
                todayEventChimeEnabled = event.target.checked;
                saveSet();
                renderTodaySettings();
            };
            $("task-complete-sound").onchange = (event) => {
                taskCompleteSoundEnabled = event.target.checked;
                saveSet();
                renderTodaySettings();
            };
            $("today-chime-volume").oninput = (event) => {
                todayEventChimeVolume = Number(event.target.value);
                $("today-chime-volume-value").textContent = `${todayEventChimeVolume}%`;
            };
            $("today-chime-volume").onchange = () => saveSet();
            $("today-chime-preview").onclick = playEventStartChime;
            $("task-complete-preview").onclick = playTaskCompleteSound;
            $("today-preview").onclick = () => {
                openTodayOverlay(ambientPeriod(new Date()), true);
            };
            document.querySelectorAll("[data-ambient-preview]").forEach((button) => {
                button.onclick = () =>
                    openTodayOverlay(button.dataset.ambientPreview, true);
            });
            $("today-temperature-unit").onchange = (event) => {
                todayTemperatureUnit = event.target.value === "C" ? "C" : "F";
                saveSet();
                renderTodayOverlay(true);
            };
            $("today-weather-enabled").onchange = (event) => {
                todayWeatherEnabled = event.target.checked;
                if (todayWeatherStatus === "loading") {
                    todayWeatherStatus = todayWeather ? "ready" : "idle";
                    todayWeatherRequestDate = todayWeather?.date || "";
                } else if (todayWeatherEnabled && todayWeatherStatus === "error") {
                    todayWeatherStatus = "idle";
                    todayWeatherRequestDate = "";
                }
                saveSet();
                renderTodaySettings();
                renderTodayOverlay(true);
            };
            $("today-weather-location").oninput = () => {
                $("today-weather-location-status").textContent = "";
                renderTodaySettings();
            };
            $("today-weather-location-save").onclick = () => {
                const location = $("today-weather-location").value.trim();
                if (!location) {
                    $("today-weather-location-status").textContent =
                        "Enter a city or postal code first.";
                    return;
                }
                todayWeatherLocation = location;
                todayWeather = null;
                todayWeatherRequestDate = "";
                todayWeatherStatus = "idle";
                todayWeatherMessage = "";
                todayWeatherLastRequestAt = 0;
                saveSet();
                $("today-weather-location-status").textContent =
                    "Weather location saved.";
                renderTodaySettings();
                renderTodayOverlay(true);
            };
            $("sclose").onclick = () => {
                setOpen = false;
                calendarFormOpen = false;
                personFormOpen = false;
                renderCalendarPage();
                render();
                restoreSettingsFocus();
            };
            $("settings").onclick = (e) => {
                if (e.target === $("settings")) {
                    setOpen = false;
                    calendarFormOpen = false;
                    personFormOpen = false;
                    renderCalendarPage();
                    render();
                    restoreSettingsFocus();
                }
            };
            document.querySelectorAll(".page-pagination-target").forEach((button) => {
                button.onclick = () =>
                    setActivePage(button.dataset.page, {
                        userInitiated: true,
                    });
                button.onkeydown = (event) => {
                    const current = COVEY_PAGES.indexOf(activePage);
                    let target = null;
                    if (event.key === "ArrowLeft") target = Math.max(0, current - 1);
                    if (event.key === "ArrowRight")
                        target = Math.min(COVEY_PAGES.length - 1, current + 1);
                    if (event.key === "Home") target = 0;
                    if (event.key === "End") target = COVEY_PAGES.length - 1;
                    if (target === null) return;
                    event.preventDefault();
                    setActivePage(COVEY_PAGES[target], {
                        userInitiated: true,
                        focus: true,
                    });
                };
            });
            let pageGesture = null,
                suppressPageClick = false;
            const pageViewport = $("covey-pages");
            const pageTrack = $("covey-page-track");
            pageViewport.addEventListener("pointerdown", (event) => {
                if (
                    !event.isPrimary ||
                    setOpen ||
                    sheet ||
                    detailEvent ||
                    todayWeatherTransitioning ||
                    todayWeatherPanelOpen ||
                    event.target.closest("button,input,select,a,[role='button']")
                )
                    return;
                pageGesture = {
                    id: event.pointerId,
                    x: event.clientX,
                    y: event.clientY,
                    time: performance.now(),
                    horizontal: false,
                };
            });
            pageViewport.addEventListener("pointermove", (event) => {
                if (!pageGesture || pageGesture.id !== event.pointerId) return;
                let dx = event.clientX - pageGesture.x;
                const dy = event.clientY - pageGesture.y;
                if (!pageGesture.horizontal) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
                    if (Math.abs(dy) >= Math.abs(dx)) {
                        pageGesture = null;
                        return;
                    }
                    pageGesture.horizontal = true;
                    pageViewport.setPointerCapture(event.pointerId);
                    pageTrack.classList.add("is-dragging");
                }
                event.preventDefault();
                const index = COVEY_PAGES.indexOf(activePage);
                if ((index === 0 && dx > 0) || (index === COVEY_PAGES.length - 1 && dx < 0))
                    dx *= 0.22;
                pageTrack.style.transform = `translate3d(calc(${-index * 100}% + ${dx}px),0,0)`;
            });
            const finishPageGesture = (event) => {
                if (!pageGesture || pageGesture.id !== event.pointerId) return;
                const gesture = pageGesture;
                pageGesture = null;
                pageTrack.classList.remove("is-dragging");
                pageTrack.style.removeProperty("transform");
                if (!gesture.horizontal) return;
                const dx = event.clientX - gesture.x;
                const elapsed = Math.max(1, performance.now() - gesture.time);
                const velocity = Math.abs(dx) / elapsed;
                let index = COVEY_PAGES.indexOf(activePage);
                if (Math.abs(dx) > 64 || velocity > 0.45)
                    index += dx < 0 ? 1 : -1;
                index = Math.max(0, Math.min(COVEY_PAGES.length - 1, index));
                suppressPageClick = true;
                setTimeout(() => {
                    suppressPageClick = false;
                }, 0);
                setActivePage(COVEY_PAGES[index], { userInitiated: true });
            };
            pageViewport.addEventListener("pointerup", finishPageGesture);
            pageViewport.addEventListener("pointercancel", finishPageGesture);
            pageViewport.addEventListener("click", (event) => {
                if (!suppressPageClick) return;
                event.preventDefault();
                event.stopPropagation();
                suppressPageClick = false;
            }, true);
            $("addbtn").onclick = () => {
                if (activePage === "tasks") setTaskComposerOpen(true, $("addbtn"));
                else openSheet(sel);
            };
            $("prev").onclick = () => go(-1);
            $("next").onclick = () => go(1);
            $("todaybtn").onclick = goToNow;
            $("vm").onclick = () => setView("month");
            $("vw").onclick = () => setView("week");
            $("vl").onclick = () => setView("list");
            const fullscreenButton = $("settings-fullscreen");
            if (!document.documentElement.requestFullscreen)
                fullscreenButton.hidden = true;
            fullscreenButton.onclick = () => {
                try {
                    (document.fullscreenElement
                        ? document.exitFullscreen()
                        : document.documentElement.requestFullscreen()
                    ).catch(() => {});
                } catch (e) {}
            };
            document.addEventListener("fullscreenchange", () => {
                fullscreenButton.textContent = document.fullscreenElement
                    ? "Exit full screen"
                    : "Enter full screen";
            });
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "visible") {
                    requestScreenWakeLock();
                    tick();
                    load();
                }
            });
            addEventListener("resize", render);
            addEventListener("resize", () =>
                requestAnimationFrame(alignPagePagination),
            );
            addEventListener("load", render);
            addEventListener("load", requestScreenWakeLock);
            $("tg").addEventListener("scroll", () => {
                if (suppressScrollEvents) return;
                armIdleReset();
            });
            $("listview").addEventListener("scroll", armIdleReset);
            // touchmove is kept alongside Pointer Events as an explicit
            // Safari/iPad fallback. Passive listeners preserve native swiping
            // and scrolling while the shared wake path remains idempotent.
            [
                "pointerdown",
                "pointermove",
                "touchstart",
                "touchmove",
                "keydown",
                "wheel",
            ].forEach(
                (evt) =>
                    document.addEventListener(evt, noteUserActivity, {
                        passive: true,
                    }),
            );
            $("topbar").addEventListener("focusin", wakeChrome);
            wakeChrome();
            setInterval(load, 60000);
            setInterval(tick, 10000);
            document.querySelectorAll("[data-i]").forEach((e) => {
                e.innerHTML = ic(e.dataset.i, +e.dataset.s || 20);
            });
            if (!demo)
                api("GET", "/api/config")
                    .then((c) => {
                        kinds = c.kinds;
                        calendarConfigs = c.calendars || [];
                        people = c.people || [];
                        syncTitlePeople($("title").value);
                        renderWhoOptions();
                        renderTasksPage();
                        render();
                    })
                    .catch(() => {});
            $("syncbtn").onclick = () => {
                if (syncState === "pending") return;
                syncState = "pending";
                updateSyncBadge();
                load();
            };
            tick();
            renderTasksPage();
            fetchTasks();
            setActivePage("glance");
            status("");
            updateSyncBadge();
            render();
            load().finally(hideSplash);
