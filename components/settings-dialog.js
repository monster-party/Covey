import { brandLogoMarkup } from "./brand-logo.js";

export function mountSettingsDialog(root) {
    if (!root) throw new Error("Settings root is missing.");
    root.innerHTML = `
        <div
            id="settings"
            class="hidden fixed inset-0 z-20 bg-black/50 items-center justify-center p-4"
            style="
                padding-top: calc(env(safe-area-inset-top, 0px) + 1rem);
                padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem);
            "
        >
            <div
                id="settings-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-title"
                class="bg-card border border-line rounded-2xl w-full max-h-full"
            >
                <aside id="settings-sidebar" aria-label="Settings navigation">
                    <h2 class="settings-sidebar-title">Settings</h2>
                    <div
                        id="stabs"
                        role="tablist"
                        aria-label="Settings sections"
                    ></div>
                </aside>
                <section class="settings-main">
                    <div class="settings-content-header">
                        <div class="flex min-w-0 items-center gap-2">
                        <button
                            id="calendar-add-back"
                            type="button"
                            class="settings-icon-button hidden shrink-0 place-items-center text-mute"
                            aria-label="Back to calendars"
                        ><i data-i="chevron-left" data-s="18"></i></button>
                            <h2 id="settings-title" class="text-xl font-medium">Calendars</h2>
                        </div>
                        <button
                            id="sclose"
                            class="settings-icon-button grid place-items-center text-mute"
                            aria-label="Close settings"
                        >
                            <i data-i="x"></i>
                        </button>
                    </div>
                    <div class="settings-scroll min-h-0 overflow-y-auto">
                    <div id="tab-calendars">
                        <section id="calendar-main-view" aria-hidden="false">
                            <div id="cals" class="flex flex-col"></div>
                            <p id="calendar-list-status" role="status" aria-live="polite" class="min-h-4 text-xs text-mute"></p>
                            <div id="calendar-add-section" class="mt-4 pt-2">
                                <button
                                    id="calendar-add-toggle"
                                    type="button"
                                    class="settings-button settings-button-quiet flex items-center gap-2"
                                >
                                    <i data-i="plus" data-s="16"></i>
                                    Add calendar
                                </button>
                            </div>

                        </section>
                    </div>
                    <div id="tab-people">
                        <section id="people-admin">
                            <div id="person-main-view">
                                <div class="mb-5 flex items-center justify-between gap-4">
                                    <h3 class="text-sm font-medium">Family members</h3>
                                    <button
                                        id="person-add-toggle"
                                        type="button"
                                        class="settings-button settings-button-primary inline-flex items-center gap-2"
                                    ><i data-i="plus" data-s="16"></i>Add person</button>
                                </div>
                                <div id="person-cards" class="person-roster"></div>
                                <p id="person-list-status" role="status" aria-live="polite" class="min-h-4 text-xs text-mute"></p>
                            </div>
                            <div id="person-form" class="settings-form hidden space-y-3">
                                <div class="person-form-grid">
                                    <div>
                                        <label class="block text-sm font-medium" for="person-name">
                                            Name
                                            <input
                                                id="person-name"
                                                maxlength="60"
                                                autocomplete="off"
                                                class="settings-field mt-1 w-full"
                                                placeholder="e.g. Stan"
                                            />
                                        </label>
                                        <div class="mt-6">
                                            <p class="mb-2 text-sm font-medium">Avatar</p>
                                            <div id="person-avatar-choices" class="person-avatar-grid"></div>
                                            <div id="person-bird-choices" class="person-bird-grid mt-2"></div>
                                        </div>
                                        <label class="settings-upload mt-3" for="person-image">
                                            <input id="person-image" type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" />
                                            <span>Upload a photo</span>
                                        </label>
                                        <div id="person-avatar-preview" class="hidden"></div>
                                    </div>
                                    <fieldset>
                                        <legend class="text-sm font-medium">Calendars</legend>
                                        <div id="person-calendar-choices" class="mt-2 grid grid-cols-1 gap-2"></div>
                                    </fieldset>
                                </div>
                                <div class="settings-footer">
                                    <div class="flex gap-2">
                                        <button
                                            id="person-add-cancel"
                                            type="button"
                                            class="settings-button settings-button-secondary flex-1"
                                        >Cancel</button>
                                        <button
                                            id="person-add-save"
                                            type="button"
                                            class="settings-button settings-button-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
                                        >Save person</button>
                                    </div>
                                    <p id="person-status" role="status" aria-live="polite" class="mt-2 text-xs text-mute empty:hidden"></p>
                                </div>
                            </div>
                        </section>
                    </div>
                    <section id="calendar-add-view" class="hidden" aria-hidden="true" inert>
                        <div id="calendar-add-form" class="settings-form space-y-4">
                            <label class="block text-sm font-medium" for="calendar-name">
                                Calendar name
                                <input
                                    id="calendar-name"
                                    maxlength="100"
                                    autocomplete="off"
                                    class="settings-field mt-1 w-full"
                                    placeholder="e.g. Sports"
                                />
                            </label>
                            <fieldset class="settings-section">
                                <legend class="text-sm font-medium">Appearance</legend>
                                <div class="mt-3 grid gap-3 sm:grid-cols-2">
                                    <button id="calendar-color-toggle" type="button" class="settings-disclosure" aria-controls="calendar-colors" aria-expanded="false"></button>
                                    <button id="calendar-icon-toggle" type="button" class="settings-disclosure" aria-controls="calendar-icons" aria-expanded="false"></button>
                                </div>
                                <div id="calendar-colors" class="settings-choice-grid hidden mt-3 grid grid-cols-4 gap-2"></div>
                                <div id="calendar-icons" class="settings-choice-grid hidden mt-3 grid grid-cols-4 gap-2"></div>
                            </fieldset>
                            <label class="flex min-h-11 items-center gap-3 text-sm text-mute"><input id="calendar-confirm" type="checkbox" class="h-4 w-4 shrink-0 accent-[var(--accent)]" /><span>This calendar already exists in iCloud.</span></label>
                            <div class="settings-footer">
                                <div class="flex gap-2">
                                    <button
                                        id="calendar-add-cancel"
                                        type="button"
                                        class="settings-button settings-button-secondary flex-1"
                                    >Cancel</button>
                                    <button
                                        id="calendar-add-save"
                                        type="button"
                                        disabled
                                        class="settings-button settings-button-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
                                    >Add calendar</button>
                                </div>
                                <p id="calendar-add-status" role="status" aria-live="polite" class="mt-2 text-xs text-mute empty:hidden"></p>
                            </div>
                        </div>
                    </section>
                    <div id="tab-view">
                        <section aria-labelledby="view-time-heading">
                            <h3 id="view-time-heading" class="settings-section-title">Time</h3>
                            <div class="settings-group mt-3">
                                <div class="settings-setting-row view-setting-row">
                                    <span class="settings-setting-copy">
                                        <span class="settings-setting-label">Time format</span>
                                        <span class="settings-setting-description">Choose how event times are displayed.</span>
                                    </span>
                                    <div id="timeformats" role="group" aria-label="Time format" class="settings-segmented flex"></div>
                                </div>
                                <div class="settings-setting-row view-setting-row">
                                    <span class="settings-setting-copy">
                                        <span class="settings-setting-label">Week view hours</span>
                                        <span class="settings-setting-description">Show the full day or focus on daytime hours.</span>
                                    </span>
                                    <div id="weekhours" role="group" aria-label="Week view hours" class="settings-segmented flex"></div>
                                </div>
                            </div>
                        </section>
                        <section class="mt-7" aria-labelledby="view-range-heading">
                            <h3 id="view-range-heading" class="settings-section-title">Date range</h3>
                            <div class="settings-group mt-3">
                                <div class="settings-setting-row view-setting-row">
                                    <span class="settings-setting-copy">
                                        <span class="settings-setting-label">Days shown</span>
                                        <span class="settings-setting-description">Set the number of days in week and list views.</span>
                                    </span>
                                    <div id="daybtns" role="group" aria-label="Days shown in week and list views" class="settings-stepper view-day-options"></div>
                                </div>
                            </div>
                        </section>
                        <section class="mt-7" aria-labelledby="view-display-heading">
                            <h3 id="view-display-heading" class="settings-section-title">Display</h3>
                            <div class="settings-group mt-3">
                                <div class="settings-setting-row view-setting-row">
                                    <span class="settings-setting-copy">
                                        <span class="settings-setting-label">Full screen</span>
                                        <span class="settings-setting-description">Use the entire display for Covey.</span>
                                    </span>
                                    <button id="settings-fullscreen" type="button" class="settings-button settings-button-secondary">Enter full screen</button>
                                </div>
                            </div>
                        </section>
                    </div>
                    <div id="tab-today">
                        <section aria-labelledby="ambient-display-heading">
                            <h3 id="ambient-display-heading" class="settings-section-title">Display</h3>
                            <div class="settings-group mt-3">
                                <div class="settings-setting-row">
                                    <span class="settings-setting-copy">
                                        <span id="ambient-mode-label" class="settings-setting-label">Return to Today</span>
                                        <span class="settings-setting-description">Make Today the home page after Covey is inactive.</span>
                                    </span>
                                    <span class="settings-actions">
                                        <button id="today-preview" type="button" class="settings-button settings-button-secondary">Open</button>
                                        <input id="today-enabled" type="checkbox" role="switch" aria-labelledby="ambient-mode-label" class="settings-toggle-input" />
                                    </span>
                                </div>
                                <label class="settings-setting-row">
                                    <span class="settings-setting-copy">
                                        <span class="settings-setting-label">Keep screen awake</span>
                                        <span class="settings-setting-description">Prevent the display from sleeping while Covey is visible. This may increase battery use.</span>
                                    </span>
                                    <input id="keep-screen-awake" type="checkbox" role="switch" class="settings-toggle-input" />
                                </label>
                                <p id="wake-lock-status" role="alert" class="settings-group-message text-xs text-mute empty:hidden"></p>
                            </div>
                        </section>
                        <section class="mt-7" aria-labelledby="ambient-weather-heading">
                            <h3 id="ambient-weather-heading" class="settings-section-title">Weather</h3>
                            <div class="settings-group mt-3">
                                <label class="settings-setting-row">
                                    <span class="settings-setting-copy">
                                        <span class="settings-setting-label">Show local weather</span>
                                        <span class="settings-setting-description">Include the current conditions in the family briefing.</span>
                                    </span>
                                    <input id="today-weather-enabled" type="checkbox" role="switch" checked class="settings-toggle-input" />
                                </label>
                                <div id="today-weather-fields" class="settings-group-fields">
                                    <div class="grid items-end gap-3 sm:grid-cols-[1fr_2fr_auto]">
                                        <label for="today-temperature-unit" class="block text-sm font-medium">Temperature unit<select id="today-temperature-unit" class="settings-select mt-1 w-full"><option value="F">Fahrenheit (°F)</option><option value="C">Celsius (°C)</option></select></label>
                                        <label for="today-weather-location" class="block text-sm font-medium">Weather location<input id="today-weather-location" type="text" maxlength="100" autocomplete="address-level2" placeholder="City or postal code" class="settings-field mt-1 w-full" /></label>
                                        <button id="today-weather-location-save" type="button" class="settings-button settings-button-secondary disabled:cursor-not-allowed">Save location</button>
                                    </div>
                                    <p class="mt-2 text-xs text-mute">Your location stays in this browser. Open-Meteo receives it only to find the forecast.</p>
                                    <p id="today-weather-location-status" role="status" aria-live="polite" class="mt-2 text-xs text-mute empty:hidden"></p>
                                </div>
                            </div>
                        </section>
                    </div>
                    <div id="tab-sounds">
                        <section aria-labelledby="sounds-master-heading">
                            <h3 id="sounds-master-heading" class="settings-section-title">Sound</h3>
                            <div class="settings-group mt-3">
                                <label class="settings-setting-row">
                                    <span class="settings-setting-copy">
                                        <span id="sounds-enabled-label" class="settings-setting-label">Sounds</span>
                                        <span class="settings-setting-description">Allow Covey to play household alerts.</span>
                                    </span>
                                    <input id="sounds-enabled" type="checkbox" role="switch" aria-labelledby="sounds-enabled-label" class="settings-toggle-input" />
                                </label>
                                <div id="sound-volume-controls" class="settings-group-fields settings-sound-controls">
                                    <label for="today-chime-volume" class="settings-setting-label">Volume</label>
                                    <input id="today-chime-volume" type="range" min="10" max="100" step="5" aria-describedby="today-chime-volume-value" />
                                    <output id="today-chime-volume-value" for="today-chime-volume">55%</output>
                                </div>
                            </div>
                        </section>
                        <section class="mt-7" aria-labelledby="sounds-alerts-heading">
                            <h3 id="sounds-alerts-heading" class="settings-section-title">Alerts</h3>
                            <div class="settings-group mt-3">
                                <div class="settings-setting-row">
                                    <span class="settings-setting-copy">
                                        <span id="event-start-sound-label" class="settings-setting-label">Events starting</span>
                                        <span class="settings-setting-description">Play a gentle chime when an event begins.</span>
                                    </span>
                                    <span class="settings-actions">
                                        <button id="today-chime-preview" type="button" class="settings-button settings-button-secondary">Play</button>
                                        <input id="today-event-chime" type="checkbox" role="switch" aria-labelledby="event-start-sound-label" class="settings-toggle-input" />
                                    </span>
                                </div>
                                <div class="settings-setting-row">
                                    <span class="settings-setting-copy">
                                        <span id="task-complete-sound-label" class="settings-setting-label">Tasks completed</span>
                                        <span class="settings-setting-description">Celebrate when a household task is completed.</span>
                                    </span>
                                    <span class="settings-actions">
                                        <button id="task-complete-preview" type="button" class="settings-button settings-button-secondary">Play</button>
                                        <input id="task-complete-sound" type="checkbox" role="switch" aria-labelledby="task-complete-sound-label" class="settings-toggle-input" />
                                    </span>
                                </div>
                            </div>
                        </section>
                    </div>
                    <div id="tab-appearance">
                        <section aria-labelledby="appearance-text-heading">
                            <h3 id="appearance-text-heading" class="settings-section-title">Text</h3>
                            <div class="settings-group mt-3">
                                <div class="settings-setting-row appearance-text-row">
                                    <span class="settings-setting-copy">
                                        <span class="settings-setting-label">Text size</span>
                                        <span class="settings-setting-description">Choose a comfortable size for the calendar display.</span>
                                    </span>
                                    <div id="textsizes" class="settings-segmented flex" role="group" aria-label="Text size"></div>
                                </div>
                            </div>
                        </section>
                        <section class="mt-7" aria-labelledby="appearance-color-heading">
                            <h3 id="appearance-color-heading" class="settings-section-title">Color</h3>
                            <div class="settings-group mt-3">
                                <div class="appearance-theme-copy settings-setting-copy">
                                    <span class="settings-setting-label">Theme</span>
                                    <span class="settings-setting-description">Select a palette for Covey.</span>
                                </div>
                                <div id="themes" class="appearance-theme-grid grid grid-cols-6 gap-2"></div>
                            </div>
                        </section>
                        <section class="mt-7" aria-labelledby="appearance-dark-heading">
                            <h3 id="appearance-dark-heading" class="settings-section-title">Dark mode</h3>
                            <div class="settings-group mt-3">
                                <label class="settings-setting-row">
                                    <span class="settings-setting-copy">
                                        <span class="settings-setting-label">Dark mode</span>
                                        <span class="settings-setting-description">Use Covey's darker color palette.</span>
                                    </span>
                                    <input id="darkmode" type="checkbox" role="switch" class="settings-toggle-input" />
                                </label>
                                <label class="settings-setting-row">
                                    <span class="settings-setting-copy">
                                        <span class="settings-setting-label">Switch automatically</span>
                                        <span class="settings-setting-description">Use dark mode during the hours you choose.</span>
                                    </span>
                                    <input id="autosw" type="checkbox" role="switch" class="settings-toggle-input" />
                                </label>
                                <div id="autotimes" class="settings-group-fields grid grid-cols-2 gap-3">
                                    <label class="settings-setting-label">Dark from<input id="dfrom" type="time" class="settings-field mt-1 w-full" /></label>
                                    <label class="settings-setting-label">Light from<input id="dto" type="time" class="settings-field mt-1 w-full" /></label>
                                </div>
                            </div>
                        </section>
                    </div>
                    <div
                        id="tab-about"
                        class="flex flex-col items-center text-center gap-3 py-2"
                    >
                        ${brandLogoMarkup("settings-about-logo")}
                        <p class="text-sm text-mute max-w-xs">
                            Covey is free, open-source software. Anyone can read
                            the code, change it, or run their own copy — no
                            accounts, no ads, no analytics.
                        </p>
                        <a
                            href="https://github.com/vinceangeloni/Covey"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="settings-button settings-button-secondary mt-1 inline-flex items-center gap-2"
                            ><i data-i="github" data-s="18"></i>View source on
                            GitHub</a
                        >
                        <p class="text-xs text-mute mt-2">
                            Built with plain HTML, CSS, and JavaScript — no
                            build step required.
                        </p>
                    </div>
                    </div>
                </section>
            </div>
        </div>
    `;
    return root.firstElementChild;
}

