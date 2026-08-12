(() => {
  const ROADMAP_TABLE = 'roadmap_tasks';
  const SCHEDULE_TABLE = 'gantt_state';

  const DAY_MS = 24 * 60 * 60 * 1000;
  const LABEL_WIDTH_PX = 240;
  const WEEK_WIDTH_BASE = 90;
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 2;
  const ZOOM_STEP = 0.25;
  const DEFAULT_ZOOM = 1;
  const ZOOM_STORAGE_KEY = 'timeline-compare-zoom';
  const THEME_STORAGE_KEY = 'timeline-compare-theme';
  const FILTER_STORAGE_KEY = 'timeline-compare-filter';
  const START_DATE_STORAGE_KEY = 'timeline-compare-start-date';
  const MIN_VISIBLE_WEEKS = 10;
  const PADDING_WEEKS = 2;

  // Resource start/duration in schedule-a-db-v2 are stored as week-offsets from
  // this fixed Monday — must match schedule-a-db-v2/app.js exactly to convert
  // back to real calendar dates.
  const DATA_EPOCH = new Date(2000, 0, 3);

  const fileStatusEl = document.getElementById('file-status');
  const saveStatusEl = document.getElementById('save-status');
  const emptyStateEl = document.getElementById('empty-state');
  const tableScrollEl = document.getElementById('table-scroll');
  const colGroupEl = document.getElementById('col-group');
  const monthRowEl = document.getElementById('month-row');
  const weekRowEl = document.getElementById('week-row');
  const bodyEl = document.getElementById('compare-body');
  const todayLineEl = document.getElementById('today-line');
  const zoomInBtn = document.getElementById('zoom-in-btn');
  const zoomOutBtn = document.getElementById('zoom-out-btn');
  const zoomLevelEl = document.getElementById('zoom-level');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const tableEl = document.getElementById('compare-table');
  const filterBtn = document.getElementById('filter-btn');
  const filterDialog = document.getElementById('filter-dialog');
  const filterProjectListEl = document.getElementById('filter-project-list');
  const filterSelectAllBtn = document.getElementById('filter-select-all-btn');
  const filterSelectNoneBtn = document.getElementById('filter-select-none-btn');
  const filterCancelBtn = document.getElementById('filter-cancel-btn');
  const filterApplyBtn = document.getElementById('filter-apply-btn');
  const startDateInput = document.getElementById('start-date-input');

  const supabaseClient = window.sbClient;

  function canEditProject(project) {
    const access = window.currentAccess || {};
    if (project.roadmap && access['roadmap-db'] !== 'editor') return false;
    if (project.schedule && access['schedule-a-db-v2'] !== 'editor') return false;
    return true;
  }

  // The roadmap line can be dragged/resized independently of schedule access —
  // it only ever writes to roadmap_tasks, so only roadmap-db editor is required.
  function canEditRoadmap(project) {
    if (!project.roadmap) return false;
    const access = window.currentAccess || {};
    return access['roadmap-db'] === 'editor';
  }

  let roadmapRows = [];
  let scheduleData = null;
  let projects = [];
  let projectsByName = new Map();

  // null = no filter active (every project shown); otherwise the set of project
  // names to display, checked against the current project list on every load.
  let filterVisibleNames = null;
  try {
    const storedFilter = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || 'null');
    if (Array.isArray(storedFilter)) filterVisibleNames = new Set(storedFilter);
  } catch (err) {
    // localStorage unavailable or corrupt — fall back to no filter.
  }

  let zoom = DEFAULT_ZOOM;
  try {
    const stored = parseFloat(localStorage.getItem(ZOOM_STORAGE_KEY));
    if (!Number.isNaN(stored) && stored >= MIN_ZOOM && stored <= MAX_ZOOM) zoom = stored;
  } catch (err) {
    // localStorage unavailable — fall back to the default zoom.
  }

  // Left edge of the visible timeline — always snapped back to the Monday of
  // its week. Defaults to this week's Monday; overridable via the date picker.
  let timelineStart = mondayOf(new Date());
  try {
    const stored = parseISODate(localStorage.getItem(START_DATE_STORAGE_KEY));
    if (stored) timelineStart = mondayOf(stored);
  } catch (err) {
    // localStorage unavailable — fall back to today's Monday.
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

  function addWeeks(date, n) {
    return addDays(date, n * 7);
  }

  function daysBetween(a, b) {
    return Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);
  }

  function parseISODate(str) {
    const parts = String(str || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatShort(date) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function formatISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  // ---------- Timeline geometry ----------
  function weekWidthPx() {
    return WEEK_WIDTH_BASE * zoom;
  }

  function pxPerDay() {
    return weekWidthPx() / 7;
  }

  function xForDate(range, date) {
    return daysBetween(range.start, date) * pxPerDay();
  }

  // ---------- Supabase load ----------
  function setFileStatus(text, cls) {
    fileStatusEl.textContent = text;
    fileStatusEl.className = 'file-status' + (cls ? ' ' + cls : '');
  }

  function setSaveStatus(text, cls) {
    saveStatusEl.textContent = text;
    saveStatusEl.className = 'save-status' + (cls ? ' ' + cls : '');
  }

  function showTable(show) {
    emptyStateEl.hidden = show;
    tableScrollEl.hidden = !show;
  }

  function defaultScheduleData() {
    return {
      version: 3,
      unit: 'week',
      timelineStart: null,
      resources: [],
      nextId: 1,
      rolesCatalog: [],
      resourceRoles: {},
    };
  }

  async function loadAll() {
    setFileStatus('Connecting...', '');
    try {
      const [rmRes, schRes] = await Promise.all([
        supabaseClient.from(ROADMAP_TABLE).select('*'),
        supabaseClient.from(SCHEDULE_TABLE).select('data').eq('id', 1).single(),
      ]);
      if (rmRes.error) throw rmRes.error;
      // PGRST116 = no row yet (fresh schedule table) — treat as empty.
      if (schRes.error && schRes.error.code !== 'PGRST116') throw schRes.error;

      roadmapRows = rmRes.data || [];
      scheduleData = (schRes.data && schRes.data.data) ? schRes.data.data : defaultScheduleData();
      if (!Array.isArray(scheduleData.resources)) scheduleData.resources = [];

      buildProjects();
      reconcileFilter();
      setFileStatus('Connected to Supabase', 'connected');
      showTable(true);
      render();
    } catch (err) {
      console.error(err);
      setFileStatus('Connection error', 'error');
      emptyStateEl.querySelector('p').textContent =
        'Could not load the comparison: ' + (err && err.message ? err.message : String(err));
      showTable(false);
    }
  }

  // ---------- Project matching (union by name, matched between the two sources) ----------
  function buildProjects() {
    const roadmapByName = new Map();
    roadmapRows.forEach((r) => {
      const name = String(r.name || '').trim();
      if (!name) return;
      const start = parseISODate(r.start_date);
      if (!start) return;
      const durationWeeks = Math.max(1, parseInt(r.duration_weeks, 10) || 1);
      roadmapByName.set(name, { id: r.id, start, end: addDays(start, durationWeeks * 7), durationWeeks });
    });

    const scheduleGroups = new Map();
    scheduleData.resources.forEach((r) => {
      const name = String(r.project || 'Untitled Project').trim() || 'Untitled Project';
      const start = Number(r.start) || 0;
      const duration = Math.max(1, Number(r.duration) || 1);
      const end = start + duration;
      if (!scheduleGroups.has(name)) scheduleGroups.set(name, { minStart: start, maxEnd: end, count: 0 });
      const g = scheduleGroups.get(name);
      g.minStart = Math.min(g.minStart, start);
      g.maxEnd = Math.max(g.maxEnd, end);
      g.count += 1;
    });

    const names = new Set([...roadmapByName.keys(), ...scheduleGroups.keys()]);
    projects = [...names]
      .map((name) => {
        const rm = roadmapByName.get(name);
        const sg = scheduleGroups.get(name);
        return {
          name,
          roadmap: rm ? { id: rm.id, start: rm.start, end: rm.end, durationWeeks: rm.durationWeeks } : null,
          schedule: sg
            ? { start: addWeeks(DATA_EPOCH, sg.minStart), end: addWeeks(DATA_EPOCH, sg.maxEnd), count: sg.count }
            : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    projectsByName = new Map(projects.map((p) => [p.name, p]));
  }

  // ---------- Filter (which projects are shown) ----------
  // Drops names from a stored filter that no longer exist (e.g. after a rename
  // or merge), and collapses to "no filter" if that leaves nothing hidden.
  function reconcileFilter() {
    if (!filterVisibleNames) return;
    const allNames = new Set(projects.map((p) => p.name));
    const kept = new Set([...filterVisibleNames].filter((n) => allNames.has(n)));
    filterVisibleNames = kept.size > 0 && kept.size < allNames.size ? kept : null;
    persistFilter();
  }

  function persistFilter() {
    try {
      if (filterVisibleNames) {
        localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify([...filterVisibleNames]));
      } else {
        localStorage.removeItem(FILTER_STORAGE_KEY);
      }
    } catch (err) {
      // ignore — persistence is a convenience, not a requirement
    }
  }

  function visibleProjects() {
    if (!filterVisibleNames) return projects;
    return projects.filter((p) => filterVisibleNames.has(p.name));
  }

  function syncFilterButton() {
    const isActive = !!filterVisibleNames;
    filterBtn.classList.toggle('active', isActive);
    filterBtn.textContent = isActive ? 'Filter (' + visibleProjects().length + '/' + projects.length + ')' : 'Filter';
  }

  function openFilterDialog() {
    const currentlyVisible = filterVisibleNames || new Set(projects.map((p) => p.name));
    filterProjectListEl.innerHTML = '';
    if (!projects.length) {
      const empty = document.createElement('p');
      empty.className = 'filter-empty';
      empty.textContent = 'No projects to filter yet.';
      filterProjectListEl.appendChild(empty);
    }
    projects.forEach((p) => {
      const row = document.createElement('label');
      row.className = 'filter-check-row';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = currentlyVisible.has(p.name);
      checkbox.dataset.name = p.name;
      const span = document.createElement('span');
      span.textContent = p.name;
      row.appendChild(checkbox);
      row.appendChild(span);
      filterProjectListEl.appendChild(row);
    });
    filterDialog.showModal();
  }

  function setAllFilterCheckboxes(checked) {
    filterProjectListEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = checked;
    });
  }

  filterBtn.addEventListener('click', openFilterDialog);
  filterSelectAllBtn.addEventListener('click', () => setAllFilterCheckboxes(true));
  filterSelectNoneBtn.addEventListener('click', () => setAllFilterCheckboxes(false));
  filterCancelBtn.addEventListener('click', () => filterDialog.close());

  filterApplyBtn.addEventListener('click', () => {
    const checkboxes = Array.from(filterProjectListEl.querySelectorAll('input[type="checkbox"]'));
    const checkedNames = checkboxes.filter((cb) => cb.checked).map((cb) => cb.dataset.name);
    filterVisibleNames = checkedNames.length === checkboxes.length ? null : new Set(checkedNames);
    persistFilter();
    filterDialog.close();
    render();
  });

  // ---------- Timeline range / columns ----------
  function computeRange() {
    let maxEnd = null;
    projects.forEach((p) => {
      if (p.roadmap && (!maxEnd || p.roadmap.end > maxEnd)) maxEnd = p.roadmap.end;
      if (p.schedule && (!maxEnd || p.schedule.end > maxEnd)) maxEnd = p.schedule.end;
    });

    // timelineStart is a hard override for the left edge — activity before it
    // is clipped rather than auto-expanding the range to include it.
    const rangeStart = timelineStart;
    let rangeEnd = maxEnd ? mondayOf(addDays(maxEnd, 7)) : addDays(rangeStart, MIN_VISIBLE_WEEKS * 7);

    rangeEnd = addDays(rangeEnd, PADDING_WEEKS * 7);

    const minEnd = addDays(rangeStart, MIN_VISIBLE_WEEKS * 7);
    if (rangeEnd < minEnd) rangeEnd = minEnd;

    return { start: rangeStart, end: rangeEnd };
  }

  function buildWeeks(range) {
    const weeks = [];
    let cur = range.start;
    while (cur < range.end) {
      const next = addDays(cur, 7);
      weeks.push({ start: cur, end: next });
      cur = next;
    }
    return weeks;
  }

  function buildMonthSegments(weeks) {
    const segs = [];
    let cur = null;
    weeks.forEach((w) => {
      const key = w.start.getFullYear() + '-' + w.start.getMonth();
      if (!cur || cur.key !== key) {
        cur = { key, label: w.start.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }), count: 0 };
        segs.push(cur);
      }
      cur.count += 1;
    });
    return segs;
  }

  function gridlineBackground() {
    return 'linear-gradient(to right, var(--border) 0 1px, transparent 1px 100%)';
  }

  // ---------- Rendering ----------
  let lastRange = null;

  function render() {
    const range = computeRange();
    lastRange = range;
    const weeks = buildWeeks(range);
    const totalWidthPx = weeks.length * weekWidthPx();

    colGroupEl.innerHTML = '';
    const labelCol = document.createElement('col');
    labelCol.style.width = LABEL_WIDTH_PX + 'px';
    colGroupEl.appendChild(labelCol);
    weeks.forEach(() => {
      const c = document.createElement('col');
      c.style.width = weekWidthPx() + 'px';
      colGroupEl.appendChild(c);
    });

    monthRowEl.innerHTML = '';
    const labelTh = document.createElement('th');
    labelTh.className = 'label-col-header';
    labelTh.rowSpan = 2;
    labelTh.textContent = 'Project';
    monthRowEl.appendChild(labelTh);
    buildMonthSegments(weeks).forEach((seg) => {
      const th = document.createElement('th');
      th.colSpan = seg.count;
      th.textContent = seg.label;
      monthRowEl.appendChild(th);
    });

    weekRowEl.innerHTML = '';
    const today = startOfDay(new Date());
    weeks.forEach((w) => {
      const th = document.createElement('th');
      const isToday = today >= w.start && today < w.end;
      if (isToday) th.classList.add('today-col');
      th.textContent = formatShort(w.start);
      th.title = formatShort(w.start) + ' – ' + formatShort(addDays(w.end, -1));
      weekRowEl.appendChild(th);
    });

    if (today >= range.start && today < range.end) {
      todayLineEl.hidden = false;
      todayLineEl.style.left = (LABEL_WIDTH_PX + xForDate(range, today)) + 'px';
    } else {
      todayLineEl.hidden = true;
    }

    bodyEl.innerHTML = '';

    const shown = visibleProjects();

    if (!projects.length || !shown.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.className = 'track-cell';
      td.colSpan = weeks.length + 1;
      td.style.textAlign = 'center';
      td.style.color = 'var(--muted-text)';
      td.style.padding = '20px';
      td.textContent = projects.length
        ? 'No projects match the current filter.'
        : 'No projects found in Roadmap-DB or Schedule-A-DB v2.';
      tr.appendChild(td);
      bodyEl.appendChild(tr);
    }

    shown.forEach((project, projectIndex) => {
      const altRowClass = projectIndex % 2 === 1 ? ' row-alt' : '';

      const roadmapTr = document.createElement('tr');
      roadmapTr.className = 'track-row roadmap-row' + altRowClass;

      const labelTd = document.createElement('td');
      labelTd.className = 'label-cell';
      labelTd.rowSpan = 2;

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'project-name-input';
      nameInput.value = project.name;
      nameInput.dataset.originalName = project.name;
      nameInput.title = 'Rename this project (updates both Roadmap-DB and Schedule-A-DB v2)';
      nameInput.readOnly = !canEditProject(project);
      labelTd.appendChild(nameInput);

      const meta = document.createElement('div');
      meta.className = 'project-meta';
      if (!project.roadmap) {
        meta.innerHTML = '<span class="badge">Not in Roadmap-DB</span>';
      } else if (!project.schedule) {
        meta.innerHTML = '<span class="badge">Not in Schedule-DB</span>';
      } else {
        meta.textContent = project.schedule.count + ' resource assignment' + (project.schedule.count === 1 ? '' : 's');
      }
      labelTd.appendChild(meta);

      roadmapTr.appendChild(labelTd);

      const rmTrackTd = document.createElement('td');
      rmTrackTd.className = 'track-cell';
      rmTrackTd.colSpan = weeks.length;
      rmTrackTd.style.backgroundImage = gridlineBackground();
      rmTrackTd.style.backgroundSize = weekWidthPx() + 'px 100%';

      if (project.roadmap) {
        const editable = canEditRoadmap(project);
        const wrap = document.createElement('div');
        wrap.className = 'rm-line-wrap' + (editable ? ' editable' : '');
        wrap.dataset.name = project.name;
        const left = Math.max(0, xForDate(range, project.roadmap.start));
        const width = Math.max(4, xForDate(range, project.roadmap.end) - left);
        wrap.style.left = left + 'px';
        wrap.style.width = width + 'px';
        wrap.title = project.name + ' — Roadmap-DB: ' + formatShort(project.roadmap.start) + ' – ' + formatShort(addDays(project.roadmap.end, -1)) +
          (editable ? ' (drag to reschedule, drag ends to resize)' : '');

        const line = document.createElement('div');
        line.className = 'rm-line';
        wrap.appendChild(line);

        if (editable) {
          const startHandle = document.createElement('div');
          startHandle.className = 'rm-handle rm-handle-start';
          wrap.appendChild(startHandle);
          const endHandle = document.createElement('div');
          endHandle.className = 'rm-handle rm-handle-end';
          wrap.appendChild(endHandle);
        }

        rmTrackTd.appendChild(wrap);
      } else {
        const note = document.createElement('span');
        note.className = 'missing-note';
        note.textContent = 'No roadmap entry';
        rmTrackTd.appendChild(note);
      }
      roadmapTr.appendChild(rmTrackTd);
      bodyEl.appendChild(roadmapTr);

      const schedTr = document.createElement('tr');
      schedTr.className = 'track-row schedule-row' + altRowClass;

      const schedTrackTd = document.createElement('td');
      schedTrackTd.className = 'track-cell';
      schedTrackTd.colSpan = weeks.length;
      schedTrackTd.style.backgroundImage = gridlineBackground();
      schedTrackTd.style.backgroundSize = weekWidthPx() + 'px 100%';

      if (project.schedule) {
        const bar = document.createElement('div');
        bar.className = 'sched-bar';
        const left = Math.max(0, xForDate(range, project.schedule.start));
        const width = Math.max(4, xForDate(range, project.schedule.end) - left);
        bar.style.left = left + 'px';
        bar.style.width = width + 'px';
        bar.title = project.name + ' — Schedule-A-DB v2: ' + formatShort(project.schedule.start) + ' – ' + formatShort(addDays(project.schedule.end, -1));
        schedTrackTd.appendChild(bar);
      } else {
        const note = document.createElement('span');
        note.className = 'missing-note';
        note.textContent = 'No schedule entries';
        schedTrackTd.appendChild(note);
      }
      schedTr.appendChild(schedTrackTd);
      bodyEl.appendChild(schedTr);
    });

    tableEl.style.width = (LABEL_WIDTH_PX + totalWidthPx) + 'px';
    syncZoomControls();
    syncFilterButton();
    syncStartDateControl();
  }

  // ---------- Zoom ----------
  function syncZoomControls() {
    zoomLevelEl.textContent = Math.round(zoom * 100) + '%';
    zoomOutBtn.disabled = zoom <= MIN_ZOOM;
    zoomInBtn.disabled = zoom >= MAX_ZOOM;
  }

  function setZoom(level) {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, level));
    if (clamped === zoom) return;
    zoom = clamped;
    try {
      localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom));
    } catch (err) {
      // ignore — persistence is a convenience, not a requirement
    }
    render();
  }

  zoomInBtn.addEventListener('click', () => setZoom(zoom + ZOOM_STEP));
  zoomOutBtn.addEventListener('click', () => setZoom(zoom - ZOOM_STEP));

  // ---------- Timeline start date ----------
  function syncStartDateControl() {
    startDateInput.value = formatISODate(timelineStart);
  }

  function setTimelineStart(date) {
    timelineStart = mondayOf(date);
    try {
      localStorage.setItem(START_DATE_STORAGE_KEY, formatISODate(timelineStart));
    } catch (err) {
      // ignore — persistence is a convenience, not a requirement
    }
    render();
  }

  startDateInput.addEventListener('change', () => {
    const parsed = parseISODate(startDateInput.value);
    if (!parsed) {
      syncStartDateControl();
      return;
    }
    setTimelineStart(parsed);
  });

  // ---------- Theme ----------
  function currentEffectiveTheme() {
    if (document.documentElement.dataset.theme) return document.documentElement.dataset.theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark') document.documentElement.dataset.theme = storedTheme;
  } catch (err) {
    // localStorage unavailable — fall back to the OS theme.
  }

  themeToggleBtn.addEventListener('click', () => {
    const next = currentEffectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (err) {
      // ignore — persistence is a convenience, not a requirement
    }
  });

  // ---------- Rename (the only edit this app allows) ----------
  async function renameProject(oldName, newName) {
    setSaveStatus('Saving...', 'saving');
    try {
      const project = projectsByName.get(oldName);
      if (!project) throw new Error('Project not found');
      if (!canEditProject(project)) throw new Error("You don't have edit access to this project.");

      const ops = [];
      if (project.roadmap) {
        ops.push(supabaseClient.from(ROADMAP_TABLE).update({ name: newName }).eq('id', project.roadmap.id));
      }
      if (project.schedule) {
        scheduleData.resources.forEach((r) => {
          const key = String(r.project || 'Untitled Project').trim() || 'Untitled Project';
          if (key === oldName) r.project = newName;
        });
        ops.push(
          supabaseClient.from(SCHEDULE_TABLE).upsert({ id: 1, data: scheduleData, updated_at: new Date().toISOString() })
        );
      }

      const results = await Promise.all(ops);
      const failed = results.find((r) => r && r.error);
      if (failed) throw failed.error;

      setSaveStatus('Saved', '');
      await loadAll();
    } catch (err) {
      console.error(err);
      setSaveStatus('Save error', 'error');
    }
  }

  bodyEl.addEventListener('change', (e) => {
    const el = e.target;
    if (!el.classList || !el.classList.contains('project-name-input')) return;
    const oldName = el.dataset.originalName;
    const newName = el.value.trim();
    if (!newName) {
      el.value = oldName;
      return;
    }
    if (newName === oldName) return;
    if (projectsByName.has(newName)) {
      const merge = window.confirm(
        'A project named "' + newName + '" already exists. Renaming will merge "' + oldName + '" into it. Continue?'
      );
      if (!merge) {
        el.value = oldName;
        return;
      }
    }
    renameProject(oldName, newName);
  });

  // ---------- Roadmap line drag (move / resize) ----------
  // The schedule bar is intentionally never wired up to any of this — it has
  // no drag handles and no listeners, so it can't be moved or resized.
  let dragState = null;

  async function updateRoadmapSchedule(name, newStart, newDurationWeeks) {
    setSaveStatus('Saving...', 'saving');
    try {
      const project = projectsByName.get(name);
      if (!project || !project.roadmap) throw new Error('Project not found');
      if (!canEditRoadmap(project)) throw new Error("You don't have edit access to the roadmap.");

      const { error } = await supabaseClient
        .from(ROADMAP_TABLE)
        .update({ start_date: formatISODate(newStart), duration_weeks: newDurationWeeks })
        .eq('id', project.roadmap.id);
      if (error) throw error;

      setSaveStatus('Saved', '');
      await loadAll();
    } catch (err) {
      console.error(err);
      setSaveStatus('Save error', 'error');
      render();
    }
  }

  function onRoadmapDragMove(e) {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const deltaWeeks = Math.round(dx / dragState.weekWidthPx);

    if (dragState.mode === 'move') {
      dragState.appliedDeltaWeeks = deltaWeeks;
      dragState.wrap.style.left = (dragState.originalLeftPx + deltaWeeks * dragState.weekWidthPx) + 'px';
    } else if (dragState.mode === 'resize-start') {
      const maxDeltaWeeks = dragState.originalDurationWeeks - 1;
      const clamped = Math.min(maxDeltaWeeks, deltaWeeks);
      dragState.appliedDeltaWeeks = clamped;
      dragState.wrap.style.left = (dragState.originalLeftPx + clamped * dragState.weekWidthPx) + 'px';
      dragState.wrap.style.width = (dragState.originalWidthPx - clamped * dragState.weekWidthPx) + 'px';
    } else if (dragState.mode === 'resize-end') {
      const minDeltaWeeks = -(dragState.originalDurationWeeks - 1);
      const clamped = Math.max(minDeltaWeeks, deltaWeeks);
      dragState.appliedDeltaWeeks = clamped;
      dragState.wrap.style.width = (dragState.originalWidthPx + clamped * dragState.weekWidthPx) + 'px';
    }
  }

  function onRoadmapDragEnd() {
    if (!dragState) return;
    const { mode, wrap, name, originalStart, originalDurationWeeks, appliedDeltaWeeks } = dragState;
    wrap.classList.remove('dragging');
    document.body.classList.remove('rm-dragging-active');
    document.removeEventListener('mousemove', onRoadmapDragMove);
    document.removeEventListener('mouseup', onRoadmapDragEnd);
    dragState = null;

    const delta = appliedDeltaWeeks || 0;
    if (delta === 0) return;

    let newStart = originalStart;
    let newDurationWeeks = originalDurationWeeks;

    if (mode === 'move') {
      newStart = addWeeks(originalStart, delta);
    } else if (mode === 'resize-start') {
      newStart = addWeeks(originalStart, delta);
      newDurationWeeks = originalDurationWeeks - delta;
    } else if (mode === 'resize-end') {
      newDurationWeeks = originalDurationWeeks + delta;
    }

    updateRoadmapSchedule(name, newStart, newDurationWeeks);
  }

  bodyEl.addEventListener('mousedown', (e) => {
    const wrap = e.target.closest('.rm-line-wrap.editable');
    if (!wrap) return;
    e.preventDefault();

    const name = wrap.dataset.name;
    const project = projectsByName.get(name);
    if (!project || !project.roadmap || !lastRange) return;

    const mode = e.target.closest('.rm-handle-start') ? 'resize-start'
      : e.target.closest('.rm-handle-end') ? 'resize-end'
      : 'move';

    dragState = {
      mode,
      wrap,
      name,
      startX: e.clientX,
      originalStart: project.roadmap.start,
      originalDurationWeeks: project.roadmap.durationWeeks,
      originalLeftPx: parseFloat(wrap.style.left) || 0,
      originalWidthPx: parseFloat(wrap.style.width) || 0,
      weekWidthPx: weekWidthPx(),
      appliedDeltaWeeks: 0,
    };
    wrap.classList.add('dragging');
    document.body.classList.add('rm-dragging-active');
    document.addEventListener('mousemove', onRoadmapDragMove);
    document.addEventListener('mouseup', onRoadmapDragEnd);
  });

  // ---------- Init ----------
  window.onAuthReady(loadAll);
})();
