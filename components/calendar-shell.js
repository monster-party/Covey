export function mountCalendarShell(root) {
    if (!root) throw new Error("Calendar root is missing.");
    root.innerHTML = `
        <div id="covey-pages" class="covey-pages" data-active-page="glance">
          <div id="covey-page-track" class="covey-page-track">
            <section id="glance-page" class="covey-page covey-glance-page" aria-label="Today">
              <div
                id="today-overlay"
                class="h-full overflow-hidden"
                aria-hidden="false"
                tabindex="-1"
              ></div>
            </section>
            <section id="calendar-page" class="covey-page covey-calendar-page" aria-label="Calendar" aria-hidden="true" inert>
              <div id="app-shell" class="h-full flex flex-col p-3 pt-2">
            <section class="flex-1 min-w-0 min-h-0 flex flex-col">
                <header
                    id="topbar"
                    class="calendar-toolbar"
                    aria-label="Calendar controls"
                >
                    <div class="calendar-nav-cluster idle-fade">
                        <button
                            id="prev"
                            class="calendar-icon-button grid place-items-center"
                            aria-label="Previous"
                        >
                            <i data-i="chevron-left"></i>
                        </button>
                        <button
                            id="next"
                            class="calendar-icon-button grid place-items-center"
                            aria-label="Next"
                        >
                            <i data-i="chevron-right"></i>
                        </button>
                        <h1
                            id="mon"
                            class="calendar-date-range"
                        ></h1>
                        <button
                            id="todaybtn"
                            class="calendar-today-button"
                        >
                            Today
                        </button>
                    </div>
                    <div class="calendar-utility-cluster idle-fade">
                        <button
                            id="syncbtn"
                            class="calendar-sync-button hidden items-center"
                            aria-live="polite"
                            title=""
                        >
                            <span
                                id="syncdot"
                                class="w-2 h-2 rounded-full bg-mute shrink-0"
                            ></span>
                            <span id="syncsub">Syncing…</span>
                        </button>
                        <div
                            role="group"
                            aria-label="Calendar view"
                            class="calendar-view-switch"
                        >
                            <button
                                id="vm"
                                aria-label="Month view"
                                title="Month view"
                                aria-pressed="false"
                                class="grid place-items-center"
                            >
                                <i data-i="calendar-days" data-s="18"></i>
                                <span class="sr-only">Month</span>
                            </button>
                            <button
                                id="vw"
                                aria-label="Week view"
                                title="Week view"
                                aria-pressed="false"
                                class="grid place-items-center"
                            >
                                <i data-i="columns-3" data-s="18"></i>
                                <span class="sr-only">Week</span>
                            </button>
                            <button
                                id="vl"
                                aria-label="List view"
                                title="List view"
                                aria-pressed="false"
                                class="grid place-items-center"
                            >
                                <i data-i="list" data-s="18"></i>
                                <span class="sr-only">List</span>
                            </button>
                        </div>
                    </div>
                </header>
                <div
                    id="calendar-surface"
                    class="flex-1 min-h-0 flex flex-col rounded-2xl border border-line bg-card overflow-hidden"
                >
                    <div
                        id="dow"
                        class="grid grid-cols-7 text-center text-[11px] lg:text-xs uppercase tracking-wide text-mute py-2 border-b border-line"
                    >
                        <div>Sun</div>
                        <div>Mon</div>
                        <div>Tue</div>
                        <div>Wed</div>
                        <div>Thu</div>
                        <div>Fri</div>
                        <div>Sat</div>
                    </div>
                    <div
                        id="grid"
                        class="grid gap-px bg-line flex-1 min-h-0"
                    ></div>
                    <div
                        id="tg"
                        class="flex-1 min-h-0 overflow-y-auto"
                        style="
                            display: none;
                            overscroll-behavior: contain;
                        "
                    ></div>
                    <div
                        id="listview"
                        class="flex-1 min-h-0 overflow-y-auto"
                        style="
                            display: none;
                            overscroll-behavior: contain;
                        "
                    ></div>
                </div>
                <p class="status text-xs text-accent mt-1"></p>
            </section>
              </div>

            </section>
            <section id="tasks-page" class="covey-page covey-tasks-page" aria-label="Tasks" aria-hidden="true" inert>
              <h1 class="sr-only">Tasks</h1>
            </section>
          </div>
          <div id="surface-controls" class="surface-controls" aria-label="Surface controls">
            <button id="setbtn" type="button" class="surface-companion surface-settings" aria-label="Settings" title="Settings">
              <i data-i="settings" data-s="18"></i>
            </button>
            <nav id="page-pagination" class="page-pagination" aria-label="Covey pages">
              <button type="button" class="page-pagination-target" data-page="glance" aria-label="Open Today" aria-current="page"><span></span></button>
              <button type="button" class="page-pagination-target" data-page="calendar" aria-label="Open Calendar"><span></span></button>
              <button type="button" class="page-pagination-target" data-page="tasks" aria-label="Open Tasks"><span></span></button>
            </nav>
            <button id="addbtn" type="button" class="surface-companion surface-add" aria-label="Add event">
              <i data-i="plus" data-s="18"></i><span>Add event</span>
            </button>
          </div>
        </div>
    `;
    return root.firstElementChild;
}

