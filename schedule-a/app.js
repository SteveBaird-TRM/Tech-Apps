(function () {
  var TOTAL_WEEKS = 26;
  var BASE_WEEK_WIDTH = 100;
  var MIN_ZOOM = 0.5;
  var MAX_ZOOM = 2;
  var zoom = 1;
  try {
    var storedZoom = Number(localStorage.getItem('gantt-zoom'));
    if (isFinite(storedZoom) && storedZoom >= MIN_ZOOM && storedZoom <= MAX_ZOOM) {
      zoom = storedZoom;
    }
  } catch (err) {}
  var WEEK_WIDTH = BASE_WEEK_WIDTH * zoom;
  // Fixed, never-changing internal reference point. Resource start/duration are always stored
  // as week-offsets from this Monday, so a resource's real calendar dates never move when the
  // visible timeline window (timelineStartDate) is panned — only what's on screen changes.
  var DATA_EPOCH = new Date(2000, 0, 3);
  var supabaseClient = window.sbClient;
  function canEdit() { return window.currentAccess && window.currentAccess['schedule-a-db-v2'] === 'editor'; }
  var MIN_LABEL_WIDTH = 160;
  var MAX_LABEL_WIDTH = 480;
  var LABEL_WIDTH = 220;
  try {
    var storedLabelWidth = Number(localStorage.getItem('gantt-label-width'));
    if (isFinite(storedLabelWidth) && storedLabelWidth >= MIN_LABEL_WIDTH && storedLabelWidth <= MAX_LABEL_WIDTH) {
      LABEL_WIDTH = storedLabelWidth;
    }
  } catch (err) {}
  var DEFAULT_DURATION = 1; // weeks

  var appEl = document.getElementById('app');
  var grid = document.getElementById('ganttGrid');
  var colResizeHandle = document.getElementById('colResizeHandle');
  var ganttScroll = document.querySelector('.gantt-scroll');
  var dragTip = document.getElementById('dragTip');
  var addForm = document.getElementById('addForm');
  var projectInput = document.getElementById('projectInput');
  var nameInput = document.getElementById('nameInput');
  var allocInput = document.getElementById('allocInput');
  var addModalOverlay = document.getElementById('addModalOverlay');
  var addModalClose = document.getElementById('addModalClose');
  var addModalCancel = document.getElementById('addModalCancel');
  var openFileBtn = document.getElementById('openFileBtn');
  var cleanupBtn = document.getElementById('cleanupBtn');
  var cleanupModalOverlay = document.getElementById('cleanupModalOverlay');
  var cleanupModalClose = document.getElementById('cleanupModalClose');
  var cleanupCancelBtn = document.getElementById('cleanupCancelBtn');
  var cleanupOkBtn = document.getElementById('cleanupOkBtn');
  var cleanupList = document.getElementById('cleanupList');
  var importFileInput = document.getElementById('importFileInput');
  var exportBtn = document.getElementById('exportBtn');
  var exportPngBtn = document.getElementById('exportPngBtn');
  var exportPdfBtn = document.getElementById('exportPdfBtn');
  var viewToggle = document.getElementById('viewToggle');
  var viewToggleBtns = viewToggle.querySelectorAll('.view-toggle-btn');
  var timelineStartInput = document.getElementById('timelineStartInput');
  var densityToggleBtn = document.getElementById('densityToggleBtn');
  var zoomOutBtn = document.getElementById('zoomOutBtn');
  var zoomInBtn = document.getElementById('zoomInBtn');
  var zoomLevelLabel = document.getElementById('zoomLevelLabel');
  var sortAzBtn = document.getElementById('sortAzBtn');
  var sortDateBtn = document.getElementById('sortDateBtn');
  var manageRolesBtn = document.getElementById('manageRolesBtn');
  var rolesModalOverlay = document.getElementById('rolesModalOverlay');
  var rolesModalClose = document.getElementById('rolesModalClose');
  var newRoleInput = document.getElementById('newRoleInput');
  var addRoleBtn = document.getElementById('addRoleBtn');
  var rolesResourceList = document.getElementById('rolesResourceList');
  var saveStatus = document.getElementById('saveStatus');
  var sidePanel = document.getElementById('sidePanel');
  var panelDate = document.getElementById('panelDate');
  var panelViewToggle = document.getElementById('panelViewToggle');
  var panelViewToggleBtns = panelViewToggle.querySelectorAll('.view-toggle-btn');
  var panelFilterLabel = document.getElementById('panelFilterLabel');
  var panelSummary = document.getElementById('panelSummary');
  var panelList = document.getElementById('panelList');
  var panelClose = document.getElementById('panelClose');
  var panelFilterChips = document.getElementById('panelFilterChips');
  var panelRolesFilterRow = document.getElementById('panelRolesFilterRow');
  var panelRolesFilterChips = document.getElementById('panelRolesFilterChips');
  var panelFilterCollapseToggle = document.getElementById('panelFilterCollapseToggle');
  var panelRolesFilterCollapseToggle = document.getElementById('panelRolesFilterCollapseToggle');
  var filtersBlock = document.getElementById('filtersBlock');
  var filtersBlockBody = document.getElementById('filtersBlockBody');
  var filtersCollapseToggle = document.getElementById('filtersCollapseToggle');
  var resourceFilterBar = document.getElementById('resourceFilterBar');
  var resourceFilterChips = document.getElementById('resourceFilterChips');
  var projectFilterBar = document.getElementById('projectFilterBar');
  var projectFilterChips = document.getElementById('projectFilterChips');
  var rolesFilterBar = document.getElementById('rolesFilterBar');
  var rolesFilterChips = document.getElementById('rolesFilterChips');
  var editableArea = document.getElementById('editableArea');
  var lockOverlay = document.getElementById('lockOverlay');
  var lockOverlayText = document.getElementById('lockOverlayText');
  var lockOverlayActions = document.getElementById('lockOverlayActions');
  var gateRetryBtn = document.getElementById('gateRetryBtn');

  var resources = [];
  var nextId = 1;
  // Canonical projects registry (public.projects), used to power the "pick
  // a project" typeahead in the Add-resource modal. Typing an existing name
  // links to it; typing something new creates it (see the addForm submit
  // handler), same as intake/roadmap. Kept as the full set (delivered
  // included) so exact-match lookup never misses a delivered project and
  // creates an accidental duplicate — populateProjectDatalist() is what
  // hides delivered projects from the visible suggestion list.
  var projectsCatalog = [];
  function refreshProjectsCatalog() {
    return supabaseClient.from('projects').select('id, canonical_name, delivered').order('canonical_name').then(function (res) {
      if (res.error) { console.error(res.error); return; }
      projectsCatalog = res.data || [];
      populateProjectDatalist();
    });
  }
  function populateProjectDatalist() {
    var projectListEl = document.getElementById('projectList');
    if (!projectListEl) return;
    projectListEl.innerHTML = projectsCatalog
      .filter(function (p) { return !p.delivered; })
      .map(function (p) {
        return '<option value="' + escapeAttr(p.canonical_name) + '"></option>';
      }).join('');
  }
  function findCatalogProjectByName(name) {
    var needle = name.trim().toLowerCase();
    for (var i = 0; i < projectsCatalog.length; i++) {
      if (projectsCatalog[i].canonical_name.toLowerCase() === needle) return projectsCatalog[i];
    }
    return null;
  }
  var timelineStartDate = mondayOnOrBefore(new Date()); // fixed calendar anchor for week 0; persisted with the file
  var selectedWeeks = []; // array of selected week indices, shown together in the side panel
  var panelViewMode = 'resource'; // 'resource' = list resources filtered by project; 'project' = list projects filtered by resource
  var panelFilter = null; // null = all projects; otherwise an array of selected project names
  var panelResourceFilter = null; // null = all resources; otherwise an array of selected resource names (panel's "Filter resources", project-view only)
  var panelRolesFilter = null; // null = all roles; otherwise an array of selected role tags (side panel filter, applies in both panel view modes)
  var collapsedGroups = { project: {}, resource: {} }; // per-view: group name -> true when its rows are hidden
  var resourceFilter = null; // null = all resources; otherwise an array of selected resource names (chart-wide)
  var projectFilter = null; // null = all projects; otherwise an array of selected project names (chart-wide)
  var rolesFilter = null; // null = all roles; otherwise an array of selected role tags (chart-wide)
  var rolesCatalog = []; // ordered list of role tags available to assign, managed via the Roles popup
  var resourceRoles = {}; // resource name -> assigned role tag, shared across every assignment for that person
  var viewMode = 'project'; // 'project' groups the chart by project, 'resource' groups it by resource
  try {
    if (localStorage.getItem('gantt-view-mode') === 'resource') viewMode = 'resource';
  } catch (err) {}
  var density = 'normal'; // 'normal' or 'narrow' row height
  try {
    if (localStorage.getItem('gantt-density') === 'narrow') density = 'narrow';
  } catch (err) {}
  var filtersCollapsed = false; // main-screen "Filter" chip block, collapsed to reclaim vertical space
  try {
    if (localStorage.getItem('gantt-filters-collapsed') === '1') filtersCollapsed = true;
  } catch (err) {}
  var panelFiltersCollapsed = false; // side-panel project/resource filter chip block
  try {
    if (localStorage.getItem('gantt-panel-filters-collapsed') === '1') panelFiltersCollapsed = true;
  } catch (err) {}
  var panelRolesFiltersCollapsed = false; // side-panel roles filter chip block, collapses independently of the block above
  try {
    if (localStorage.getItem('gantt-panel-roles-filters-collapsed') === '1') panelRolesFiltersCollapsed = true;
  } catch (err) {}

  // Grid is week-granular: every column is a Monday-Sunday week, and resource
  // start/duration are stored directly in whole weeks (no day-level snapping needed).
  function mondayOnOrBefore(date) {
    var d = new Date(date);
    d.setHours(0, 0, 0, 0);
    var wd = d.getDay();
    var backToMonday = (wd === 0) ? 6 : (wd - 1);
    d.setDate(d.getDate() - backToMonday);
    return d;
  }
  function isoDateString(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function parseIsoDate(s) {
    var parts = String(s || '').split('-');
    if (parts.length !== 3) return null;
    var y = Number(parts[0]), m = Number(parts[1]), d = Number(parts[2]);
    if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return null;
    var date = new Date(y, m - 1, d);
    date.setHours(0, 0, 0, 0);
    return date;
  }
  // baseDate is a fixed calendar anchor (the Monday behind column 0), set via timelineStartDate
  // rather than derived from "today" — so the grid stays put once the file is saved/reopened.
  function baseDate() {
    return new Date(timelineStartDate);
  }
  function dateForWeek(w) {
    var d = new Date(baseDate());
    d.setDate(d.getDate() + w * 7);
    return d;
  }
  function weekEndDate(w) {
    var d = dateForWeek(w);
    d.setDate(d.getDate() + 6);
    return d;
  }
  function todayWeekIndex() {
    var t = mondayOnOrBefore(new Date());
    return Math.round((t - baseDate()) / (7 * 86400000));
  }
  function todayFractionWithinWeek() {
    var wd = new Date().getDay();
    return ((wd === 0) ? 6 : (wd - 1)) / 7;
  }
  function fmtShort(d) { return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }); }
  function fmtLong(d) { return d.toLocaleDateString('en-GB', { month: 'long', day: 'numeric', year: 'numeric' }); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Resource start/duration are stored relative to DATA_EPOCH ("anchor" week numbers). The grid's
  // visible columns are relative to timelineStartDate ("view" week numbers). viewOffsetWeeks is the
  // number of anchor-weeks between them, so anchorWeek = viewWeek + offset, viewWeek = anchorWeek - offset.
  function viewOffsetWeeks() {
    return Math.round((timelineStartDate - DATA_EPOCH) / (7 * 86400000));
  }
  function dateForAnchorWeek(w) {
    var d = new Date(DATA_EPOCH);
    d.setDate(d.getDate() + w * 7);
    return d;
  }
  function weekEndDateForAnchor(w) {
    var d = dateForAnchorWeek(w);
    d.setDate(d.getDate() + 6);
    return d;
  }
  function rangeLabelShortAnchor(startW, endWExclusive) {
    return fmtShort(dateForAnchorWeek(startW)) + ' – ' + fmtShort(weekEndDateForAnchor(endWExclusive - 1));
  }
  // Converts an anchor-relative [start, start+duration) range into visible-column coordinates.
  // Returns null if the range had already finished before the visible window starts (hidden);
  // otherwise the start is pinned to column 0 when it began earlier ("remaining time only") —
  // the right edge is never clipped, matching how bars have always been free to run past the
  // last visible week.
  function clipRangeToView(anchorStart, anchorDuration) {
    var offset = viewOffsetWeeks();
    var viewStart = anchorStart - offset;
    var viewEnd = viewStart + anchorDuration;
    if (viewEnd <= 0) return null;
    return { start: Math.max(viewStart, 0), end: viewEnd, truncatedLeft: viewStart < 0 };
  }

  function rangeLabelShort(startW, endWExclusive) {
    return fmtShort(dateForWeek(startW)) + ' – ' + fmtShort(weekEndDate(endWExclusive - 1));
  }
  function weekCellLabel(w) {
    return fmtShort(dateForWeek(w));
  }
  function weekLabelLong(w) {
    return 'Week of ' + fmtLong(dateForWeek(w));
  }
  function selectedWeeksLabel() {
    var sorted = selectedWeeks.slice().sort(function (a, b) { return a - b; });
    if (!sorted.length) return '—';
    if (sorted.length === 1) return weekLabelLong(sorted[0]);
    var runs = [];
    var runStart = sorted[0];
    var prev = sorted[0];
    for (var i = 1; i < sorted.length; i++) {
      if (sorted[i] === prev + 1) { prev = sorted[i]; continue; }
      runs.push([runStart, prev]);
      runStart = sorted[i];
      prev = sorted[i];
    }
    runs.push([runStart, prev]);
    var parts = runs.map(function (run) {
      return run[0] === run[1]
        ? fmtShort(dateForWeek(run[0]))
        : fmtShort(dateForWeek(run[0])) + '–' + fmtShort(weekEndDate(run[1]));
    });
    return sorted.length + ' weeks selected (' + parts.join(', ') + ')';
  }

  // `start` is anchor-relative (weeks from DATA_EPOCH) — callers convert from view coordinates.
  function addResourceInternal(name, allocation, start, duration, project, projectId) {
    resources.push({
      id: nextId++,
      name: name,
      project: project || 'Untitled Project',
      projectId: projectId || null,
      allocation: allocation,
      start: Math.round(start),
      duration: Math.max(1, duration)
    });
  }

  // Merges each resource's [start, start+duration) span into the smallest set of non-overlapping,
  // sorted ranges that actually have coverage — so the group bar only spans time where at least
  // one resource/project is active, and shows a gap (rather than one continuous bar) where none are.
  function projectRangesFor(list) {
    if (!list.length) return [];
    var intervals = list.map(function (r) { return { start: r.start, end: r.start + r.duration }; })
      .sort(function (a, b) { return a.start - b.start; });
    var merged = [{ start: intervals[0].start, end: intervals[0].end }];
    for (var i = 1; i < intervals.length; i++) {
      var last = merged[merged.length - 1];
      if (intervals[i].start <= last.end) {
        last.end = Math.max(last.end, intervals[i].end);
      } else {
        merged.push({ start: intervals[i].start, end: intervals[i].end });
      }
    }
    return merged;
  }

  // Splits [seg.start, seg.end) into runs of consecutive weeks that share the same
  // "low allocation" state, where a week is low when the combined allocation of every
  // resource active that week is under 75%. Used to shade the group summary bar per-week
  // instead of uniformly across its whole span.
  function weeklyAllocRunsFor(seg, list) {
    var runs = [];
    var curStart = seg.start;
    var curLow = null;
    for (var w = seg.start; w < seg.end; w++) {
      var weekTotal = 0;
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (w >= r.start && w < r.start + r.duration) weekTotal += Number(r.allocation) || 0;
      }
      var low = weekTotal < 75;
      if (curLow === null) {
        curLow = low;
      } else if (low !== curLow) {
        runs.push({ start: curStart, end: w, isLow: curLow });
        curStart = w;
        curLow = low;
      }
    }
    if (curLow !== null) runs.push({ start: curStart, end: seg.end, isLow: curLow });
    return runs;
  }

  function keyForProject(r) { return r.project || 'Untitled Project'; }
  function normalizeResourceName(name) { return (name || 'Untitled').trim() || 'Untitled'; }
  function keyForResource(r) { return normalizeResourceName(r.name); }
  function entryGroupKey(r) { return viewMode === 'resource' ? keyForResource(r) : keyForProject(r); }
  // Role is a property of the person (keyed by resource name), not of a single assignment,
  // so it's shared across every entry for that name rather than stored per-row.
  function roleForResource(r) { return resourceRoles[keyForResource(r)] || ''; }

  // The complementary key to entryGroupKey(): within a top-level group (a resource in resource
  // view, a project in project view), this is what rows are further split by — so a row is a
  // single (resource, project) pairing and can hold several bars (one per date range/allocation).
  function subGroupKeyFor(r) { return viewMode === 'resource' ? keyForProject(r) : keyForResource(r); }

  // Groups an already-filtered list of entries (all sharing one top-level group) into rows keyed
  // by subGroupKeyFor, preserving first-occurrence order — multiple entries with the same key
  // become one row with multiple bars.
  function subGroupEntries(list) {
    var order = [];
    var map = {};
    list.forEach(function (r) {
      var key = subGroupKeyFor(r);
      if (!map[key]) { map[key] = { name: key, entries: [] }; order.push(key); }
      map[key].entries.push(r);
    });
    return order.map(function (key) { return map[key]; });
  }

  function groupBy(keyFn) {
    var order = [];
    var map = {};
    resources.forEach(function (r) {
      var key = keyFn(r);
      if (!map[key]) { map[key] = { name: key, resources: [] }; order.push(key); }
      map[key].resources.push(r);
    });
    return order.map(function (key) { return map[key]; });
  }

  function projectGroups() { return groupBy(keyForProject); }
  // Projects whose last assignment ended before the visible timeline's start are excluded —
  // they'd otherwise appear as filter options for a slice of the chart the user can't see.
  function visibleProjectGroups() {
    var offset = viewOffsetWeeks();
    return projectGroups().filter(function (g) {
      return g.resources.some(function (r) { return (r.start + r.duration) > offset; });
    });
  }
  function resourceGroups() { return groupBy(keyForResource); }
  function displayGroups() { return viewMode === 'resource' ? resourceGroups() : projectGroups(); }

  function uniqueResourceNames() {
    var seen = {};
    var names = [];
    resources.forEach(function (r) {
      var n = (r.name || 'Untitled').trim() || 'Untitled';
      if (!seen[n]) { seen[n] = true; names.push(n); }
    });
    return names;
  }
  // Resources whose last assignment ended before the visible timeline's start are excluded —
  // mirrors visibleProjectGroups() so old, no-longer-visible people don't clutter resource filters.
  function visibleResourceNames() {
    var offset = viewOffsetWeeks();
    var active = {};
    resources.forEach(function (r) {
      if (r.start + r.duration > offset) active[normalizeResourceName(r.name)] = true;
    });
    return uniqueResourceNames().filter(function (n) { return active[n]; });
  }

  function uniqueRoles() { return rolesCatalog.slice(); }

  // Reorders the flat resources array so `movedId` sits directly before/after `targetId`.
  // Row order within a project is just array order, so this is how drag-to-reorder works.
  function reorderResource(movedId, targetId, insertAfter) {
    var fromIdx = resources.findIndex(function (r) { return r.id === movedId; });
    if (fromIdx === -1) return;
    var moved = resources[fromIdx];
    resources.splice(fromIdx, 1);
    var toIdx = resources.findIndex(function (r) { return r.id === targetId; });
    if (toIdx === -1) { resources.splice(fromIdx, 0, moved); return; }
    resources.splice(insertAfter ? toIdx + 1 : toIdx, 0, moved);
  }

  // Sorts groups (projects in project view, resources in resource view) alphabetically by name,
  // then sorts the rows within each group (resources in project view, projects in resource view)
  // by start date, breaking ties alphabetically.
  function sortGroupsAlphabetically() {
    var groups = displayGroups();
    groups.sort(function (a, b) {
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    });
    groups.forEach(function (g) {
      g.resources.sort(function (a, b) {
        if (a.start !== b.start) return a.start - b.start;
        var an = (viewMode === 'resource' ? a.project : a.name) || '';
        var bn = (viewMode === 'resource' ? b.project : b.name) || '';
        return an.localeCompare(bn, undefined, { sensitivity: 'base' });
      });
    });
    var sorted = [];
    groups.forEach(function (g) { sorted = sorted.concat(g.resources); });
    resources = sorted;
  }

  // Sorts groups (projects in project view, resources in resource view) by their earliest
  // start date, then their latest end date, then alphabetically — i.e. the group's own overall
  // span, not any single row within it. Rows within each group keep the same start/alpha order
  // as sortGroupsAlphabetically() above.
  function sortGroupsByDate() {
    var groups = displayGroups();
    groups.forEach(function (g) {
      g.spanStart = Math.min.apply(null, g.resources.map(function (r) { return r.start; }));
      g.spanEnd = Math.max.apply(null, g.resources.map(function (r) { return r.start + r.duration; }));
    });
    groups.sort(function (a, b) {
      if (a.spanStart !== b.spanStart) return a.spanStart - b.spanStart;
      if (a.spanEnd !== b.spanEnd) return a.spanEnd - b.spanEnd;
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    });
    groups.forEach(function (g) {
      g.resources.sort(function (a, b) {
        if (a.start !== b.start) return a.start - b.start;
        var an = (viewMode === 'resource' ? a.project : a.name) || '';
        var bn = (viewMode === 'resource' ? b.project : b.name) || '';
        return an.localeCompare(bn, undefined, { sensitivity: 'base' });
      });
    });
    var sorted = [];
    groups.forEach(function (g) { sorted = sorted.concat(g.resources); });
    resources = sorted;
  }

  // ---- Persistence ----
  var saveTimer = null;
  var statusTimer = null;

  function timeNow() { return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }

  function flashStatus(text) {
    saveStatus.textContent = text;
    saveStatus.classList.add('flash');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { saveStatus.classList.remove('flash'); }, 1200);
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistState, 400);
  }

  function currentStateData() {
    // version 3: resource start/duration are stored relative to the fixed DATA_EPOCH, not
    // relative to timelineStart, so panning the view never rewrites saved dates.
    return { version: 3, unit: 'week', timelineStart: isoDateString(timelineStartDate), resources: resources, nextId: nextId, rolesCatalog: rolesCatalog, resourceRoles: resourceRoles };
  }

  function persistState(isRetry) {
    if (!canEdit()) return;
    supabaseClient.from('gantt_state').upsert({ id: 1, data: currentStateData(), updated_at: new Date().toISOString() }).then(function (res) {
      if (res.error) throw res.error;
      flashStatus('Saved · ' + timeNow());
    }).catch(function () {
      if (isRetry) {
        flashStatus('Save failed — check your connection');
        return;
      }
      flashStatus('Save failed, retrying…');
      setTimeout(function () { persistState(true); }, 5000);
    });
  }

  // ---- Supabase load + loading/error overlay ----
  function showLoadOverlay(state) {
    editableArea.classList.add('locked');
    lockOverlay.style.display = '';
    lockOverlayActions.style.display = state === 'error' ? '' : 'none';
    lockOverlayText.textContent = state === 'error'
      ? 'Could not reach the database. Check your connection and retry.'
      : 'Loading schedule…';
  }

  function hideLoadOverlay() {
    editableArea.classList.remove('locked');
    lockOverlay.style.display = 'none';
  }

  function loadStateFromSupabase() {
    render();
    showLoadOverlay('loading');
    supabaseClient.from('gantt_state').select('data').eq('id', 1).single().then(function (res) {
      // PGRST116 = no row yet (fresh table) — treat like today's empty-state.
      if (res.error && res.error.code !== 'PGRST116') throw res.error;
      if (res.data && res.data.data) applyState(res.data.data);
      hideLoadOverlay();
      render();
    }).catch(function () {
      showLoadOverlay('error');
    });
  }

  function applyState(data) {
    if (!data || !Array.isArray(data.resources)) return false;
    var isWeekUnit = data.unit === 'week';
    var savedVersion = Number(data.version) || 1;
    var parsedStart = data.timelineStart ? parseIsoDate(data.timelineStart) : null;
    timelineStartDate = parsedStart ? mondayOnOrBefore(parsedStart) : mondayOnOrBefore(new Date());

    // Files saved before version 3 stored start/duration relative to their own timelineStart
    // (panning used to rewrite every resource's start). Migrate those into DATA_EPOCH-relative
    // numbers once on load so this and every later load/save stays put regardless of panning.
    var migrateOffsetWeeks = 0;
    if (savedVersion < 3) {
      var oldAnchor = parsedStart || timelineStartDate;
      migrateOffsetWeeks = Math.round((oldAnchor - DATA_EPOCH) / (7 * 86400000));
    }

    resources = data.resources.map(function (r) {
      var rawStart = Number(r.start) || 0;
      var rawDuration = Math.max(1, Number(r.duration) || 1);
      var start = isWeekUnit ? Math.round(rawStart) : Math.round(rawStart / 7);
      var duration = isWeekUnit ? Math.max(1, Math.round(rawDuration)) : Math.max(1, Math.round(rawDuration / 7));
      return {
        id: Number(r.id),
        name: String(r.name || ''),
        project: String(r.project || 'Untitled Project'),
        projectId: r.projectId || null,
        allocation: isFinite(Number(r.allocation)) ? Number(r.allocation) : 0,
        start: start + migrateOffsetWeeks,
        duration: duration
      };
    });
    nextId = Number(data.nextId) || (resources.reduce(function (m, r) { return Math.max(m, r.id); }, 0) + 1);
    // "skillsCatalog"/"resourceSkills" were this feature's original field names before it was
    // renamed to "roles" — read them as a fallback so files saved before the rename don't lose data.
    rolesCatalog = Array.isArray(data.rolesCatalog) ? data.rolesCatalog.map(String) : (Array.isArray(data.skillsCatalog) ? data.skillsCatalog.map(String) : []);
    resourceRoles = (data.resourceRoles && typeof data.resourceRoles === 'object') ? data.resourceRoles : ((data.resourceSkills && typeof data.resourceSkills === 'object') ? data.resourceSkills : {});
    return true;
  }

  function monthSegments() {
    var segs = [];
    var cur = null;
    for (var w = 0; w < TOTAL_WEEKS; w++) {
      var d = dateForWeek(w);
      var key = d.getFullYear() + '-' + d.getMonth();
      if (!cur || cur.key !== key) {
        cur = { key: key, label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), count: 0 };
        segs.push(cur);
      }
      cur.count++;
    }
    return segs;
  }

  function gridBackground() {
    var todayLeft = (todayWeekIndex() + todayFractionWithinWeek()) * WEEK_WIDTH;
    var images = ['repeating-linear-gradient(to bottom, var(--today-marker) 0, var(--today-marker) 2px, transparent 2px, transparent 6px)'];
    var sizes = ['2px 100%'];
    var positions = [(LABEL_WIDTH + todayLeft) + 'px 0'];
    var repeats = ['no-repeat'];

    if (selectedWeeks.length) {
      var tint = 'color-mix(in srgb, var(--series-1) 20%, transparent)';
      selectedWeeks.forEach(function (w) {
        images.push('linear-gradient(' + tint + ', ' + tint + ')');
        sizes.push(WEEK_WIDTH + 'px 100%');
        positions.push((LABEL_WIDTH + w * WEEK_WIDTH) + 'px 0');
        repeats.push('no-repeat');
      });
    }

    images.push('linear-gradient(to right, var(--gridline) 0 1px, transparent 1px 100%)');
    sizes.push(WEEK_WIDTH + 'px 100%');
    positions.push(LABEL_WIDTH + 'px 0');
    repeats.push('repeat-x');

    return {
      backgroundImage: images.join(', '),
      backgroundSize: sizes.join(', '),
      backgroundPosition: positions.join(', '),
      backgroundRepeat: repeats.join(', ')
    };
  }

  function renderPanelFilterChips() {
    var isResourceView = panelViewMode === 'resource';
    panelFilterLabel.textContent = isResourceView ? 'Filter projects' : 'Filter resources';
    panelFilterChips.classList.toggle('filter-chips-red', !isResourceView);

    var names = (isResourceView ? visibleProjectGroups().map(function (g) { return g.name; }) : visibleResourceNames()).sort(function (a, b) { return a.localeCompare(b); });
    var filterState = isResourceView ? panelFilter : panelResourceFilter;
    var isAll = filterState === null;
    var isNone = !isAll && filterState.length === 0;
    var dataAttr = isResourceView ? 'data-filter-project' : 'data-filter-resource';
    var allLabel = isResourceView ? 'All projects' : 'All resources';
    var html = '<button type="button" class="filter-chip' + (isAll ? ' active' : '') + '" data-filter-all="1">' + allLabel + '</button>';
    html += '<button type="button" class="filter-chip' + (isNone ? ' active' : '') + '" data-filter-none="1">None</button>';
    html += names.map(function (n) {
      var checked = isAll || filterState.indexOf(n) !== -1;
      return '<button type="button" class="filter-chip' + (checked ? ' active' : '') + '" ' + dataAttr + '="' + escapeAttr(n) + '">' + escapeAttr(n) + '</button>';
    }).join('');
    panelFilterChips.innerHTML = html;
  }

  function renderPanelRolesFilterChips() {
    var names = uniqueRoles().sort(function (a, b) { return a.localeCompare(b); });
    var isAll = panelRolesFilter === null;
    var isNone = !isAll && panelRolesFilter.length === 0;
    var html = '<button type="button" class="filter-chip' + (isAll ? ' active' : '') + '" data-filter-all="1">All roles</button>';
    html += '<button type="button" class="filter-chip' + (isNone ? ' active' : '') + '" data-filter-none="1">None</button>';
    html += names.map(function (n) {
      var checked = isAll || panelRolesFilter.indexOf(n) !== -1;
      return '<button type="button" class="filter-chip' + (checked ? ' active' : '') + '" data-filter-panel-role="' + escapeAttr(n) + '">' + escapeAttr(n) + '</button>';
    }).join('');
    panelRolesFilterChips.innerHTML = html;
  }

  function panelRowHtml(name, subtitle, rangeText, total, flagOverAllocated) {
    var overAllocated = flagOverAllocated && total > 100;
    return '<div class="panel-row">' +
      '<div class="panel-row-main">' +
        '<div class="panel-row-name">' + escapeAttr(name) + '</div>' +
        '<div class="panel-row-project">' + escapeAttr(subtitle) + '</div>' +
        (rangeText ? '<div class="panel-row-range">' + rangeText + '</div>' : '') +
      '</div>' +
      '<div class="panel-row-alloc' + (overAllocated ? ' over-allocated' : '') + '">' + total + '%</div>' +
    '</div>';
  }

  function renderResourceFilterChips() {
    var names = visibleResourceNames().sort(function (a, b) { return a.localeCompare(b); });
    resourceFilterBar.style.display = names.length ? '' : 'none';
    var isAll = resourceFilter === null;
    var isNone = !isAll && resourceFilter.length === 0;
    var html = '<button type="button" class="filter-chip' + (isAll ? ' active' : '') + '" data-filter-all="1">All resources</button>';
    html += '<button type="button" class="filter-chip' + (isNone ? ' active' : '') + '" data-filter-none="1">None</button>';
    html += names.map(function (n) {
      var checked = isAll || resourceFilter.indexOf(n) !== -1;
      return '<button type="button" class="filter-chip' + (checked ? ' active' : '') + '" data-filter-resource="' + escapeAttr(n) + '">' + escapeAttr(n) + '</button>';
    }).join('');
    resourceFilterChips.innerHTML = html;
  }

  function renderProjectFilterChips() {
    var names = visibleProjectGroups().map(function (g) { return g.name; }).sort(function (a, b) { return a.localeCompare(b); });
    projectFilterBar.style.display = names.length ? '' : 'none';
    var isAll = projectFilter === null;
    var isNone = !isAll && projectFilter.length === 0;
    var html = '<button type="button" class="filter-chip' + (isAll ? ' active' : '') + '" data-filter-all="1">All projects</button>';
    html += '<button type="button" class="filter-chip' + (isNone ? ' active' : '') + '" data-filter-none="1">None</button>';
    html += names.map(function (n) {
      var checked = isAll || projectFilter.indexOf(n) !== -1;
      return '<button type="button" class="filter-chip' + (checked ? ' active' : '') + '" data-filter-project="' + escapeAttr(n) + '">' + escapeAttr(n) + '</button>';
    }).join('');
    projectFilterChips.innerHTML = html;
  }

  function renderRolesFilterChips() {
    var names = uniqueRoles().sort(function (a, b) { return a.localeCompare(b); });
    rolesFilterBar.style.display = names.length ? '' : 'none';
    var isAll = rolesFilter === null;
    var isNone = !isAll && rolesFilter.length === 0;
    var html = '<button type="button" class="filter-chip' + (isAll ? ' active' : '') + '" data-filter-all="1">All roles</button>';
    html += '<button type="button" class="filter-chip' + (isNone ? ' active' : '') + '" data-filter-none="1">None</button>';
    html += names.map(function (n) {
      var checked = isAll || rolesFilter.indexOf(n) !== -1;
      return '<button type="button" class="filter-chip' + (checked ? ' active' : '') + '" data-filter-roles="' + escapeAttr(n) + '">' + escapeAttr(n) + '</button>';
    }).join('');
    rolesFilterChips.innerHTML = html;
  }

  function renderPanel() {
    renderPanelFilterChips();
    renderPanelRolesFilterChips();
    panelViewToggleBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.panelView === panelViewMode);
    });
    panelFilterChips.style.display = panelFiltersCollapsed ? 'none' : '';
    panelFilterCollapseToggle.classList.toggle('collapsed', panelFiltersCollapsed);
    panelFilterCollapseToggle.title = (panelFiltersCollapsed ? 'Expand' : 'Collapse') + ' filter';

    panelRolesFilterRow.style.display = uniqueRoles().length ? '' : 'none';
    panelRolesFilterChips.style.display = panelRolesFiltersCollapsed ? 'none' : '';
    panelRolesFilterCollapseToggle.classList.toggle('collapsed', panelRolesFiltersCollapsed);
    panelRolesFilterCollapseToggle.title = (panelRolesFiltersCollapsed ? 'Expand' : 'Collapse') + ' filter';

    if (!selectedWeeks.length) {
      sidePanel.classList.remove('open');
      return;
    }
    sidePanel.classList.add('open');
    panelDate.textContent = selectedWeeksLabel();

    var isResourceView = panelViewMode === 'resource';
    var panelOffset = viewOffsetWeeks();

    if (isResourceView) {
      var allProjectNames = visibleProjectGroups().map(function (g) { return g.name; });
      var isAll = panelFilter === null;
      var isRolesAll = panelRolesFilter === null;
      var active = resources.filter(function (r) {
        var rViewStart = r.start - panelOffset;
        var inRange = selectedWeeks.some(function (w) { return w >= rViewStart && w < rViewStart + r.duration; });
        var inFilter = isAll || panelFilter.indexOf(r.project || 'Untitled Project') !== -1;
        var inRoleFilter = isRolesAll || panelRolesFilter.indexOf(roleForResource(r)) !== -1;
        return inRange && inFilter && inRoleFilter;
      });
      var total = active.reduce(function (sum, r) { return sum + (Number(r.allocation) || 0); }, 0);
      var projectsInvolved = {};
      active.forEach(function (r) { projectsInvolved[r.project || 'Untitled Project'] = true; });
      var projectCount = Object.keys(projectsInvolved).length;

      var byName = {};
      var nameOrder = [];
      active.forEach(function (r) {
        var key = (r.name || 'Untitled').trim() || 'Untitled';
        if (!byName[key]) { byName[key] = { name: key, total: 0, entries: [] }; nameOrder.push(key); }
        byName[key].total += Number(r.allocation) || 0;
        byName[key].entries.push(r);
      });
      var peopleCount = nameOrder.length;
      nameOrder.sort(function (a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); });

      var filterNote = isAll ? '' : ' · filtered to ' + panelFilter.length + ' of ' + allProjectNames.length + ' projects';
      filterNote += isRolesAll ? '' : ' · filtered to ' + panelRolesFilter.length + ' of ' + uniqueRoles().length + ' roles';
      panelSummary.textContent = peopleCount
        ? peopleCount + ' resource' + (peopleCount === 1 ? '' : 's') + ' · ' + total + '% total allocation' +
          (projectCount > 1 ? ' · ' + projectCount + ' projects' : '') + filterNote
        : 'No resources allocated for the selected week(s)' + filterNote;

      panelList.innerHTML = nameOrder.map(function (key) {
        var g = byName[key];
        var projectNames = [];
        g.entries.forEach(function (e) {
          var p = e.project || 'Untitled Project';
          if (projectNames.indexOf(p) === -1) projectNames.push(p);
        });
        projectNames.sort(function (a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); });
        var subtitle = projectNames.join(', ') + (g.entries.length > 1 ? ' · ' + g.entries.length + ' assignments' : '');
        var rangeText = g.entries.length === 1 ? rangeLabelShortAnchor(g.entries[0].start, g.entries[0].start + g.entries[0].duration) : '';
        return panelRowHtml(g.name, subtitle, rangeText, g.total, true);
      }).join('');
    } else {
      var allResNames = visibleResourceNames();
      var isAllRes = panelResourceFilter === null;
      var isRolesAllR = panelRolesFilter === null;
      var activeR = resources.filter(function (r) {
        var rViewStart2 = r.start - panelOffset;
        var inRange = selectedWeeks.some(function (w) { return w >= rViewStart2 && w < rViewStart2 + r.duration; });
        var inFilter = isAllRes || panelResourceFilter.indexOf((r.name || 'Untitled').trim() || 'Untitled') !== -1;
        var inRoleFilter = isRolesAllR || panelRolesFilter.indexOf(roleForResource(r)) !== -1;
        return inRange && inFilter && inRoleFilter;
      });
      var totalR = activeR.reduce(function (sum, r) { return sum + (Number(r.allocation) || 0); }, 0);
      var resourcesInvolved = {};
      activeR.forEach(function (r) { resourcesInvolved[(r.name || 'Untitled').trim() || 'Untitled'] = true; });
      var resourceCount = Object.keys(resourcesInvolved).length;

      var byProject = {};
      var projOrder = [];
      activeR.forEach(function (r) {
        var key = r.project || 'Untitled Project';
        if (!byProject[key]) { byProject[key] = { name: key, total: 0, entries: [] }; projOrder.push(key); }
        byProject[key].total += Number(r.allocation) || 0;
        byProject[key].entries.push(r);
      });
      var projectListCount = projOrder.length;
      projOrder.sort(function (a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); });

      var filterNoteR = isAllRes ? '' : ' · filtered to ' + panelResourceFilter.length + ' of ' + allResNames.length + ' resources';
      filterNoteR += isRolesAllR ? '' : ' · filtered to ' + panelRolesFilter.length + ' of ' + uniqueRoles().length + ' roles';
      panelSummary.textContent = projectListCount
        ? projectListCount + ' project' + (projectListCount === 1 ? '' : 's') + ' · ' + totalR + '% total allocation' +
          (resourceCount > 1 ? ' · ' + resourceCount + ' resources' : '') + filterNoteR
        : 'No projects allocated for the selected week(s)' + filterNoteR;

      panelList.innerHTML = projOrder.map(function (key) {
        var g = byProject[key];
        var resNames = [];
        g.entries.forEach(function (e) {
          var n = (e.name || 'Untitled').trim() || 'Untitled';
          if (resNames.indexOf(n) === -1) resNames.push(n);
        });
        resNames.sort(function (a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); });
        var subtitle = resNames.join(', ') + (g.entries.length > 1 ? ' · ' + g.entries.length + ' assignments' : '');
        var rangeText = g.entries.length === 1 ? rangeLabelShortAnchor(g.entries[0].start, g.entries[0].start + g.entries[0].duration) : '';
        return panelRowHtml(g.name, subtitle, rangeText, g.total);
      }).join('');
    }
  }

  // Bounds the chart panel to the remaining viewport height below it, so it scrolls
  // internally (letting the sticky header rows work) instead of growing the whole page.
  function updateGanttScrollHeight() {
    var top = ganttScroll.getBoundingClientRect().top;
    var available = window.innerHeight - top - 24;
    appEl.style.setProperty('--gantt-scroll-max-height', Math.max(200, available) + 'px');
  }
  window.addEventListener('resize', updateGanttScrollHeight);

  function render() {
    appEl.classList.toggle('view-only', !canEdit());
    cleanupBtn.disabled = !canEdit();
    manageRolesBtn.disabled = !canEdit();
    viewToggleBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.view === viewMode);
    });
    appEl.dataset.viewMode = viewMode;
    appEl.dataset.density = density;
    densityToggleBtn.textContent = 'Density:' + (density === 'narrow' ? 'Narrow' : 'Normal');
    zoomOutBtn.disabled = zoom <= MIN_ZOOM;
    zoomInBtn.disabled = zoom >= MAX_ZOOM;
    zoomLevelLabel.textContent = Math.round(zoom * 100) + '%';
    timelineStartInput.value = isoDateString(timelineStartDate);
    renderResourceFilterChips();
    renderProjectFilterChips();
    renderRolesFilterChips();
    filtersBlock.style.display = (resourceFilterBar.style.display !== 'none' || projectFilterBar.style.display !== 'none' || rolesFilterBar.style.display !== 'none') ? '' : 'none';
    filtersBlockBody.style.display = filtersCollapsed ? 'none' : '';
    filtersCollapseToggle.classList.toggle('collapsed', filtersCollapsed);
    filtersCollapseToggle.title = (filtersCollapsed ? 'Expand' : 'Collapse') + ' filters';

    grid.style.gridTemplateColumns = LABEL_WIDTH + 'px repeat(' + TOTAL_WEEKS + ', ' + WEEK_WIDTH + 'px)';
    colResizeHandle.style.left = LABEL_WIDTH + 'px';
    var bg = gridBackground();
    grid.style.backgroundImage = bg.backgroundImage;
    grid.style.backgroundSize = bg.backgroundSize;
    grid.style.backgroundPosition = bg.backgroundPosition;
    grid.style.backgroundRepeat = bg.backgroundRepeat;

    var html = '';

    // Computed early so the "expand/collapse all" button in the Timeline header can reflect
    // and toggle the same group set the rows below are built from.
    var groups = displayGroups();
    var groupNoun = viewMode === 'resource' ? 'resource' : 'project';
    var allGroupsCollapsed = groups.length > 0 && groups.every(function (g) { return !!collapsedGroups[viewMode][g.name]; });

    // Month row
    html += '<div class="cell label-cell header-cell month-label"></div>';
    monthSegments().forEach(function (seg) {
      html += '<div class="cell month-cell" style="grid-column: span ' + seg.count + '">' + seg.label + '</div>';
    });

    // Week row
    html += '<div class="cell label-cell header-cell timeline-label">' +
      '<button type="button" class="collapse-toggle timeline-toggle-btn' + (allGroupsCollapsed ? ' collapsed' : '') + '" title="' + (allGroupsCollapsed ? 'Expand' : 'Collapse') + ' all ' + groupNoun + 's">▾</button>' +
      'Timeline' +
      '<button type="button" class="add-entry-btn timeline-add-btn" title="Add a new project or resource">+</button>' +
      '</div>';
    var tIdx = todayWeekIndex();
    for (var w = 0; w < TOTAL_WEEKS; w++) {
      var isToday = (w === tIdx);
      var isSelected = selectedWeeks.indexOf(w) !== -1;
      html += '<div class="cell week-cell' + (isToday ? ' today' : '') + (isSelected ? ' selected' : '') + '" data-week-index="' + w + '" title="' + escapeAttr(weekLabelLong(w)) + '">' +
        weekCellLabel(w) +
        '</div>';
    }

    // Rows, grouped by project or resource depending on viewMode
    var isFiltered = resourceFilter !== null;
    var isProjectFiltered = projectFilter !== null;
    var isRolesFiltered = rolesFilter !== null;
    var rowCounter = 0;
    var renderedAny = false;
    groups.forEach(function (group, gi) {
      var visibleResources = group.resources.filter(function (r) {
        var nameOk = !isFiltered || resourceFilter.indexOf((r.name || 'Untitled').trim() || 'Untitled') !== -1;
        var projOk = !isProjectFiltered || projectFilter.indexOf(r.project || 'Untitled Project') !== -1;
        var roleOk = !isRolesFiltered || rolesFilter.indexOf(roleForResource(r)) !== -1;
        var inView = !!clipRangeToView(r.start, r.duration);
        return nameOk && projOk && roleOk && inView;
      });
      if (!visibleResources.length) return;
      renderedAny = true;

      var ranges = projectRangesFor(visibleResources);
      var colorSlot = (gi % 8) + 1;
      var isResourceView = viewMode === 'resource';
      var groupClass = gi > 0 ? ' group-divider' : '';
      var isCollapsed = !!collapsedGroups[viewMode][group.name];
      var renameHint = viewMode === 'resource'
        ? 'Rename resource (applies to every assignment for this person)'
        : 'Rename project (applies to every resource in it)';

      html += '<div class="cell label-cell' + groupClass + '" data-project="' + escapeAttr(group.name) + '">' +
        '<button type="button" class="collapse-toggle' + (isCollapsed ? ' collapsed' : '') + '" data-project="' + escapeAttr(group.name) + '" title="' + (isCollapsed ? 'Expand' : 'Collapse') + ' ' + groupNoun + '">▾</button>' +
        '<input class="project-label-input" data-role="group-project" data-project="' + escapeAttr(group.name) + '" value="' + escapeAttr(group.name) + '" title="' + renameHint + '" style="color: var(--series-' + colorSlot + ')" />' +
        '<button type="button" class="add-entry-btn" data-group="' + escapeAttr(group.name) + '" title="' + (viewMode === 'resource' ? 'Add assignment for ' + escapeAttr(group.name) : 'Add resource to ' + escapeAttr(group.name)) + '">+</button>' +
        (isCollapsed ? '<span class="collapse-count">' + visibleResources.length + '</span>' : '') +
        '</div>';
      html += '<div class="cell track-cell project-track' + groupClass + '" data-project="' + escapeAttr(group.name) + '" style="grid-column: span ' + TOTAL_WEEKS + '">';
      var anyBarVisible = false;
      ranges.forEach(function (seg) {
        var clippedSeg = clipRangeToView(seg.start, seg.end - seg.start);
        if (!clippedSeg) return;
        anyBarVisible = true;
        var runs = isResourceView ? weeklyAllocRunsFor(seg, visibleResources) : [{ start: seg.start, end: seg.end, isLow: false }];
        runs.forEach(function (run) {
          var clippedRange = clipRangeToView(run.start, run.end - run.start);
          if (!clippedRange) return;
          var pLeft = clippedRange.start * WEEK_WIDTH;
          var pWidth = (clippedRange.end - clippedRange.start) * WEEK_WIDTH;
          var weeks = run.end - run.start;
          var pTitle = escapeAttr(group.name + ': ' + rangeLabelShortAnchor(run.start, run.end) + ' (' + weeks + 'w)');
          var pTruncClass = clippedRange.truncatedLeft ? ' bar-truncated-left' : '';
          var pBg = run.isLow ? 'transparent' : 'color-mix(in srgb, var(--series-' + colorSlot + ') 22%, transparent)';
          html += '<div class="project-bar' + pTruncClass + '" title="' + pTitle + '" style="left:' + pLeft + 'px; width:' + pWidth + 'px; background-image: none; background-color: ' + pBg + '; border-color: var(--series-' + colorSlot + ')"></div>';
        });
      });
      if (!anyBarVisible) {
        html += '<div class="project-empty">' + (viewMode === 'resource' ? 'No assignments for this resource yet' : 'No resources in this project yet') + '</div>';
      }
      html += '</div>';

      if (isCollapsed) return;

      var subGroups = subGroupEntries(visibleResources);
      subGroups.forEach(function (sub) {
        var rowClass = (rowCounter % 2 === 1) ? ' row-even' : '';
        rowCounter++;
        var entryPlaceholder = viewMode === 'resource' ? 'Project' : 'Name';
        var idList = sub.entries.map(function (e) { return e.id; }).join(',');
        var primaryId = sub.entries[0].id;

        html += '<div class="cell label-cell resource-label' + rowClass + '" data-id="' + primaryId + '" data-project="' + escapeAttr(group.name) + '" data-subgroup="' + escapeAttr(sub.name) + '">' +
          '<div class="resource-label-top">' +
            '<input class="name-input" data-ids="' + idList + '" data-role="subgroup-rename" value="' + escapeAttr(sub.name) + '" placeholder="' + entryPlaceholder + '" />' +
            '<button type="button" class="add-entry-btn subgroup-add-btn" data-group="' + escapeAttr(group.name) + '" data-subgroup="' + escapeAttr(sub.name) + '" title="Add another date range for ' + escapeAttr(sub.name) + '">+</button>' +
          '</div>' +
          '</div>';

        html += '<div class="cell track-cell' + rowClass + '" data-track-for="' + primaryId + '" data-project="' + escapeAttr(group.name) + '" data-subgroup="' + escapeAttr(sub.name) + '" style="grid-column: span ' + TOTAL_WEEKS + '">';
        sub.entries.forEach(function (r) {
          var clipped = clipRangeToView(r.start, r.duration);
          if (!clipped) return;
          var left = clipped.start * WEEK_WIDTH;
          var width = (clipped.end - clipped.start) * WEEK_WIDTH;
          var truncClass = clipped.truncatedLeft ? ' bar-truncated-left' : '';
          var leftHandle = clipped.truncatedLeft ? '' : '<span class="handle left" data-id="' + r.id + '" data-mode="resize-left"></span>';
          html += '<div class="bar' + truncClass + '" data-id="' + r.id + '" style="left:' + left + 'px; width:' + width + 'px; background: var(--series-' + colorSlot + ')" title="' +
            escapeAttr(barTitle(r)) + '">' +
            leftHandle +
            '<input class="bar-alloc-input" type="number" min="0" data-id="' + r.id + '" data-role="alloc" value="' + r.allocation + '" />' +
            '<span class="alloc-unit">%</span>' +
            '<button type="button" class="bar-del-btn" data-id="' + r.id + '" title="Remove this entry">✕</button>' +
            '<span class="handle right" data-id="' + r.id + '" data-mode="resize-right"></span>' +
            '</div>';
        });
        html += '</div>';
      });
    });

    grid.innerHTML = html;

    // Keeps the week-row sticky offset in sync with the month row's actual rendered
    // height, so the two header rows stack correctly without a hardcoded pixel guess.
    var monthLabelEl = grid.querySelector('.label-cell.month-label');
    if (monthLabelEl) {
      appEl.style.setProperty('--header-row1-height', monthLabelEl.getBoundingClientRect().height + 'px');
    }
    updateGanttScrollHeight();

    // #projectList (the Add-resource modal's typeahead) is populated from
    // the canonical projects registry via populateProjectDatalist(), not
    // from locally-used project names — see refreshProjectsCatalog().

    var resourceNameListEl = document.getElementById('resourceNameList');
    if (resourceNameListEl) {
      resourceNameListEl.innerHTML = uniqueResourceNames().map(function (n) {
        return '<option value="' + escapeAttr(n) + '"></option>';
      }).join('');
    }

    if (!resources.length || !renderedAny) {
      var note = document.createElement('div');
      note.className = 'empty-state';
      note.style.gridColumn = '1 / -1';
      if (resources.length) {
        note.textContent = (isFiltered || isProjectFiltered)
          ? 'No resources match the current filter.'
          : 'Nothing scheduled in this date range.';
      } else {
        var emptyMsg = document.createElement('div');
        emptyMsg.textContent = 'No resources yet.';
        var emptyAddBtn = document.createElement('button');
        emptyAddBtn.type = 'button';
        emptyAddBtn.className = 'ghost-btn';
        emptyAddBtn.style.marginTop = '10px';
        emptyAddBtn.textContent = '+ Add resource';
        emptyAddBtn.addEventListener('click', function () { openAddModal(); });
        note.appendChild(emptyMsg);
        note.appendChild(emptyAddBtn);
      }
      grid.appendChild(note);
    }

    renderPanel();
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function barTitle(r) {
    return r.name + ' — ' + r.project + ': ' + rangeLabelShortAnchor(r.start, r.start + r.duration) + ' (' + r.duration + 'w, ' + r.allocation + '%)';
  }

  // ---- Add resource ----
  // ---- Add-resource modal ----
  function openAddModal(prefill) {
    if (!canEdit()) return;
    prefill = prefill || {};
    projectInput.value = prefill.project || '';
    nameInput.value = prefill.name || '';
    allocInput.value = '100';
    addModalOverlay.style.display = 'flex';
    refreshProjectsCatalog();
    var focusTarget = (prefill.name && prefill.project) ? allocInput : (prefill.name ? projectInput : nameInput);
    focusTarget.focus();
    if (focusTarget.select) focusTarget.select();
  }

  function closeAddModal() {
    addModalOverlay.style.display = 'none';
  }

  addModalClose.addEventListener('click', closeAddModal);
  addModalCancel.addEventListener('click', closeAddModal);
  addModalOverlay.addEventListener('click', function (e) {
    if (e.target === addModalOverlay) closeAddModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (addModalOverlay.style.display !== 'none') closeAddModal();
    if (rolesModalOverlay.style.display !== 'none') closeRolesModal();
    if (cleanupModalOverlay.style.display !== 'none') closeCleanupModal();
  });

  // ---- Manage Roles modal ----
  function renderRolesModal() {
    var names = uniqueResourceNames();
    var catalog = rolesCatalog;
    if (!names.length) {
      rolesResourceList.innerHTML = '<div class="empty-state">No resources yet.</div>';
      return;
    }
    rolesResourceList.innerHTML = names.map(function (name) {
      var current = resourceRoles[name] || '';
      var options = '<option value="">— no role —</option>' + catalog.map(function (s) {
        return '<option value="' + escapeAttr(s) + '"' + (s === current ? ' selected' : '') + '>' + escapeAttr(s) + '</option>';
      }).join('');
      return '<div class="roles-resource-row">' +
        '<span class="roles-resource-name">' + escapeAttr(name) + '</span>' +
        '<select class="role-select" data-name="' + escapeAttr(name) + '">' + options + '</select>' +
        '</div>';
    }).join('');
  }

  function openRolesModal() {
    renderRolesModal();
    newRoleInput.value = '';
    rolesModalOverlay.style.display = 'flex';
  }

  function closeRolesModal() {
    rolesModalOverlay.style.display = 'none';
  }

  manageRolesBtn.addEventListener('click', openRolesModal);
  rolesModalClose.addEventListener('click', closeRolesModal);
  rolesModalOverlay.addEventListener('click', function (e) {
    if (e.target === rolesModalOverlay) closeRolesModal();
  });

  function addNewRole() {
    if (!canEdit()) return;
    var val = newRoleInput.value.trim();
    if (!val || rolesCatalog.indexOf(val) !== -1) { newRoleInput.value = ''; return; }
    rolesCatalog.push(val);
    newRoleInput.value = '';
    renderRolesModal();
    render();
    scheduleSave();
  }
  addRoleBtn.addEventListener('click', addNewRole);
  newRoleInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); addNewRole(); }
  });

  rolesResourceList.addEventListener('change', function (e) {
    if (!canEdit()) return;
    var sel = e.target.closest('.role-select');
    if (!sel) return;
    var name = sel.dataset.name;
    if (sel.value) resourceRoles[name] = sel.value; else delete resourceRoles[name];
    render();
    scheduleSave();
  });

  // ---- Data Clean Up modal ----
  // An entry has "finished" once its last scheduled week has fully passed relative to
  // today's real calendar date (not the pannable view start, which never moves finished entries).
  function entryEndDate(r) {
    return weekEndDateForAnchor(r.start + r.duration - 1);
  }
  function findFinishedEntries() {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    return resources.filter(function (r) { return entryEndDate(r) < today; })
      .sort(function (a, b) { return entryEndDate(a) - entryEndDate(b); });
  }
  var pendingCleanupIds = [];

  function renderCleanupList() {
    var finished = findFinishedEntries();
    pendingCleanupIds = finished.map(function (r) { return r.id; });
    if (!finished.length) {
      cleanupList.innerHTML = '<div class="empty-state">No finished project or resource tasks to remove.</div>';
      cleanupOkBtn.disabled = true;
      return;
    }
    cleanupOkBtn.disabled = false;
    cleanupList.innerHTML = finished.map(function (r) {
      return '<div class="cleanup-row">' +
        '<div class="cleanup-row-main">' +
          '<div class="cleanup-row-project">' + escapeAttr(r.project || 'Untitled Project') + '</div>' +
          '<div class="cleanup-row-resource">' + escapeAttr(r.name || 'Untitled') + '</div>' +
        '</div>' +
        '<div class="cleanup-row-date">' + escapeAttr(fmtLong(entryEndDate(r))) + '</div>' +
        '</div>';
    }).join('');
  }

  function openCleanupModal() {
    renderCleanupList();
    cleanupModalOverlay.style.display = 'flex';
  }

  function closeCleanupModal() {
    cleanupModalOverlay.style.display = 'none';
  }

  cleanupBtn.addEventListener('click', openCleanupModal);
  cleanupModalClose.addEventListener('click', closeCleanupModal);
  cleanupCancelBtn.addEventListener('click', closeCleanupModal);
  cleanupModalOverlay.addEventListener('click', function (e) {
    if (e.target === cleanupModalOverlay) closeCleanupModal();
  });
  cleanupOkBtn.addEventListener('click', function () {
    if (!canEdit()) return;
    if (!pendingCleanupIds.length) return;
    var idSet = pendingCleanupIds;
    resources = resources.filter(function (r) { return idSet.indexOf(r.id) === -1; });
    closeCleanupModal();
    render();
    scheduleSave();
    flashStatus('Removed ' + idSet.length + ' finished ' + (idSet.length === 1 ? 'entry' : 'entries'));
  });

  // Finishes adding a resource once we know which project (existing or
  // freshly created) it links to.
  function finishAddResource(name, allocation, project, projectId) {
    var addOffset = viewOffsetWeeks();
    var sameProject = resources.filter(function (r) { return r.project === project; });
    var startView = sameProject.length
      ? Math.max.apply(null, sameProject.map(function (r) { return r.start + r.duration; })) - addOffset
      : todayWeekIndex();
    startView = clamp(startView, 0, TOTAL_WEEKS - DEFAULT_DURATION);
    addResourceInternal(name, allocation, startView + addOffset, DEFAULT_DURATION, project, projectId);
    closeAddModal();
    render();
    scheduleSave();
  }

  addForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!canEdit()) return;
    var name = nameInput.value.trim();
    var typedProject = projectInput.value.trim();
    var allocation = Number(allocInput.value);
    if (!name || !typedProject) return;
    if (!isFinite(allocation) || allocation < 0) allocation = 0;

    var matchedProject = findCatalogProjectByName(typedProject);
    if (matchedProject) {
      finishAddResource(name, allocation, matchedProject.canonical_name, matchedProject.id);
      return;
    }

    // No exact match — create it, same as intake/roadmap do when a typed
    // title doesn't match anything in the registry yet.
    supabaseClient.from('projects').insert({ canonical_name: typedProject, origin_app: 'schedule-a-db-v2' })
      .select('id, canonical_name').single().then(function (res) {
        if (res.error) {
          flashStatus('Could not create project — ' + res.error.message);
          return;
        }
        projectsCatalog.push(res.data);
        populateProjectDatalist();
        finishAddResource(name, allocation, res.data.canonical_name, res.data.id);
      });
  });

  // ---- Delegated events on the grid ----
  grid.addEventListener('click', function (e) {
    var timelineToggleBtn = e.target.closest('.timeline-toggle-btn');
    if (timelineToggleBtn) {
      var toggleGroups = displayGroups();
      var allCollapsed = toggleGroups.length > 0 && toggleGroups.every(function (g) { return !!collapsedGroups[viewMode][g.name]; });
      toggleGroups.forEach(function (g) { collapsedGroups[viewMode][g.name] = !allCollapsed; });
      render();
      return;
    }
    var toggle = e.target.closest('.collapse-toggle');
    if (toggle) {
      var pname = toggle.dataset.project;
      collapsedGroups[viewMode][pname] = !collapsedGroups[viewMode][pname];
      render();
      return;
    }
    var timelineAddBtn = e.target.closest('.timeline-add-btn');
    if (timelineAddBtn) {
      openAddModal();
      return;
    }
    var barDel = e.target.closest('.bar-del-btn');
    if (barDel) {
      if (!canEdit()) return;
      var id = Number(barDel.dataset.id);
      resources = resources.filter(function (r) { return r.id !== id; });
      render();
      scheduleSave();
      return;
    }
    var subAddBtn = e.target.closest('.subgroup-add-btn');
    if (subAddBtn) {
      var gName = subAddBtn.dataset.group || '';
      var sName = subAddBtn.dataset.subgroup || '';
      openAddModal(viewMode === 'resource' ? { name: gName, project: sName } : { project: gName, name: sName });
      return;
    }
    var addBtn = e.target.closest('.add-entry-btn');
    if (addBtn) {
      var groupName = addBtn.dataset.group || '';
      openAddModal(viewMode === 'resource' ? { name: groupName } : { project: groupName });
      return;
    }
    var weekCell = e.target.closest('.week-cell');
    if (weekCell) {
      var idx = Number(weekCell.dataset.weekIndex);
      var alreadySelected = selectedWeeks.length === 1 && selectedWeeks[0] === idx;
      selectedWeeks = alreadySelected ? [] : [idx];
      render();
    }
  });

  panelClose.addEventListener('click', function () {
    selectedWeeks = [];
    render();
  });

  panelFilterChips.addEventListener('click', function (e) {
    var chip = e.target.closest('.filter-chip');
    if (!chip) return;
    if (panelViewMode === 'resource') {
      var allNames = visibleProjectGroups().map(function (g) { return g.name; });
      if (chip.dataset.filterAll) {
        panelFilter = null;
      } else if (chip.dataset.filterNone) {
        panelFilter = [];
      } else {
        var name = chip.dataset.filterProject;
        var current = (panelFilter === null) ? allNames.slice() : panelFilter.slice();
        var idx = current.indexOf(name);
        if (idx === -1) current.push(name); else current.splice(idx, 1);
        panelFilter = (current.length === allNames.length) ? null : current;
      }
    } else {
      var allResNames = visibleResourceNames();
      if (chip.dataset.filterAll) {
        panelResourceFilter = null;
      } else if (chip.dataset.filterNone) {
        panelResourceFilter = [];
      } else {
        var rname = chip.dataset.filterResource;
        var currentR = (panelResourceFilter === null) ? allResNames.slice() : panelResourceFilter.slice();
        var idxR = currentR.indexOf(rname);
        if (idxR === -1) currentR.push(rname); else currentR.splice(idxR, 1);
        panelResourceFilter = (currentR.length === allResNames.length) ? null : currentR;
      }
    }
    renderPanel();
  });

  panelRolesFilterChips.addEventListener('click', function (e) {
    var chip = e.target.closest('.filter-chip');
    if (!chip) return;
    var allRoleNames = uniqueRoles();
    if (chip.dataset.filterAll) {
      panelRolesFilter = null;
    } else if (chip.dataset.filterNone) {
      panelRolesFilter = [];
    } else {
      var roleName = chip.dataset.filterPanelRole;
      var currentRoles = (panelRolesFilter === null) ? allRoleNames.slice() : panelRolesFilter.slice();
      var idxRole = currentRoles.indexOf(roleName);
      if (idxRole === -1) currentRoles.push(roleName); else currentRoles.splice(idxRole, 1);
      panelRolesFilter = (currentRoles.length === allRoleNames.length) ? null : currentRoles;
    }
    renderPanel();
  });

  panelViewToggle.addEventListener('click', function (e) {
    var btn = e.target.closest('.view-toggle-btn');
    if (!btn || btn.dataset.panelView === panelViewMode) return;
    panelViewMode = btn.dataset.panelView;
    renderPanel();
  });

  resourceFilterChips.addEventListener('click', function (e) {
    var chip = e.target.closest('.filter-chip');
    if (!chip) return;
    var allNames = visibleResourceNames();
    if (chip.dataset.filterAll) {
      resourceFilter = null;
    } else if (chip.dataset.filterNone) {
      resourceFilter = [];
    } else {
      var name = chip.dataset.filterResource;
      var current = (resourceFilter === null) ? allNames.slice() : resourceFilter.slice();
      var idx = current.indexOf(name);
      if (idx === -1) current.push(name); else current.splice(idx, 1);
      resourceFilter = (current.length === allNames.length) ? null : current;
    }
    render();
  });

  projectFilterChips.addEventListener('click', function (e) {
    var chip = e.target.closest('.filter-chip');
    if (!chip) return;
    var allNames = visibleProjectGroups().map(function (g) { return g.name; });
    if (chip.dataset.filterAll) {
      projectFilter = null;
    } else if (chip.dataset.filterNone) {
      projectFilter = [];
    } else {
      var name = chip.dataset.filterProject;
      var current = (projectFilter === null) ? allNames.slice() : projectFilter.slice();
      var idx = current.indexOf(name);
      if (idx === -1) current.push(name); else current.splice(idx, 1);
      projectFilter = (current.length === allNames.length) ? null : current;
    }
    render();
  });

  rolesFilterChips.addEventListener('click', function (e) {
    var chip = e.target.closest('.filter-chip');
    if (!chip) return;
    var allNames = uniqueRoles();
    if (chip.dataset.filterAll) {
      rolesFilter = null;
    } else if (chip.dataset.filterNone) {
      rolesFilter = [];
    } else {
      var name = chip.dataset.filterRoles;
      var current = (rolesFilter === null) ? allNames.slice() : rolesFilter.slice();
      var idx = current.indexOf(name);
      if (idx === -1) current.push(name); else current.splice(idx, 1);
      rolesFilter = (current.length === allNames.length) ? null : current;
    }
    render();
  });

  grid.addEventListener('input', function (e) {
    if (!canEdit()) return;
    var el = e.target;
    if (el.dataset && el.dataset.role === 'subgroup-rename') {
      var ids = (el.dataset.ids || '').split(',').map(Number).filter(function (n) { return isFinite(n); });
      ids.forEach(function (id) {
        var rr = resources.find(function (r) { return r.id === id; });
        if (!rr) return;
        if (viewMode === 'resource') rr.project = el.value; else rr.name = el.value;
        var barEl = grid.querySelector('.bar[data-id="' + id + '"]');
        if (barEl) barEl.title = barTitle(rr);
      });
    } else if (el.dataset && el.dataset.role === 'alloc') {
      var r2 = resources.find(function (r) { return r.id === Number(el.dataset.id); });
      if (r2) {
        var v = Number(el.value);
        r2.allocation = isFinite(v) && v >= 0 ? v : 0;
        var bar2 = grid.querySelector('.bar[data-id="' + r2.id + '"]');
        if (bar2) bar2.title = barTitle(r2);
      }
    }
    renderPanel();
    scheduleSave();
  });

  grid.addEventListener('change', function (e) {
    if (!canEdit()) return;
    var el = e.target;
    if (el.dataset && el.dataset.role === 'group-project') {
      var oldName = el.dataset.project;
      var newName = el.value.trim() || (viewMode === 'resource' ? 'Untitled' : 'Untitled Project');
      if (newName !== oldName) {
        resources.forEach(function (r) {
          if (viewMode === 'resource') {
            if (keyForResource(r) === oldName) r.name = newName;
          } else if (r.project === oldName) {
            r.project = newName;
          }
        });
        if (viewMode === 'resource' && Object.prototype.hasOwnProperty.call(resourceRoles, oldName)) {
          resourceRoles[newName] = resourceRoles[oldName];
          delete resourceRoles[oldName];
        }
      }
      render();
      scheduleSave();
    } else if (el.dataset && el.dataset.role === 'subgroup-rename') {
      var ids2 = (el.dataset.ids || '').split(',').map(Number).filter(function (n) { return isFinite(n); });
      var fallback = viewMode === 'resource' ? 'Untitled Project' : 'Untitled';
      var finalVal = el.value.trim() || fallback;
      ids2.forEach(function (id) {
        var rr2 = resources.find(function (r) { return r.id === id; });
        if (!rr2) return;
        if (viewMode === 'resource') rr2.project = finalVal; else rr2.name = finalVal;
      });
      render();
      scheduleSave();
    }
  });

  grid.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      e.target.blur();
    }
  });

  // ---- Drag / resize (whole-week increments) ----
  grid.addEventListener('pointerdown', function (e) {
    if (!canEdit()) return;
    if (e.target.closest('.bar-alloc-input') || e.target.closest('.bar-del-btn')) return;
    var handle = e.target.closest('.handle');
    var barEl = e.target.closest('.bar');
    if (!barEl) return;
    var id = Number(barEl.dataset.id);
    var resource = resources.find(function (r) { return r.id === id; });
    if (!resource) return;

    var mode = handle ? handle.dataset.mode : 'move';
    var startX = e.clientX;
    var dragOffset = viewOffsetWeeks(); // constant for the duration of this drag
    var origStart = resource.start; // anchor-relative (stored)
    var origStartView = origStart - dragOffset; // view-relative (on-screen column)
    var origDuration = resource.duration;
    var origGroupKey = entryGroupKey(resource);
    var hoverGroupKey = origGroupKey;
    var hoveredResourceId = null;
    var hoveredInsertAfter = false;
    var dragGroups = displayGroups();
    var groupIndex = dragGroups.findIndex(function (g) { return g.resources.indexOf(resource) !== -1; });

    e.preventDefault();
    try { barEl.setPointerCapture(e.pointerId); } catch (err) {}
    dragTip.style.display = 'block';

    function setDropHighlight(name) {
      var prev = grid.querySelectorAll('.drop-target');
      for (var i = 0; i < prev.length; i++) prev[i].classList.remove('drop-target');
      if (!name) return;
      var esc = (window.CSS && CSS.escape) ? CSS.escape(name) : name.replace(/"/g, '\\"');
      var matches = grid.querySelectorAll('[data-project="' + esc + '"]');
      for (var j = 0; j < matches.length; j++) matches[j].classList.add('drop-target');
    }

    function setReorderHighlight(targetId, insertAfter) {
      var prev = grid.querySelectorAll('.reorder-target-before, .reorder-target-after');
      for (var i = 0; i < prev.length; i++) prev[i].classList.remove('reorder-target-before', 'reorder-target-after');
      if (!targetId) return;
      var cls = insertAfter ? 'reorder-target-after' : 'reorder-target-before';
      var matches = grid.querySelectorAll('.label-cell[data-id="' + targetId + '"], .track-cell[data-track-for="' + targetId + '"]');
      for (var j = 0; j < matches.length; j++) matches[j].classList.add(cls);
    }

    function applyVisual() {
      var liveClipped = clipRangeToView(resource.start, resource.duration);
      var left = (liveClipped ? liveClipped.start : (resource.start - dragOffset)) * WEEK_WIDTH;
      var width = (liveClipped ? (liveClipped.end - liveClipped.start) : resource.duration) * WEEK_WIDTH;
      barEl.style.left = left + 'px';
      barEl.style.width = width + 'px';
      barEl.classList.toggle('bar-truncated-left', !!(liveClipped && liveClipped.truncatedLeft));

      updateProjectBarVisual();
      renderPanel();

      dragTip.textContent = rangeLabelShortAnchor(resource.start, resource.start + resource.duration) + ' (' + resource.duration + 'w)' +
        (hoverGroupKey !== origGroupKey ? ' → ' + hoverGroupKey : '');
      dragTip.style.left = e.clientX + 'px';
      dragTip.style.top = e.clientY + 'px';
    }

    function updateProjectBarVisual() {
      var group = dragGroups[groupIndex];
      if (!group) return;
      var stillVisible = group.resources.filter(function (r) { return !!clipRangeToView(r.start, r.duration); });
      var ranges = projectRangesFor(stillVisible);
      var esc = (window.CSS && CSS.escape) ? CSS.escape(group.name) : group.name.replace(/"/g, '\\"');
      var groupTrackEl = grid.querySelector('.project-track[data-project="' + esc + '"]');
      if (!groupTrackEl) return;
      var colorSlot = (groupIndex % 8) + 1;
      var isResourceView = viewMode === 'resource';
      var barsHtml = '';
      ranges.forEach(function (seg) {
        var clippedSeg = clipRangeToView(seg.start, seg.end - seg.start);
        if (!clippedSeg) return;
        var runs = isResourceView ? weeklyAllocRunsFor(seg, stillVisible) : [{ start: seg.start, end: seg.end, isLow: false }];
        runs.forEach(function (run) {
          var clippedRange = clipRangeToView(run.start, run.end - run.start);
          if (!clippedRange) return;
          var pLeft = clippedRange.start * WEEK_WIDTH;
          var pWidth = (clippedRange.end - clippedRange.start) * WEEK_WIDTH;
          var pTitle = escapeAttr(group.name + ': ' + rangeLabelShortAnchor(run.start, run.end) + ' (' + (run.end - run.start) + 'w)');
          var pTruncClass = clippedRange.truncatedLeft ? ' bar-truncated-left' : '';
          var pBg = run.isLow ? 'transparent' : 'color-mix(in srgb, var(--series-' + colorSlot + ') 22%, transparent)';
          barsHtml += '<div class="project-bar' + pTruncClass + '" title="' + pTitle + '" style="left:' + pLeft + 'px; width:' + pWidth + 'px; background-image: none; background-color: ' + pBg + '; border-color: var(--series-' + colorSlot + ')"></div>';
        });
      });
      groupTrackEl.innerHTML = barsHtml || ('<div class="project-empty">' + (viewMode === 'resource' ? 'No assignments for this resource yet' : 'No resources in this project yet') + '</div>');
    }

    function onMove(ev) {
      var dx = ev.clientX - startX;
      var dWeeks = Math.round(dx / WEEK_WIDTH);
      if (mode === 'move') {
        // If the bar was already truncated (true start off-screen left), don't let a drag push
        // it further left than that — its real edge isn't visible/grabbable to aim precisely,
        // and a plain click-without-moving must not snap the true start forward to column 0.
        var moveLowerBound = Math.min(0, origStartView);
        var newStartView0 = clamp(origStartView + dWeeks, moveLowerBound, TOTAL_WEEKS - resource.duration);
        resource.start = newStartView0 + dragOffset;

        var overEl = document.elementFromPoint(ev.clientX, ev.clientY);
        var rowEl = overEl ? overEl.closest('[data-project]') : null;
        var overGroupKey = rowEl ? rowEl.dataset.project : null;
        hoverGroupKey = overGroupKey || origGroupKey;
        setDropHighlight(hoverGroupKey !== origGroupKey ? hoverGroupKey : null);

        var overResourceId = rowEl ? Number(rowEl.dataset.id || rowEl.dataset.trackFor) : NaN;
        if (hoverGroupKey === origGroupKey && overResourceId && overResourceId !== resource.id) {
          var rect = rowEl.getBoundingClientRect();
          hoveredResourceId = overResourceId;
          hoveredInsertAfter = ev.clientY > (rect.top + rect.height / 2);
          setReorderHighlight(hoveredResourceId, hoveredInsertAfter);
        } else {
          hoveredResourceId = null;
          setReorderHighlight(null);
        }
      } else if (mode === 'resize-left') {
        var newStartView = clamp(origStartView + dWeeks, 0, origStartView + origDuration - 1);
        resource.duration = origDuration + (origStartView - newStartView);
        resource.start = newStartView + dragOffset;
      } else if (mode === 'resize-right') {
        var newDuration = clamp(origDuration + dWeeks, 1, TOTAL_WEEKS - origStartView);
        resource.duration = newDuration;
      }
      e = ev;
      applyVisual();
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      dragTip.style.display = 'none';
      setDropHighlight(null);
      setReorderHighlight(null);
      if (mode === 'move') {
        if (hoverGroupKey !== origGroupKey) {
          if (viewMode === 'resource') {
            var movedLabel = resource.project || 'assignment';
            resource.name = hoverGroupKey;
            flashStatus('Moved ' + movedLabel + ' to ' + hoverGroupKey);
          } else {
            resource.project = hoverGroupKey;
            flashStatus('Moved ' + (resource.name || 'resource') + ' to ' + hoverGroupKey);
          }
        } else if (hoveredResourceId) {
          reorderResource(resource.id, hoveredResourceId, hoveredInsertAfter);
        }
      }
      render();
      scheduleSave();
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });

  // ---- Label column resize ----
  colResizeHandle.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    var startX = e.clientX;
    var startWidth = LABEL_WIDTH;
    colResizeHandle.classList.add('dragging');
    try { colResizeHandle.setPointerCapture(e.pointerId); } catch (err) {}

    function onMove(ev) {
      LABEL_WIDTH = clamp(startWidth + (ev.clientX - startX), MIN_LABEL_WIDTH, MAX_LABEL_WIDTH);
      colResizeHandle.style.left = LABEL_WIDTH + 'px';
      grid.style.gridTemplateColumns = LABEL_WIDTH + 'px repeat(' + TOTAL_WEEKS + ', ' + WEEK_WIDTH + 'px)';
      var bg = gridBackground();
      grid.style.backgroundImage = bg.backgroundImage;
      grid.style.backgroundSize = bg.backgroundSize;
      grid.style.backgroundPosition = bg.backgroundPosition;
      grid.style.backgroundRepeat = bg.backgroundRepeat;
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      colResizeHandle.classList.remove('dragging');
      try { localStorage.setItem('gantt-label-width', String(LABEL_WIDTH)); } catch (err) {}
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });

  // ---- Import Backup (manual restore from a local JSON file) ----
  function handleImportFile() {
    var file = importFileInput.files[0];
    importFileInput.value = '';
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try {
        data = JSON.parse(reader.result);
      } catch (err) {
        flashStatus('That file isn\'t a valid Gantt backup');
        return;
      }
      if (!applyState(data)) {
        flashStatus('That file isn\'t a valid Gantt backup');
        return;
      }
      render();
      scheduleSave();
      flashStatus('Imported ' + file.name);
    };
    reader.onerror = function () {
      flashStatus('Could not read that file');
    };
    reader.readAsText(file);
  }

  viewToggle.addEventListener('click', function (e) {
    var btn = e.target.closest('.view-toggle-btn');
    if (!btn || btn.dataset.view === viewMode) return;
    viewMode = btn.dataset.view;
    try { localStorage.setItem('gantt-view-mode', viewMode); } catch (err) {}
    render();
  });

  densityToggleBtn.addEventListener('click', function () {
    density = density === 'narrow' ? 'normal' : 'narrow';
    try { localStorage.setItem('gantt-density', density); } catch (err) {}
    render();
  });

  filtersCollapseToggle.addEventListener('click', function () {
    filtersCollapsed = !filtersCollapsed;
    try { localStorage.setItem('gantt-filters-collapsed', filtersCollapsed ? '1' : '0'); } catch (err) {}
    render();
  });

  panelFilterCollapseToggle.addEventListener('click', function () {
    panelFiltersCollapsed = !panelFiltersCollapsed;
    try { localStorage.setItem('gantt-panel-filters-collapsed', panelFiltersCollapsed ? '1' : '0'); } catch (err) {}
    renderPanel();
  });

  panelRolesFilterCollapseToggle.addEventListener('click', function () {
    panelRolesFiltersCollapsed = !panelRolesFiltersCollapsed;
    try { localStorage.setItem('gantt-panel-roles-filters-collapsed', panelRolesFiltersCollapsed ? '1' : '0'); } catch (err) {}
    renderPanel();
  });

  var ZOOM_STEP = 0.1;
  function setZoom(newZoom) {
    zoom = Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom)) * 100) / 100;
    WEEK_WIDTH = BASE_WEEK_WIDTH * zoom;
    try { localStorage.setItem('gantt-zoom', zoom); } catch (err) {}
    render();
  }

  zoomOutBtn.addEventListener('click', function () {
    setZoom(zoom - ZOOM_STEP);
  });

  zoomInBtn.addEventListener('click', function () {
    setZoom(zoom + ZOOM_STEP);
  });

  sortAzBtn.addEventListener('click', function () {
    sortGroupsAlphabetically();
    render();
    scheduleSave();
  });

  sortDateBtn.addEventListener('click', function () {
    sortGroupsByDate();
    render();
    scheduleSave();
  });

  // Changing the start date only pans the visible window — resource start/duration are stored
  // relative to the fixed DATA_EPOCH, so their real dates never move. Bars that finish before
  // the new start are hidden; bars already in progress show only their remaining time (see
  // clipRangeToView), all handled purely at render time.
  timelineStartInput.addEventListener('change', function () {
    var picked = parseIsoDate(timelineStartInput.value);
    if (!picked) { timelineStartInput.value = isoDateString(timelineStartDate); return; }
    timelineStartDate = mondayOnOrBefore(picked);
    render();
    scheduleSave();
  });

  openFileBtn.addEventListener('click', function () { importFileInput.click(); });
  importFileInput.addEventListener('change', handleImportFile);
  gateRetryBtn.addEventListener('click', loadStateFromSupabase);

  // ---- Export ----
  // e.g. "schedule-a-202607241839" for 2026-07-24 18:39.
  function backupFilenameStamp() {
    var d = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return 'schedule-a-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes());
  }

  exportBtn.addEventListener('click', function () {
    var data = {
      version: 3, unit: 'week', timelineStart: isoDateString(timelineStartDate), resources: resources, nextId: nextId,
      rolesCatalog: rolesCatalog, resourceRoles: resourceRoles,
      exportedAt: new Date().toISOString()
    };
    var filename = backupFilenameStamp() + '.json';
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    flashStatus('Exported ' + filename);
  });

  // ---- Export PNG (draws the currently visible chart onto an offscreen canvas) ----
  function cssVar(name) {
    return getComputedStyle(appEl).getPropertyValue(name).trim();
  }

  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var num = parseInt(hex, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function blendHex(hexA, hexB, amountA) {
    var a = hexToRgb(hexA), b = hexToRgb(hexB);
    var r = Math.round(a.r * amountA + b.r * (1 - amountA));
    var g = Math.round(a.g * amountA + b.g * (1 - amountA));
    var bl = Math.round(a.b * amountA + b.b * (1 - amountA));
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function truncateText(ctx, text, maxWidth) {
    text = String(text);
    if (ctx.measureText(text).width <= maxWidth) return text;
    while (text.length > 1 && ctx.measureText(text + '…').width > maxWidth) {
      text = text.slice(0, -1);
    }
    return text + '…';
  }

  // Mirrors render()'s grouping/filtering logic to decide what the export should include.
  function visibleExportRows() {
    var groups = displayGroups();
    var isFiltered = resourceFilter !== null;
    var isProjectFiltered = projectFilter !== null;
    var isRolesFiltered = rolesFilter !== null;
    var rows = [];
    groups.forEach(function (group, gi) {
      var visibleResources = group.resources.filter(function (r) {
        var nameOk = !isFiltered || resourceFilter.indexOf((r.name || 'Untitled').trim() || 'Untitled') !== -1;
        var projOk = !isProjectFiltered || projectFilter.indexOf(r.project || 'Untitled Project') !== -1;
        var roleOk = !isRolesFiltered || rolesFilter.indexOf(roleForResource(r)) !== -1;
        var inView = !!clipRangeToView(r.start, r.duration);
        return nameOk && projOk && roleOk && inView;
      });
      if (!visibleResources.length) return;
      var colorSlot = (gi % 8) + 1;
      var ranges = projectRangesFor(visibleResources);
      var isResourceView = viewMode === 'resource';
      var segRuns = ranges.map(function (seg) {
        return isResourceView ? weeklyAllocRunsFor(seg, visibleResources) : [{ start: seg.start, end: seg.end, isLow: false }];
      });
      rows.push({ type: 'group', name: group.name, ranges: ranges, colorSlot: colorSlot, segRuns: segRuns });
      if (!collapsedGroups[viewMode][group.name]) {
        subGroupEntries(visibleResources).forEach(function (sub) {
          rows.push({ type: 'entry', name: sub.name, entries: sub.entries, colorSlot: colorSlot });
        });
      }
    });
    return rows;
  }

  function renderChartCanvas() {
    var rows = visibleExportRows();
    if (!rows.length) return null;

    var isNarrow = density === 'narrow';
    var MONTH_H = 24, WEEK_H = 30;
    var GROUP_H = isNarrow ? 32 : 46, ENTRY_H = isNarrow ? 34 : 54;
    var headerH = MONTH_H + WEEK_H;
    var bodyH = rows.reduce(function (sum, row) { return sum + (row.type === 'group' ? GROUP_H : ENTRY_H); }, 0);
    var width = LABEL_WIDTH + TOTAL_WEEKS * WEEK_WIDTH;
    var height = headerH + bodyH;
    var scale = 2;

    var canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    var surface = cssVar('--surface-1');
    var textPrimary = cssVar('--text-primary');
    var textSecondary = cssVar('--text-secondary');
    var textMuted = cssVar('--text-muted');
    var gridline = cssVar('--gridline');
    var border = cssVar('--border');
    var today = cssVar('--today-marker');
    var seriesColors = [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return cssVar('--series-' + n); });
    var fontFamily = 'system-ui, -apple-system, "Segoe UI", sans-serif';

    ctx.fillStyle = surface;
    ctx.fillRect(0, 0, width, height);
    ctx.textBaseline = 'middle';

    // Month row
    ctx.font = '600 11px ' + fontFamily;
    var mx = LABEL_WIDTH;
    monthSegments().forEach(function (seg) {
      var segW = seg.count * WEEK_WIDTH;
      ctx.strokeStyle = gridline;
      ctx.beginPath(); ctx.moveTo(mx + 0.5, 0); ctx.lineTo(mx + 0.5, MONTH_H); ctx.stroke();
      ctx.fillStyle = textSecondary;
      ctx.fillText(seg.label, mx + 6, MONTH_H - 8);
      mx += segW;
    });
    ctx.strokeStyle = gridline;
    ctx.beginPath(); ctx.moveTo(0, MONTH_H + 0.5); ctx.lineTo(width, MONTH_H + 0.5); ctx.stroke();

    // Week row: "Timeline" label tinted with the current view's marker color, plus today highlight
    ctx.fillStyle = blendHex(today, surface, 0.18);
    ctx.fillRect(0, MONTH_H, LABEL_WIDTH, WEEK_H);
    ctx.fillStyle = today;
    ctx.font = 'bold 13px ' + fontFamily;
    ctx.fillText('Timeline', 10, MONTH_H + WEEK_H / 2);

    var tIdx = todayWeekIndex();
    ctx.font = '600 11px ' + fontFamily;
    for (var w = 0; w < TOTAL_WEEKS; w++) {
      var wx = LABEL_WIDTH + w * WEEK_WIDTH;
      if (w === tIdx) {
        ctx.fillStyle = blendHex(today, surface, 0.14);
        ctx.fillRect(wx, MONTH_H, WEEK_WIDTH, WEEK_H);
      }
      ctx.strokeStyle = gridline;
      ctx.beginPath(); ctx.moveTo(wx + 0.5, MONTH_H); ctx.lineTo(wx + 0.5, MONTH_H + WEEK_H); ctx.stroke();
      ctx.fillStyle = (w === tIdx) ? today : textSecondary;
      ctx.fillText(weekCellLabel(w), wx + 6, MONTH_H + WEEK_H / 2);
    }
    ctx.strokeStyle = gridline;
    ctx.beginPath(); ctx.moveTo(0, headerH + 0.5); ctx.lineTo(width, headerH + 0.5); ctx.stroke();

    // Rows
    var y = headerH;
    rows.forEach(function (row) {
      var h = row.type === 'group' ? GROUP_H : ENTRY_H;
      var color = seriesColors[(row.colorSlot - 1) % 8];

      if (row.type === 'group') {
        ctx.font = '600 13px ' + fontFamily;
        ctx.fillStyle = color;
        ctx.fillText(truncateText(ctx, row.name, LABEL_WIDTH - 24), 12, y + h / 2);
      } else {
        ctx.font = '13px ' + fontFamily;
        ctx.fillStyle = textPrimary;
        ctx.fillText(truncateText(ctx, row.name, LABEL_WIDTH - 24), 12, y + h / 2);
      }

      ctx.strokeStyle = border;
      ctx.beginPath(); ctx.moveTo(LABEL_WIDTH + 0.5, y); ctx.lineTo(LABEL_WIDTH + 0.5, y + h); ctx.stroke();

      ctx.strokeStyle = gridline;
      for (var wcol = 0; wcol <= TOTAL_WEEKS; wcol++) {
        var gx = LABEL_WIDTH + wcol * WEEK_WIDTH;
        ctx.beginPath(); ctx.moveTo(gx + 0.5, y); ctx.lineTo(gx + 0.5, y + h); ctx.stroke();
      }

      if (row.type === 'group') {
        row.segRuns.forEach(function (runs) {
          runs.forEach(function (run) {
            var gClipped = clipRangeToView(run.start, run.end - run.start);
            if (!gClipped) return;
            var gx0 = LABEL_WIDTH + gClipped.start * WEEK_WIDTH;
            var gw = (gClipped.end - gClipped.start) * WEEK_WIDTH;
            ctx.strokeStyle = color;
            roundRectPath(ctx, gx0 + 2, y + h / 2 - 10, Math.max(gw - 4, 1), 20, 6);
            if (!run.isLow) { ctx.fillStyle = blendHex(color, surface, 0.28); ctx.fill(); }
            ctx.stroke();
          });
        });
      } else {
        row.entries.forEach(function (r) {
          var rClipped = clipRangeToView(r.start, r.duration);
          if (!rClipped) return;
          var bx = LABEL_WIDTH + rClipped.start * WEEK_WIDTH;
          var bw = (rClipped.end - rClipped.start) * WEEK_WIDTH;
          ctx.fillStyle = color;
          roundRectPath(ctx, bx + 3, y + h / 2 - 13, Math.max(bw - 6, 1), 26, 6);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 11px ' + fontFamily;
          ctx.textAlign = 'left';
          ctx.fillText(r.allocation + '%', bx + 11, y + h / 2);
        });
      }

      ctx.strokeStyle = gridline;
      ctx.beginPath(); ctx.moveTo(0, y + h + 0.5); ctx.lineTo(width, y + h + 0.5); ctx.stroke();

      y += h;
    });

    ctx.strokeStyle = border;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    return canvas;
  }

  function downloadDataUrl(dataUrl, filename) {
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  exportPngBtn.addEventListener('click', function () {
    var canvas = renderChartCanvas();
    if (!canvas) { flashStatus('Nothing to export yet'); return; }
    downloadDataUrl(canvas.toDataURL('image/png'), 'gantt-chart.png');
    flashStatus('Exported gantt-chart.png');
  });

  // ---- Export PDF (uses the browser's native print-to-PDF via a print stylesheet) ----
  exportPdfBtn.addEventListener('click', function () {
    var ganttCardEl = document.querySelector('.gantt-card');
    var contentWidth = LABEL_WIDTH + TOTAL_WEEKS * WEEK_WIDTH;
    var printableWidthPx = 1050; // approx landscape page width minus margins at 96dpi
    var zoomLevel = Math.min(1, printableWidthPx / contentWidth);
    ganttCardEl.style.zoom = zoomLevel;
    function resetZoom() {
      ganttCardEl.style.zoom = '';
      window.removeEventListener('afterprint', resetZoom);
    }
    window.addEventListener('afterprint', resetZoom);
    window.print();
  });

  // ---- Init ----
  function init() {
    loadStateFromSupabase();
    refreshProjectsCatalog();
  }

  window.onAuthReady(init);
})();
