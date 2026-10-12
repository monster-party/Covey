import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("keeps index.html focused on bootstrapping component roots", () => {
    const index = read("index.html");

    ["app-root", "dialogs-root", "settings-root"].forEach((id) => {
        assert.match(index, new RegExp(`id=["']${id}["']`));
    });
    ["app-shell", "sheet", "event-detail", "settings-dialog"].forEach((id) => {
        assert.doesNotMatch(index, new RegExp(`id=["']${id}["']`));
    });
});

test("mounts calendar, dialog, and settings components before binding the app", () => {
    const app = read("app.js");
    const calendar = read("components/calendar-shell.js");
    const dialogs = read("components/event-dialogs.js");
    const settings = read("components/settings-dialog.js");

    assert.match(calendar, /id=["']app-shell["']/);
    assert.match(calendar, /class=["']calendar-toolbar["']/);
    assert.doesNotMatch(calendar, /id=["']clock["']/);
    assert.match(dialogs, /id=["']sheet["']/);
    assert.match(dialogs, /id=["']event-detail["']/);
    assert.match(settings, /id=["']settings-dialog["']/);

    const mountIndex = app.indexOf("mountCalendarShell(");
    const selectorIndex = app.indexOf("const $ =");
    assert.ok(mountIndex >= 0 && mountIndex < selectorIndex);
    assert.match(app, /mountEventDialogs\(document\.getElementById\(["']dialogs-root["']\)\)/);
    assert.match(app, /mountSettingsDialog\(document\.getElementById\(["']settings-root["']\)\)/);
});

test("keeps the mounted calendar root at full viewport height", () => {
    const styles = read("style.css");

    assert.match(styles, /#app-root\s*\{[^}]*height:\s*100%/s);
    assert.match(styles, /#app-root\s*\{[^}]*min-height:\s*0/s);
});

test("keeps the sticky week header opaque above scrolled events", () => {
    const styles = read("style.css");
    const stickyHeader = styles.match(/#tg\s*>\s*\.sticky\s*\{([^}]*)\}/s)?.[1] || "";

    assert.match(stickyHeader, /isolation:\s*isolate/);
    assert.match(stickyHeader, /z-index:\s*20/);
    assert.match(stickyHeader, /var\(--card\)/);
    assert.doesNotMatch(stickyHeader, /var\(--ambient-surface/);
});

test("collapses idle calendar chrome so the calendar reclaims its height", () => {
    const styles = read("style.css");
    const app = read("app.js");
    const idleToolbar = styles.match(/body\.chrome-idle\s+#topbar\s*\{([^}]*)\}/s)?.[1] || "";

    assert.match(idleToolbar, /height:\s*0/);
    assert.match(idleToolbar, /min-height:\s*0/);
    assert.match(idleToolbar, /margin-bottom:\s*0/);
    assert.match(styles, /#topbar,[\s\S]*?\.idle-fade\s*\{\s*transition:\s*none/);
    assert.match(app, /\$\("topbar"\)\?\.matches\(":focus-within"\)/);
    assert.match(app, /classList\.add\("chrome-idle-settled"\)/);
    assert.match(app, /prefers-reduced-motion:\s*reduce/);
    assert.match(styles, /body\.chrome-idle-settled\s+#topbar\s*\{[^}]*visibility:\s*hidden/s);
    assert.match(styles, /body\.chrome-idle-settled\s+\.idle-fade,[\s\S]*?pointer-events:\s*none/);
});

test("restores settled calendar chrome for touch gestures without blocking scroll", () => {
    const app = read("app.js");
    const styles = read("style.css");
    const activityEvents = app.match(
        /\[\s*"pointerdown"[\s\S]*?"wheel",?\s*\]\.forEach\([\s\S]*?document\.addEventListener\(evt, noteUserActivity, \{[\s\S]*?passive:\s*true/s,
    )?.[0] || "";

    assert.match(activityEvents, /"touchstart"/);
    assert.match(activityEvents, /"touchmove"/);
    assert.match(activityEvents, /passive:\s*true/);
    assert.match(
        app,
        /function wakeChrome\(\)\s*\{[\s\S]*?classList\.remove\("chrome-idle", "chrome-idle-settled"\)/,
    );
    assert.match(
        styles,
        /body\.chrome-idle-settled\s+\.idle-fade,[\s\S]*?pointer-events:\s*none/,
    );
});

test("keeps theme controls in settings and exposes settings from Glance", () => {
    const app = read("app.js");
    const calendar = read("components/calendar-shell.js");
    const settings = read("components/settings-dialog.js");

    assert.doesNotMatch(calendar, /id=["']theme["']/);
    assert.match(settings, /id=["']darkmode["']/);
    assert.match(settings, /id=["']autosw["']/);
    assert.match(app, /el\("button", "ambient-settings", "Settings"\)/);
    assert.match(
        app,
        /openSettings\.onclick = \(\) => \{\s*setTab = "appearance";\s*setOpen = true;\s*render\(\);/,
    );
    assert.match(
        app,
        /\$\("covey-pages"\)\.inert =\s*setOpen \|\| sheet \|\| !!detailEvent \|\| taskComposerOpen/,
    );
    assert.match(read("style.css"), /#settings\s*\{\s*z-index:\s*70/);
});

test("presents Glance, Calendar, and Tasks as swipeable sibling pages", () => {
    const app = read("app.js");
    const calendar = read("components/calendar-shell.js");
    const styles = read("style.css");

    ["glance", "calendar", "tasks"].forEach((page) => {
        assert.match(calendar, new RegExp(`id=["']${page}-page["']`));
        assert.match(calendar, new RegExp(`data-page=["']${page}["']`));
    });
    assert.doesNotMatch(calendar, /Open calendar and leave Glance mode/);
    assert.match(app, /const COVEY_PAGES = \["glance", "calendar", "tasks"\]/);
    assert.match(app, /pageViewport\.addEventListener\("pointermove"/);
    assert.match(app, /function alignPagePagination\(\)[\s\S]*?\.ambient-glance-footer/);
    assert.match(app, /footerCenter[\s\S]*?pagination\.offsetHeight \/ 2/);
    assert.match(app, /footerCenter[\s\S]*?addButton\.offsetHeight \/ 2/);
    assert.doesNotMatch(app, /alignPagePagination\(\)[\s\S]{0,200}activePage !== "glance"/);
    assert.match(calendar, /<\/div>\s*<button\s+id=["']addbtn["']/);
    assert.match(app, /page === "tasks" \? "Add task" : "Add event"/);
    assert.match(app, /activePage === "tasks"\) setTaskComposerOpen\(true\)/);
    assert.match(styles, /\.page-pagination\s*\{[^}]*backdrop-filter:blur\(22px\)/s);
    assert.match(styles, /\.page-pagination-target\s*\{[^}]*width:44px[^}]*height:44px/s);
    assert.match(styles, /#sheet,#event-detail,#task-composer\s*\{\s*z-index:80/);
    assert.match(styles, /data-active-page=["']tasks["'][^}]*translate3d\(-200%,0,0\)/);
    assert.match(styles, /\.covey-page\s*\{[^}]*background:transparent/s);
    assert.match(styles, /\.covey-glance-page \.ambient-page\s*\{[^}]*background:transparent/s);
    assert.doesNotMatch(styles, /\.covey-tasks-page\s*\{[^}]*radial-gradient/s);
});
