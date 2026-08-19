(() => {
  const WEEK_COL_WIDTH = 90;
  const MONTH_COL_WIDTH = 160;
  const QUARTER_COL_WIDTH = 220;
  const ROW_HEIGHTS = { narrow: 32, normal: 46, wide: 64 };
  const BAR_HEIGHTS = { narrow: 18, normal: 32, wide: 32 };
  const DENSITY_LEVELS = ['narrow', 'normal', 'wide'];
  const DEFAULT_DENSITY = 'normal';
  const DENSITY_STORAGE_KEY = 'roadmap-gantt-density';
  const LABEL_WIDTH = 240;
  const HEADER_HEIGHT = 40;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const MIN_VISIBLE_WEEKS = 10;
  const PADDING_WEEKS_AFTER = 2;
  const DEFAULT_COLOR_1 = '#5b8cff';
  const DEFAULT_COLOR_2 = '#7c5cff';
  const PRESET_COLORS = [
    { name: 'Happy Red', hex: '#FF4853' },
    { name: 'Happy Orange', hex: '#FF8B3E' },
    { name: 'Happy Yellow', hex: '#FFD505' },
    { name: 'Happy Green', hex: '#4FCE65' },
    { name: 'Happy Blue', hex: '#5B8CFF' },
    { name: 'Happy Purple', hex: '#DC60C3' },
    { name: 'Light Grey', hex: '#E0E0E0' },
    { name: '60% Grey', hex: '#666666' },
    { name: 'Shadow Red', hex: '#B3323A' },
    { name: 'Shadow Orange', hex: '#B3612B' },
    { name: 'Shadow Yellow', hex: '#B39504' },
    { name: 'Shadow Green', hex: '#379047' },
    { name: 'Shadow Blue', hex: '#4062B3' },
    { name: 'Shadow Purple', hex: '#9A4389' },
    { name: '40% Grey', hex: '#999999' },
    { name: 'Dark Grey', hex: '#1C1C1C' },
  ];
  const PRESET_COLOR_NAMES = new Map(PRESET_COLORS.map((c) => [c.hex.toLowerCase(), c.name]));
  const TEAM_OPTIONS = [
    'Cyber', 'Data and BI', 'Delivery', 'Development', 'Digital Tech', 'Ecommerce', 'Enterprise', 'Operations',
  ];
  const PHASE_OPTIONS = ['Not Started', 'Discovery', 'Build', 'Test', 'Complete'];
  const DEFAULT_PHASE = 'Not Started';
  const HEALTH_OPTIONS = ['Green', 'Amber', 'Red'];
  const HEALTH_COLORS = { Green: '#4FCE65', Amber: '#FFC148', Red: '#FF4853' };
  const PHASE_ICON_FILES = {
    'Not Started': 'circle-0.svg',
    'Discovery': 'circle-2.svg',
    'Build': 'circle-4.svg',
    'Test': 'circle-6.svg',
    'Complete': 'circle-8.svg',
  };
  const VIEW_MODES = ['week', 'month', 'quarter'];
  const DEFAULT_VIEW_MODE = 'week';
  const VIEW_STORAGE_KEY = 'roadmap-gantt-view-mode';
  const ZOOM_STORAGE_KEY = 'roadmap-gantt-zoom';
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 2.5;
  const ZOOM_STEP = 0.25;
  const DEFAULT_ZOOM = 1;
  const THEME_STORAGE_KEY = 'roadmap-gantt-theme';
  const LABEL_WIDTH_STORAGE_KEY = 'roadmap-gantt-label-width';
  const MIN_LABEL_WIDTH = 160;
  const MAX_LABEL_WIDTH = 480;
  const LABEL_MODES = ['off', 'weeks', 'dates'];
  const DEFAULT_LABEL_MODE = 'dates';
  const LABEL_MODE_STORAGE_KEY = 'roadmap-gantt-label-mode';
  const DATES_STORAGE_KEY = 'roadmap-gantt-dates-visible';
  const TIMELINE_START_STORAGE_KEY = 'roadmap-gantt-timeline-start';
  const FILTER_COLLAPSED_STORAGE_KEY = 'roadmap-gantt-filter-collapsed';
  const PRINT_PAGE_WIDTH_PX = 1050; // approx usable width for a landscape page at 96dpi
  const TABLE = 'roadmap_tasks';

  const sprintHeaderEl = document.getElementById('sprint-header');
  const taskRowsEl = document.getElementById('task-rows');
  const addTaskBtn = document.getElementById('add-task-btn');
  const exportBtn = document.getElementById('export-btn');
  const exportDialog = document.getElementById('export-dialog');
  const exportCloseBtn = document.getElementById('export-close-btn');
  const exportJsonBtn = document.getElementById('export-json-btn');
  const exportCsvBtn = document.getElementById('export-csv-btn');
  const exportPngBtn = document.getElementById('export-png-btn');
  const exportPdfBtn = document.getElementById('export-pdf-btn');
  const autosortBtn = document.getElementById('autosort-btn');
  const saveStatusEl = document.getElementById('save-status');
  const fileStatusEl = document.getElementById('file-status');
  const emptyState = document.getElementById('empty-state');
  const ganttEl = document.getElementById('gantt');
  const todayLineEl = document.getElementById('today-line');
  const viewButtons = Array.from(document.querySelectorAll('.topbar-actions > .view-toggle > .view-btn'));

  const editDialog = document.getElementById('edit-dialog');
  const editForm = document.getElementById('edit-form');
  const editNameInput = document.getElementById('edit-name');
  const editStartInput = document.getElementById('edit-start');
  const editDurationInput = document.getElementById('edit-duration');
  const editColorInput = document.getElementById('edit-color');
  const editTeamInput = document.getElementById('edit-team');
  const editPhaseInput = document.getElementById('edit-phase');
  const editHealthInput = document.getElementById('edit-health');
  const editColorPresetsEl = document.getElementById('edit-color-presets');
  const editProjectNameEl = document.getElementById('edit-project-name');
  const editProjectBtn = document.getElementById('edit-project-btn');
  const editCancelBtn = document.getElementById('edit-cancel-btn');
  const editDeleteBtn = document.getElementById('edit-delete-btn');
  const zoomInBtn = document.getElementById('zoom-in-btn');
  const zoomOutBtn = document.getElementById('zoom-out-btn');
  const zoomLevelEl = document.getElementById('zoom-level');
  const displayBtn = document.getElementById('display-btn');
  const displayDialog = document.getElementById('display-dialog');
  const displayCloseBtn = document.getElementById('display-close-btn');
  const displayGroupButtons = Array.from(displayDialog.querySelectorAll('.view-btn'));
  const filterPanelEl = document.getElementById('filter-panel');
  const filterToggleBtn = document.getElementById('filter-toggle-btn');
  const filterActiveBadge = document.getElementById('filter-active-badge');
  const filterClearBtn = document.getElementById('filter-clear-btn');
  const filterTeamRowEl = document.getElementById('filter-team-row');
  const filterPhaseRowEl = document.getElementById('filter-phase-row');
  const filterColorRowEl = document.getElementById('filter-color-row');
  const cleanupBtn = document.getElementById('cleanup-btn');
  const cleanupDialog = document.getElementById('cleanup-dialog');
  const cleanupHintEl = document.getElementById('cleanup-hint');
  const cleanupTaskListEl = document.getElementById('cleanup-task-list');
  const cleanupCancelBtn = document.getElementById('cleanup-cancel-btn');
  const cleanupOkBtn = document.getElementById('cleanup-ok-btn');
  const timelineStartInput = document.getElementById('timeline-start-input');
  const labelColResizeHandle = document.getElementById('label-col-resize-handle');

  const supabaseClient = window.sbClient;
  const canEdit = () => window.currentAccess && window.currentAccess['roadmap-db'] === 'editor';

  let tasks = [];
  let saveTimer = null;
  let rowRefs = new Map(); // id -> { rowEl, barEl }
  let deletedTaskIds = new Set();
  let editingTaskId = null;

  // '' represents tasks with no team / no color set.
  let filterTeams = new Set();
  let filterPhases = new Set();
  let filterColors = new Set();

  let filterCollapsed = false;
  try {
    filterCollapsed = localStorage.getItem(FILTER_COLLAPSED_STORAGE_KEY) === 'true';
  } catch (err) {
    // localStorage unavailable — fall back to expanded.
  }

  let viewMode = DEFAULT_VIEW_MODE;
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (VIEW_MODES.includes(stored)) viewMode = stored;
  } catch (err) {
    // localStorage unavailable (e.g. private mode) — fall back to the default view.
  }

  let zoomLevel = DEFAULT_ZOOM;
  try {
    const storedZoom = parseFloat(localStorage.getItem(ZOOM_STORAGE_KEY));
    if (!Number.isNaN(storedZoom) && storedZoom >= ZOOM_MIN && storedZoom <= ZOOM_MAX) zoomLevel = storedZoom;
  } catch (err) {
    // localStorage unavailable — fall back to the default zoom.
  }

  let theme = 'light';
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark') theme = storedTheme;
  } catch (err) {
    // localStorage unavailable — fall back to the default theme.
  }

  let labelWidth = LABEL_WIDTH;
  try {
    const storedLabelWidth = parseFloat(localStorage.getItem(LABEL_WIDTH_STORAGE_KEY));
    if (!Number.isNaN(storedLabelWidth) && storedLabelWidth >= MIN_LABEL_WIDTH && storedLabelWidth <= MAX_LABEL_WIDTH) {
      labelWidth = storedLabelWidth;
    }
  } catch (err) {
    // localStorage unavailable — fall back to the default label width.
  }

  let labelMode = DEFAULT_LABEL_MODE;
  try {
    const storedLabelMode = localStorage.getItem(LABEL_MODE_STORAGE_KEY);
    if (LABEL_MODES.includes(storedLabelMode)) {
      labelMode = storedLabelMode;
    } else {
      // Migrate the old on/off toggle so existing users keep their preference.
      const storedDatesVisible = localStorage.getItem(DATES_STORAGE_KEY);
      if (storedDatesVisible === 'true' || storedDatesVisible === 'false') {
        labelMode = storedDatesVisible === 'true' ? 'dates' : 'off';
      }
    }
  } catch (err) {
    // localStorage unavailable — fall back to the default (dates label).
  }

  let density = DEFAULT_DENSITY;
  try {
    const storedDensity = localStorage.getItem(DENSITY_STORAGE_KEY);
    if (DENSITY_LEVELS.includes(storedDensity)) density = storedDensity;
  } catch (err) {
    // localStorage unavailable — fall back to the default density.
  }

  let ROW_HEIGHT = ROW_HEIGHTS[density];
  let BAR_HEIGHT = BAR_HEIGHTS[density];

  function firstOfCurrentMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  let timelineStartDate = firstOfCurrentMonth();
  try {
    const storedTimelineStart = localStorage.getItem(TIMELINE_START_STORAGE_KEY);
    const parsedTimelineStart = storedTimelineStart ? parseISODate(storedTimelineStart) : null;
    if (parsedTimelineStart) timelineStartDate = parsedTimelineStart;
  } catch (err) {
    // localStorage unavailable — fall back to the default timeline start.
  }

  // ---------- Date helpers ----------
  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function mondayOf(d) {
    const date = startOfDay(d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function daysBetween(a, b) {
    return Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);
  }

  function formatISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function parseISODate(str) {
    const parts = String(str || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatShort(date) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // ---------- Timeline / view-mode geometry ----------
  function pxPerDay() {
    let base;
    if (viewMode === 'month') base = MONTH_COL_WIDTH / 30.4368;
    else if (viewMode === 'quarter') base = QUARTER_COL_WIDTH / 91.3105;
    else base = WEEK_COL_WIDTH / 7;
    return base * zoomLevel;
  }

  function computeTimelineRange() {
    let maxEnd = null;
    tasks.forEach((t) => {
      const start = parseISODate(t.startDate);
      if (!start) return;
      const end = addDays(start, t.durationWeeks * 7);
      if (!maxEnd || end > maxEnd) maxEnd = end;
    });

    // The chosen timeline start is a hard edge: tasks that begin earlier are
    // clipped to it and rendered showing only their remaining duration.
    let rangeStart = mondayOf(timelineStartDate);

    if (!maxEnd) maxEnd = addDays(rangeStart, MIN_VISIBLE_WEEKS * 7);

    let rangeEnd = addDays(mondayOf(addDays(maxEnd, PADDING_WEEKS_AFTER * 7)), 7);

    const minEnd = addDays(rangeStart, MIN_VISIBLE_WEEKS * 7);
    if (rangeEnd < minEnd) rangeEnd = minEnd;

    if (viewMode === 'month') {
      rangeStart = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
      rangeEnd = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth() + 1, 1);
    } else if (viewMode === 'quarter') {
      const startQMonth = Math.floor(rangeStart.getMonth() / 3) * 3;
      rangeStart = new Date(rangeStart.getFullYear(), startQMonth, 1);
      const endQMonth = Math.floor(rangeEnd.getMonth() / 3) * 3 + 3;
      rangeEnd = new Date(rangeEnd.getFullYear(), endQMonth, 1);
    }

    return { start: rangeStart, end: rangeEnd };
  }

  function buildColumns(range) {
    const ppd = pxPerDay();
    const cols = [];

    if (viewMode === 'week') {
      let cur = range.start;
      while (cur < range.end) {
        const next = addDays(cur, 7);
        cols.push({ start: cur, end: next, label: formatShort(cur) });
        cur = next;
      }
    } else if (viewMode === 'month') {
      let cur = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
      while (cur < range.end) {
        const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        cols.push({ start: cur, end: next, label: cur.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) });
        cur = next;
      }
    } else {
      let cur = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
      while (cur < range.end) {
        const next = new Date(cur.getFullYear(), cur.getMonth() + 3, 1);
        const q = Math.floor(cur.getMonth() / 3) + 1;
        cols.push({ start: cur, end: next, label: `Q${q} ${cur.getFullYear()}` });
        cur = next;
      }
    }

    return cols.map((c) => ({ ...c, widthPx: daysBetween(c.start, c.end) * ppd }));
  }

  function timelineWidthPx(range) {
    return daysBetween(range.start, range.end) * pxPerDay();
  }

  function xForDate(range, date) {
    return daysBetween(range.start, date) * pxPerDay();
  }

  // Tasks starting before the visible range are clipped to its left edge and
  // drawn showing only their remaining duration, rather than being hidden.
  function visibleStart(range, start) {
    return start < range.start ? range.start : start;
  }

  function barLeftPx(range, task) {
    const start = parseISODate(task.startDate);
    return xForDate(range, visibleStart(range, start)) + 4;
  }

  function barWidthPx(range, task) {
    const start = parseISODate(task.startDate);
    const end = addDays(start, task.durationWeeks * 7);
    // Tasks ending before the range start are filtered out by visibleTasks()
    // before reaching here; clamp remains as a safety net against negative
    // widths (which would crash the canvas rounded-rect export).
    return Math.max(0, daysBetween(visibleStart(range, start), end) * pxPerDay() - 8);
  }

  function formatDatesBarLabel(task) {
    const start = parseISODate(task.startDate);
    const end = addDays(start, task.durationWeeks * 7 - 1);
    return `${formatShort(start)} – ${formatShort(end)}`;
  }

  function formatWeeksBarLabel(task) {
    const n = task.durationWeeks;
    return `${n} week${n === 1 ? '' : 's'}`;
  }

  function formatBarLabel(task) {
    return labelMode === 'weeks' ? formatWeeksBarLabel(task) : formatDatesBarLabel(task);
  }

  function snapDaysDeltaToWeek(px) {
    const days = px / pxPerDay();
    return Math.round(days / 7) * 7;
  }

  // ---------- Color ----------
  function darkenColor(hex, amount) {
    const clean = String(hex || '').replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    const num = parseInt(full, 16);
    if (Number.isNaN(num)) return hex;
    let r = (num >> 16) & 0xff;
    let g = (num >> 8) & 0xff;
    let b = num & 0xff;
    r = Math.max(0, Math.round(r * (1 - amount)));
    g = Math.max(0, Math.round(g * (1 - amount)));
    b = Math.max(0, Math.round(b * (1 - amount)));
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  function barColors(task) {
    if (task.color) return [task.color, darkenColor(task.color, 0.25)];
    return [DEFAULT_COLOR_1, DEFAULT_COLOR_2];
  }

  function applyBarColor(bar, task) {
    const [c1] = barColors(task);
    bar.style.background = c1;
  }

  // ---------- Supabase row <-> task mapping ----------
  function rowToTask(row) {
    const parsed = parseISODate(row.start_date) || mondayOf(new Date());
    return {
      id: String(row.id),
      name: row.name || '',
      startDate: formatISODate(mondayOf(parsed)),
      durationWeeks: Math.max(1, parseInt(row.duration_weeks, 10) || 1),
      order: Number.isFinite(row.sort_order) ? row.sort_order : 0,
      color: row.color || '',
      team: row.team || '',
      phase: PHASE_OPTIONS.includes(row.phase) ? row.phase : DEFAULT_PHASE,
      health: HEALTH_OPTIONS.includes(row.health) ? row.health : '',
      projectId: row.project_id || null,
      projectName: (row.projects && row.projects.canonical_name) || null,
    };
  }

  function taskToRow(t) {
    return {
      id: t.id,
      name: t.name,
      start_date: t.startDate,
      duration_weeks: t.durationWeeks,
      sort_order: t.order,
      color: t.color,
      team: t.team,
      phase: t.phase,
      health: t.health || null,
      project_id: t.projectId || null,
    };
  }

  function serializeJson(list) {
    const sorted = [...list].sort((a, b) => a.order - b.order);
    const data = sorted.map((t) => ({
      id: t.id,
      name: t.name,
      startDate: t.startDate,
      durationWeeks: t.durationWeeks,
      order: t.order,
      color: t.color,
      team: t.team,
      phase: t.phase,
      health: t.health,
    }));
    return JSON.stringify(data, null, 2) + '\n';
  }

  const SEED_TASKS = [
    { name: 'Discovery & Requirements', startWeekOffset: 0, durationWeeks: 2 },
    { name: 'UX Design', startWeekOffset: 2, durationWeeks: 2 },
    { name: 'Backend API', startWeekOffset: 4, durationWeeks: 3 },
    { name: 'Frontend Build', startWeekOffset: 6, durationWeeks: 3 },
    { name: 'Integration Testing', startWeekOffset: 10, durationWeeks: 2 },
    { name: 'Launch', startWeekOffset: 12, durationWeeks: 1 },
  ];

  function buildSeedTasks() {
    const anchor = mondayOf(new Date());
    return SEED_TASKS.map((t, idx) => ({
      id: uid(),
      name: t.name,
      startDate: formatISODate(addDays(anchor, t.startWeekOffset * 7)),
      durationWeeks: t.durationWeeks,
      order: idx,
      color: '',
      team: '',
      phase: DEFAULT_PHASE,
      health: '',
    }));
  }

  // ---------- Supabase connection ----------
  function setFileStatus(text, cls) {
    fileStatusEl.textContent = text;
    fileStatusEl.className = 'file-status' + (cls ? ' ' + cls : '');
  }

  function showGantt(show) {
    emptyState.hidden = show;
    ganttEl.hidden = !show;
    addTaskBtn.disabled = !show || !canEdit();
    cleanupBtn.disabled = !show || !canEdit();
    exportBtn.disabled = !show;
    autosortBtn.disabled = !show || !canEdit();
    taskRowsEl.classList.toggle('view-only', !canEdit());
  }

  async function loadTasks() {
    setFileStatus('Connecting...', '');
    const { data, error } = await supabaseClient
      .from(TABLE)
      .select('*, projects(canonical_name)')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error(error);
      setFileStatus('Connection error', 'error');
      emptyState.querySelector('p').textContent = 'Could not load the roadmap: ' + error.message;
      return;
    }

    if (!data.length) {
      tasks = buildSeedTasks();
      setFileStatus('Connected to Supabase', 'connected');
      showGantt(true);
      render();
      scheduleSave();
      return;
    }

    tasks = data.map(rowToTask).sort((a, b) => a.order - b.order);
    setFileStatus('Connected to Supabase', 'connected');
    showGantt(true);
    render();
  }

  // ---------- View mode ----------
  function syncViewButtons() {
    viewButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === viewMode));
  }

  function setViewMode(mode) {
    if (!VIEW_MODES.includes(mode) || mode === viewMode) return;
    viewMode = mode;
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    } catch (err) {
      // ignore — persistence is a convenience, not a requirement
    }
    syncViewButtons();
    render();
  }

  // ---------- Zoom ----------
  function syncZoomButtons() {
    zoomLevelEl.textContent = Math.round(zoomLevel * 100) + '%';
    zoomOutBtn.disabled = zoomLevel <= ZOOM_MIN;
    zoomInBtn.disabled = zoomLevel >= ZOOM_MAX;
  }

  function setZoom(level) {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, level));
    if (clamped === zoomLevel) return;
    zoomLevel = clamped;
    try {
      localStorage.setItem(ZOOM_STORAGE_KEY, String(zoomLevel));
    } catch (err) {
      // ignore — persistence is a convenience, not a requirement
    }
    syncZoomButtons();
    render();
  }

  function zoomIn() {
    setZoom(zoomLevel + ZOOM_STEP);
  }

  function zoomOut() {
    setZoom(zoomLevel - ZOOM_STEP);
  }

  // ---------- Theme ----------
  function applyTheme() {
    document.documentElement.dataset.theme = theme;
  }

  function setTheme(next) {
    if ((next !== 'dark' && next !== 'light') || next === theme) return;
    theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (err) {
      // ignore — persistence is a convenience, not a requirement
    }
    applyTheme();
    syncDisplayDialog();
  }

  // ---------- Task column width ----------
  function applyLabelWidth() {
    document.documentElement.style.setProperty('--label-width', labelWidth + 'px');
  }

  function startLabelColResize(e) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = labelWidth;

    labelColResizeHandle.classList.add('active');
    document.body.style.userSelect = 'none';

    function onMove(ev) {
      const dx = ev.clientX - startX;
      labelWidth = Math.max(MIN_LABEL_WIDTH, Math.min(MAX_LABEL_WIDTH, startWidth + dx));
      applyLabelWidth();
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      labelColResizeHandle.classList.remove('active');
      document.body.style.userSelect = '';
      try {
        localStorage.setItem(LABEL_WIDTH_STORAGE_KEY, String(labelWidth));
      } catch (err) {
        // ignore — persistence is a convenience, not a requirement
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ---------- Bar label mode (off / weeks / dates) ----------
  function setLabelMode(mode) {
    if (!LABEL_MODES.includes(mode) || mode === labelMode) return;
    labelMode = mode;
    try {
      localStorage.setItem(LABEL_MODE_STORAGE_KEY, labelMode);
    } catch (err) {
      // ignore — persistence is a convenience, not a requirement
    }
    syncDisplayDialog();
    render();
  }

  // ---------- Density (row height) ----------
  function applyDensity() {
    document.documentElement.dataset.density = density;
    ROW_HEIGHT = ROW_HEIGHTS[density];
    BAR_HEIGHT = BAR_HEIGHTS[density];
  }

  function setDensity(level) {
    if (!DENSITY_LEVELS.includes(level) || level === density) return;
    density = level;
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, density);
    } catch (err) {
      // ignore — persistence is a convenience, not a requirement
    }
    applyDensity();
    syncDisplayDialog();
    render();
  }

  // ---------- Display options popup (label / density / theme) ----------
  function syncDisplayDialog() {
    const current = { label: labelMode, density, theme };
    displayGroupButtons.forEach((btn) => {
      const { group, value } = btn.dataset;
      btn.classList.toggle('active', current[group] === value);
    });
  }

  function openDisplayDialog() {
    syncDisplayDialog();
    displayDialog.showModal();
  }

  // ---------- Filter popup (team / color) ----------
  function teamsInUse() {
    const present = new Set(tasks.map((t) => t.team || ''));
    const ordered = TEAM_OPTIONS.filter((c) => present.has(c));
    if (present.has('')) ordered.push('');
    return ordered;
  }

  function phasesInUse() {
    const present = new Set(tasks.map((t) => (PHASE_OPTIONS.includes(t.phase) ? t.phase : DEFAULT_PHASE)));
    return PHASE_OPTIONS.filter((p) => present.has(p));
  }

  function colorsInUse() {
    const present = new Set(tasks.map((t) => (t.color || '').toLowerCase()));
    const ordered = [...present].filter((c) => c).sort();
    if (present.has('')) ordered.push('');
    return ordered;
  }

  function toggleFilterValue(set, value) {
    if (set.has(value)) set.delete(value);
    else set.add(value);
  }

  function syncFilterBadge() {
    const activeCount = filterTeams.size + filterPhases.size + filterColors.size;
    filterActiveBadge.hidden = activeCount === 0;
    filterActiveBadge.textContent = String(activeCount);
  }

  // Builds one row of pills for a filter category: an "All" pill that clears
  // the category, followed by one pill per value in use.
  function renderFilterPillRow(container, options, activeSet, pillClass, labelFn, colorFn) {
    container.innerHTML = '';
    if (!options.length) {
      const empty = document.createElement('span');
      empty.className = 'filter-empty';
      empty.textContent = 'Nothing set yet.';
      container.appendChild(empty);
      return;
    }

    const allPill = document.createElement('button');
    allPill.type = 'button';
    allPill.className = 'filter-pill all-pill';
    allPill.textContent = 'All';
    allPill.classList.toggle('active', activeSet.size === 0);
    allPill.addEventListener('click', () => {
      activeSet.clear();
      render();
    });
    container.appendChild(allPill);

    options.forEach((value) => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `filter-pill ${pillClass}`;
      const label = labelFn(value);
      if (colorFn) {
        // Color pills show the color itself rather than a text label.
        const { background, border } = colorFn(value);
        pill.style.background = background;
        pill.style.setProperty('--pill-border', border);
        pill.title = label;
        pill.setAttribute('aria-label', label);
      } else {
        pill.textContent = label;
      }
      pill.classList.toggle('active', activeSet.has(value));
      pill.addEventListener('click', () => {
        toggleFilterValue(activeSet, value);
        render();
      });
      container.appendChild(pill);
    });
  }

  function renderFilterPanel() {
    renderFilterPillRow(filterTeamRowEl, teamsInUse(), filterTeams, 'filter-pill-team', (v) => v || 'None');
    renderFilterPillRow(filterPhaseRowEl, phasesInUse(), filterPhases, 'filter-pill-phase', (v) => v);
    renderFilterPillRow(
      filterColorRowEl,
      colorsInUse(),
      filterColors,
      'filter-pill-color',
      (v) => (v ? (PRESET_COLOR_NAMES.get(v) || v) : 'Default'),
      (v) => ({
        background: v || `linear-gradient(135deg, ${DEFAULT_COLOR_1}, ${DEFAULT_COLOR_2})`,
        border: v || DEFAULT_COLOR_1,
      })
    );
    syncFilterBadge();
  }

  function applyFilterCollapsed() {
    filterPanelEl.classList.toggle('collapsed', filterCollapsed);
    filterToggleBtn.setAttribute('aria-expanded', String(!filterCollapsed));
  }

  function setFilterCollapsed(collapsed) {
    filterCollapsed = collapsed;
    try {
      localStorage.setItem(FILTER_COLLAPSED_STORAGE_KEY, String(filterCollapsed));
    } catch (err) {
      // ignore — persistence is a convenience, not a requirement
    }
    applyFilterCollapsed();
  }

  function clearFilters() {
    filterTeams.clear();
    filterPhases.clear();
    filterColors.clear();
    render();
  }

  // ---------- Timeline start date ----------
  function syncTimelineStartInput() {
    timelineStartInput.value = formatISODate(timelineStartDate);
  }

  function setTimelineStartDate(date) {
    timelineStartDate = startOfDay(date);
    try {
      localStorage.setItem(TIMELINE_START_STORAGE_KEY, formatISODate(timelineStartDate));
    } catch (err) {
      // ignore — persistence is a convenience, not a requirement
    }
    render();
  }

  // ---------- Rendering ----------
  function uid() {
    return 't' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function sortedTasks() {
    return [...tasks].sort((a, b) => a.order - b.order);
  }

  // Tasks that end before the visible range starts have no remaining
  // duration to show, so they're left out of the timeline entirely.
  function taskPassesFilter(t) {
    if (filterTeams.size && !filterTeams.has(t.team || '')) return false;
    if (filterPhases.size && !filterPhases.has(PHASE_OPTIONS.includes(t.phase) ? t.phase : DEFAULT_PHASE)) return false;
    if (filterColors.size && !filterColors.has((t.color || '').toLowerCase())) return false;
    return true;
  }

  function visibleTasks(range) {
    return sortedTasks().filter((t) => {
      if (!taskPassesFilter(t)) return false;
      const start = parseISODate(t.startDate);
      if (!start) return false;
      const end = addDays(start, t.durationWeeks * 7);
      return end > range.start;
    });
  }

  function renderColumnCells(container, columns, withLabel) {
    container.innerHTML = '';
    columns.forEach((col) => {
      const el = document.createElement('div');
      el.className = withLabel ? 'grid-col sprint-col' : 'grid-col';
      el.style.width = col.widthPx + 'px';
      if (withLabel) el.textContent = col.label;
      container.appendChild(el);
    });
  }

  function renderTodayLine(range) {
    const today = startOfDay(new Date());
    if (today < range.start || today >= range.end) {
      todayLineEl.hidden = true;
      return;
    }
    todayLineEl.hidden = false;
    todayLineEl.style.left = (labelWidth + xForDate(range, today)) + 'px';
  }

  function render() {
    renderFilterPanel();
    const range = computeTimelineRange();
    const columns = buildColumns(range);
    const totalWidth = timelineWidthPx(range);

    renderColumnCells(sprintHeaderEl, columns, true);
    sprintHeaderEl.style.width = totalWidth + 'px';

    renderTodayLine(range);

    taskRowsEl.innerHTML = '';
    rowRefs = new Map();

    visibleTasks(range).forEach((task) => {
      const row = document.createElement('div');
      row.className = 'task-row';
      row.dataset.id = task.id;

      const label = document.createElement('div');
      label.className = 'task-label';

      const healthTag = document.createElement('span');
      healthTag.className = 'health-tag';
      if (HEALTH_OPTIONS.includes(task.health)) {
        healthTag.style.background = HEALTH_COLORS[task.health];
        healthTag.title = `Health: ${task.health}`;
      }
      label.appendChild(healthTag);

      const phaseIcon = document.createElement('img');
      phaseIcon.className = 'phase-icon';
      const phase = PHASE_OPTIONS.includes(task.phase) ? task.phase : DEFAULT_PHASE;
      phaseIcon.src = PHASE_ICON_FILES[phase];
      phaseIcon.alt = phase;
      phaseIcon.title = `Phase: ${phase}`;
      phaseIcon.addEventListener('click', () => openEditDialog(task));
      label.appendChild(phaseIcon);

      const nameInput = document.createElement('input');
      nameInput.className = 'task-name';
      nameInput.value = task.name;
      nameInput.addEventListener('input', () => {
        task.name = nameInput.value;
        scheduleSave();
      });
      nameInput.addEventListener('dblclick', (e) => {
        e.preventDefault();
        openEditDialog(task);
      });
      label.appendChild(nameInput);

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'edit-btn';
      editBtn.textContent = '✎';
      editBtn.title = 'Edit project';
      editBtn.addEventListener('click', () => openEditDialog(task));
      label.appendChild(editBtn);

      row.appendChild(label);

      const track = document.createElement('div');
      track.className = 'row-track';
      track.style.width = totalWidth + 'px';
      renderColumnCells(track, columns, false);

      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.left = barLeftPx(range, task) + 'px';
      bar.style.width = barWidthPx(range, task) + 'px';
      applyBarColor(bar, task);

      if (labelMode !== 'off') {
        const barLabel = document.createElement('span');
        barLabel.className = 'bar-label';
        barLabel.textContent = formatBarLabel(task);
        bar.appendChild(barLabel);
      }

      const leftHandle = document.createElement('div');
      leftHandle.className = 'resize-handle left';
      bar.appendChild(leftHandle);

      const rightHandle = document.createElement('div');
      rightHandle.className = 'resize-handle right';
      bar.appendChild(rightHandle);

      track.appendChild(bar);
      row.appendChild(track);
      taskRowsEl.appendChild(row);

      rowRefs.set(task.id, { rowEl: row, barEl: bar });

      leftHandle.addEventListener('mousedown', (e) => startResize(e, task, 'left', range));
      rightHandle.addEventListener('mousedown', (e) => startResize(e, task, 'right', range));
      bar.addEventListener('mousedown', (e) => {
        if (e.target === leftHandle || e.target === rightHandle) return;
        startMove(e, task, range);
      });
    });
  }

  // --- Move + reorder ---
  function startMove(e, task, range) {
    if (!canEdit()) return;
    e.preventDefault();
    const { rowEl, barEl } = rowRefs.get(task.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const origStart = parseISODate(task.startDate);

    const order = visibleTasks(range);
    const startIndex = order.findIndex((t) => t.id === task.id);
    const origIndexMap = new Map(order.map((t, i) => [t.id, i]));
    let workingOrder = order.map((t) => t.id);

    rowEl.classList.add('dragging');
    barEl.classList.add('dragging');
    document.body.style.userSelect = 'none';

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      // Horizontal: move in time, snapped to whole weeks
      const deltaDays = snapDaysDeltaToWeek(dx);
      const newStart = addDays(origStart, deltaDays);
      const previewTask = { startDate: formatISODate(newStart), durationWeeks: task.durationWeeks };
      barEl.style.left = barLeftPx(range, previewTask) + 'px';
      barEl.style.width = barWidthPx(range, previewTask) + 'px';
      task._pendingStartDate = formatISODate(newStart);

      // Vertical: reorder
      const targetIndex = Math.max(
        0,
        Math.min(order.length - 1, startIndex + Math.round(dy / ROW_HEIGHT))
      );
      const curIndex = workingOrder.indexOf(task.id);
      if (targetIndex !== curIndex) {
        workingOrder.splice(curIndex, 1);
        workingOrder.splice(targetIndex, 0, task.id);
      }

      workingOrder.forEach((id) => {
        if (id === task.id) return;
        const refs = rowRefs.get(id);
        if (!refs) return;
        const newIdx = workingOrder.indexOf(id);
        const origIdx = origIndexMap.get(id);
        refs.rowEl.style.transform = `translateY(${(newIdx - origIdx) * ROW_HEIGHT}px)`;
      });
      rowEl.style.transform = `translateY(${dy}px)`;
      rowEl.style.zIndex = 50;

      task._pendingOrder = workingOrder;
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';

      if (task._pendingStartDate) {
        task.startDate = task._pendingStartDate;
        delete task._pendingStartDate;
      }
      if (task._pendingOrder) {
        task._pendingOrder.forEach((id, idx) => {
          const t = tasks.find((tt) => tt.id === id);
          if (t) t.order = idx;
        });
        delete task._pendingOrder;
      }

      render();
      scheduleSave();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // --- Resize ---
  function startResize(e, task, side, range) {
    if (!canEdit()) return;
    e.preventDefault();
    e.stopPropagation();
    const { barEl } = rowRefs.get(task.id);
    const startX = e.clientX;
    const origStart = parseISODate(task.startDate);
    const origDurationWeeks = task.durationWeeks;

    barEl.classList.add('dragging');
    document.body.style.userSelect = 'none';

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const deltaWeeks = snapDaysDeltaToWeek(dx) / 7;

      let newStart = origStart;
      let newDurationWeeks = origDurationWeeks;

      if (side === 'right') {
        newDurationWeeks = Math.max(1, origDurationWeeks + deltaWeeks);
      } else {
        const maxDelta = origDurationWeeks - 1;
        const clampedDelta = Math.min(maxDelta, deltaWeeks);
        newStart = addDays(origStart, clampedDelta * 7);
        newDurationWeeks = origDurationWeeks - clampedDelta;
      }

      const previewTask = { startDate: formatISODate(newStart), durationWeeks: newDurationWeeks };
      barEl.style.left = barLeftPx(range, previewTask) + 'px';
      barEl.style.width = barWidthPx(range, previewTask) + 'px';

      task._pendingStartDate = formatISODate(newStart);
      task._pendingDurationWeeks = newDurationWeeks;
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';

      if (task._pendingStartDate) task.startDate = task._pendingStartDate;
      if (task._pendingDurationWeeks) task.durationWeeks = task._pendingDurationWeeks;
      delete task._pendingStartDate;
      delete task._pendingDurationWeeks;

      render();
      scheduleSave();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    deletedTaskIds.add(id);
    sortedTasks().forEach((t, idx) => (t.order = idx));
    render();
    scheduleSave();
  }

  // ---------- Data clean up (remove finished tasks) ----------
  function taskEndDate(task) {
    const start = parseISODate(task.startDate);
    if (!start) return null;
    return addDays(start, task.durationWeeks * 7);
  }

  function finishedTasks() {
    const today = startOfDay(new Date());
    return tasks
      .filter((t) => {
        const end = taskEndDate(t);
        return end && end <= today;
      })
      .sort((a, b) => taskEndDate(a) - taskEndDate(b));
  }

  function openCleanupDialog() {
    const finished = finishedTasks();
    cleanupTaskListEl.innerHTML = '';

    if (!finished.length) {
      cleanupHintEl.textContent = 'No finished projects found — nothing to remove.';
      cleanupOkBtn.hidden = true;
    } else {
      cleanupHintEl.textContent = 'These projects have already finished. Remove them?';
      cleanupOkBtn.hidden = false;
      finished.forEach((t) => {
        const li = document.createElement('li');
        li.className = 'cleanup-task-item';
        const name = document.createElement('span');
        name.textContent = t.name || '(untitled)';
        const dates = document.createElement('span');
        dates.className = 'cleanup-task-dates';
        dates.textContent = formatDatesBarLabel(t);
        li.appendChild(name);
        li.appendChild(dates);
        cleanupTaskListEl.appendChild(li);
      });
    }

    cleanupDialog.showModal();
  }

  function confirmCleanup() {
    if (!canEdit()) return;
    const finishedIds = new Set(finishedTasks().map((t) => t.id));
    finishedIds.forEach((id) => deletedTaskIds.add(id));
    tasks = tasks.filter((t) => !finishedIds.has(t.id));
    sortedTasks().forEach((t, idx) => (t.order = idx));
    cleanupDialog.close();
    render();
    scheduleSave();
  }

  function autoSortTasks() {
    if (!canEdit()) return;
    tasks
      .slice()
      .sort((a, b) => {
        const startCmp = parseISODate(a.startDate) - parseISODate(b.startDate);
        if (startCmp !== 0) return startCmp;
        const durCmp = a.durationWeeks - b.durationWeeks;
        if (durCmp !== 0) return durCmp;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      })
      .forEach((t, idx) => (t.order = idx));
    render();
    scheduleSave();
  }

  function addTask() {
    if (!canEdit()) return;
    if (!window.ProjectPicker) return;
    window.ProjectPicker.open({ originApp: 'roadmap-db', query: '', excludeDelivered: true }).then((project) => {
      if (!project) return;
      addTaskForProject(project);
    });
  }

  function addTaskForProject(project) {
    const newTask = {
      id: uid(),
      name: project.canonical_name,
      startDate: formatISODate(mondayOf(new Date())),
      durationWeeks: 1,
      order: tasks.length,
      color: '#5b8cff',
      team: '',
      phase: DEFAULT_PHASE,
      health: '',
      projectId: project.id,
      projectName: project.canonical_name,
    };
    tasks.push(newTask);
    render();
    scheduleSave();
    const refs = rowRefs.get(newTask.id);
    if (refs) {
      const input = refs.rowEl.querySelector('.task-name');
      if (input) {
        input.focus();
        input.select();
      }
    }
  }

  // ---------- Edit dialog ----------
  function buildColorPresets() {
    editColorPresetsEl.innerHTML = '';
    PRESET_COLORS.forEach(({ name, hex }) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = hex;
      swatch.title = name;
      swatch.setAttribute('aria-label', name);
      swatch.addEventListener('click', () => {
        editColorInput.value = hex;
      });
      editColorPresetsEl.appendChild(swatch);
    });
  }

  function openEditDialog(task) {
    if (!canEdit()) return;
    editingTaskId = task.id;
    editNameInput.value = task.name;
    editStartInput.value = task.startDate;
    editDurationInput.value = task.durationWeeks;
    editColorInput.value = task.color || DEFAULT_COLOR_1;
    editTeamInput.value = task.team || '';
    editPhaseInput.value = task.phase || DEFAULT_PHASE;
    editHealthInput.value = task.health || '';
    editProjectNameEl.textContent = task.projectName || task.projectId || 'Not linked';
    editDialog.showModal();
    editNameInput.focus();
  }

  buildColorPresets();

  editProjectBtn.addEventListener('click', () => {
    const task = tasks.find((t) => t.id === editingTaskId);
    if (!task || !window.ProjectPicker) return;
    window.ProjectPicker.open({ originApp: 'roadmap-db', query: task.name || '', excludeDelivered: true }).then((project) => {
      if (!project) return;
      task.projectId = project.id;
      task.projectName = project.canonical_name;
      editProjectNameEl.textContent = project.canonical_name;
      scheduleSave();
    });
  });

  editCancelBtn.addEventListener('click', () => editDialog.close());

  editDeleteBtn.addEventListener('click', () => {
    const task = tasks.find((t) => t.id === editingTaskId);
    if (!task) return;
    const confirmed = window.confirm(`Delete "${task.name || 'Untitled'}"? This cannot be undone.`);
    if (!confirmed) return;
    editDialog.close();
    deleteTask(task.id);
  });

  editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const task = tasks.find((t) => t.id === editingTaskId);
    editDialog.close();
    if (!task) return;

    task.name = editNameInput.value.trim() || 'Untitled';
    const chosen = parseISODate(editStartInput.value);
    if (chosen) task.startDate = formatISODate(mondayOf(chosen));
    task.durationWeeks = Math.max(1, parseInt(editDurationInput.value, 10) || 1);
    task.color = editColorInput.value || '';
    task.team = editTeamInput.value || '';
    task.phase = editPhaseInput.value || DEFAULT_PHASE;
    task.health = editHealthInput.value || '';

    render();
    scheduleSave();
  });

  // ---------- Export ----------
  function baseFileName() {
    return 'roadmap';
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function truncateToWidth(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 1 && ctx.measureText(truncated + '…').width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '…';
  }

  function drawGanttToCanvas() {
    const range = computeTimelineRange();
    const order = visibleTasks(range);
    const columns = buildColumns(range);
    const width = labelWidth + timelineWidthPx(range);
    const height = HEADER_HEIGHT + order.length * ROW_HEIGHT;

    const scale = 2; // render at 2x for a crisp export
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = Math.max(height, 1) * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    const colors = {
      bg: '#ffffff',
      panelAlt: '#f4f5f7',
      border: '#d7dae0',
      text: '#16181d',
      muted: '#5b6472',
      accent: '#3b6fe0',
    };

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = colors.panelAlt;
    ctx.fillRect(0, 0, width, HEADER_HEIGHT);

    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(0, HEADER_HEIGHT + 0.5);
    ctx.lineTo(width, HEADER_HEIGHT + 0.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(labelWidth + 0.5, 0);
    ctx.lineTo(labelWidth + 0.5, height);
    ctx.stroke();

    ctx.fillStyle = colors.muted;
    ctx.font = "600 11px -apple-system, 'Segoe UI', Roboto, sans-serif";
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('TASK', 12, HEADER_HEIGHT / 2);

    let colX = labelWidth;
    columns.forEach((col) => {
      ctx.strokeStyle = colors.border;
      ctx.beginPath();
      ctx.moveTo(colX + col.widthPx + 0.5, 0);
      ctx.lineTo(colX + col.widthPx + 0.5, HEADER_HEIGHT);
      ctx.stroke();

      ctx.fillStyle = colors.muted;
      ctx.font = "600 12px -apple-system, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = 'left';
      ctx.fillText(col.label, colX + 4, HEADER_HEIGHT / 2);
      colX += col.widthPx;
    });

    order.forEach((task, idx) => {
      const y = HEADER_HEIGHT + idx * ROW_HEIGHT;

      ctx.strokeStyle = colors.border;
      ctx.beginPath();
      ctx.moveTo(0, y + ROW_HEIGHT + 0.5);
      ctx.lineTo(width, y + ROW_HEIGHT + 0.5);
      ctx.stroke();

      let gx = labelWidth;
      columns.forEach((col) => {
        gx += col.widthPx;
        ctx.beginPath();
        ctx.moveTo(gx + 0.5, y);
        ctx.lineTo(gx + 0.5, y + ROW_HEIGHT);
        ctx.stroke();
      });

      if (HEALTH_OPTIONS.includes(task.health)) {
        const tagH = 16;
        roundRectPath(ctx, 8, y + (ROW_HEIGHT - tagH) / 2, 6, tagH, 3);
        ctx.fillStyle = HEALTH_COLORS[task.health];
        ctx.fill();
      }

      ctx.fillStyle = colors.text;
      ctx.font = "13px -apple-system, 'Segoe UI', Roboto, sans-serif";
      ctx.textBaseline = 'middle';
      const name = truncateToWidth(ctx, task.name || '', labelWidth - 28);
      ctx.fillText(name, 20, y + ROW_HEIGHT / 2);

      const barX = labelWidth + barLeftPx(range, task);
      const barY = y + (ROW_HEIGHT - BAR_HEIGHT) / 2;
      const barW = barWidthPx(range, task);
      const barH = BAR_HEIGHT;
      const [c1] = barColors(task);

      ctx.fillStyle = c1;
      roundRectPath(ctx, barX, barY, barW, barH, 6);
      ctx.fill();

      if (labelMode !== 'off') {
        ctx.save();
        roundRectPath(ctx, barX, barY, barW, barH, 6);
        ctx.clip();
        ctx.fillStyle = '#ffffff';
        ctx.font = "600 12px -apple-system, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText(formatBarLabel(task), barX + 10, y + ROW_HEIGHT / 2);
        ctx.restore();
      }
    });

    const today = startOfDay(new Date());
    if (today >= range.start && today < range.end) {
      const todayX = labelWidth + xForDate(range, today);
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(todayX, 0);
      ctx.lineTo(todayX, height);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
    }

    return canvas;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function backupData() {
    const blob = new Blob([serializeJson(tasks)], { type: 'application/json' });
    const stamp = formatISODate(new Date());
    downloadBlob(blob, baseFileName() + '-backup-' + stamp + '.json');
  }

  function csvField(value) {
    const str = String(value == null ? '' : value);
    return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
  }

  function serializeCsv(list) {
    const sorted = [...list].sort((a, b) => a.order - b.order);
    const columns = ['id', 'name', 'startDate', 'durationWeeks', 'order', 'color', 'team', 'phase', 'health'];
    const lines = [columns.join(',')];
    sorted.forEach((t) => {
      lines.push(columns.map((col) => csvField(t[col])).join(','));
    });
    return lines.join('\n') + '\n';
  }

  function exportCsv() {
    const blob = new Blob([serializeCsv(tasks)], { type: 'text/csv' });
    const stamp = formatISODate(new Date());
    downloadBlob(blob, baseFileName() + '-' + stamp + '.csv');
  }

  function exportPng() {
    const canvas = drawGanttToCanvas();
    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, baseFileName() + '.png');
    }, 'image/png');
  }

  function exportPdf() {
    const range = computeTimelineRange();
    const ganttWidth = labelWidth + timelineWidthPx(range);
    const scale = Math.min(1, PRINT_PAGE_WIDTH_PX / ganttWidth);
    document.documentElement.style.setProperty('--print-scale', scale);

    const prevTitle = document.title;
    document.title = baseFileName();

    function restoreTitle() {
      document.title = prevTitle;
      window.removeEventListener('afterprint', restoreTitle);
    }
    window.addEventListener('afterprint', restoreTitle);

    window.print();
  }

  // ---------- Saving ----------
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveStatusEl.textContent = 'Saving...';
    saveStatusEl.className = 'save-status saving';
    saveTimer = setTimeout(saveTasks, 400);
  }

  async function saveTasks() {
    if (!canEdit()) return;
    try {
      if (tasks.length) {
        const rows = tasks.map(taskToRow);
        const { error } = await supabaseClient.from(TABLE).upsert(rows, { onConflict: 'id' });
        if (error) throw error;
      }
      if (deletedTaskIds.size) {
        const ids = [...deletedTaskIds];
        const { error } = await supabaseClient.from(TABLE).delete().in('id', ids);
        if (error) throw error;
        deletedTaskIds.clear();
      }
      saveStatusEl.textContent = 'Saved';
      saveStatusEl.className = 'save-status';
    } catch (err) {
      console.error(err);
      saveStatusEl.textContent = 'Save error';
      saveStatusEl.className = 'save-status error';
    }
  }

  // ---------- Init ----------
  addTaskBtn.addEventListener('click', addTask);
  autosortBtn.addEventListener('click', autoSortTasks);
  exportBtn.addEventListener('click', () => exportDialog.showModal());
  exportCloseBtn.addEventListener('click', () => exportDialog.close());
  exportJsonBtn.addEventListener('click', () => { exportDialog.close(); backupData(); });
  exportCsvBtn.addEventListener('click', () => { exportDialog.close(); exportCsv(); });
  exportPngBtn.addEventListener('click', () => { exportDialog.close(); exportPng(); });
  exportPdfBtn.addEventListener('click', () => { exportDialog.close(); exportPdf(); });
  viewButtons.forEach((btn) => btn.addEventListener('click', () => setViewMode(btn.dataset.view)));
  syncViewButtons();

  zoomInBtn.addEventListener('click', zoomIn);
  zoomOutBtn.addEventListener('click', zoomOut);
  syncZoomButtons();

  applyTheme();
  applyDensity();

  displayBtn.addEventListener('click', openDisplayDialog);
  displayCloseBtn.addEventListener('click', () => displayDialog.close());
  displayGroupButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const { group, value } = btn.dataset;
      if (group === 'label') setLabelMode(value);
      else if (group === 'density') setDensity(value);
      else if (group === 'theme') setTheme(value);
    });
  });

  filterToggleBtn.addEventListener('click', () => setFilterCollapsed(!filterCollapsed));
  filterClearBtn.addEventListener('click', clearFilters);
  applyFilterCollapsed();

  cleanupBtn.addEventListener('click', openCleanupDialog);
  cleanupCancelBtn.addEventListener('click', () => cleanupDialog.close());
  cleanupOkBtn.addEventListener('click', confirmCleanup);

  labelColResizeHandle.addEventListener('mousedown', startLabelColResize);
  applyLabelWidth();

  timelineStartInput.addEventListener('change', () => {
    const parsed = parseISODate(timelineStartInput.value);
    if (parsed) {
      setTimelineStartDate(parsed);
    } else {
      syncTimelineStartInput();
    }
  });
  syncTimelineStartInput();

  window.onAuthReady(loadTasks);
})();
