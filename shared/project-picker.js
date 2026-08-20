/*
 * Shared "find or create project" picker, used by intake and roadmap when
 * a new card/task needs to be linked to the canonical public.projects
 * registry (see supabase/migrations/20260819155600_create_projects_registry.sql
 * and 20260819160045_add_project_id_links.sql).
 *
 * Reuses window.sbClient, which every app's auth-gate.js already sets up
 * after sign-in, so callers don't need to pass Supabase credentials.
 *
 * Usage:
 *   ProjectPicker.open({ originApp: 'intake', query: card.projectTitle })
 *     .then(function (project) {
 *       // project is { id, canonical_name } or null if the user cancelled
 *     });
 *
 * Pass excludeFinished: true to hide delivered/rejected projects from the
 * visible suggestion list (roadmap uses this — intake, where those
 * statuses get set, still shows everything). The exact-match check that
 * decides whether to offer "Create new project" always looks at the full,
 * unfiltered set, so typing a finished project's exact name can't create
 * an accidental duplicate — it just won't show as a clickable suggestion.
 * schedule-a doesn't use this component (it has its own inline datalist
 * typeahead) but applies the same filtering principle independently.
 */
(function () {
  'use strict';

  var STYLE_ID = 'project-picker-styles';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.pp-overlay{position:fixed;inset:0;background:rgba(20,21,32,0.45);' +
      'display:flex;align-items:flex-start;justify-content:center;' +
      'padding-top:12vh;z-index:10000;}' +
      '.pp-dialog{background:#fff;border-radius:10px;width:420px;max-width:92vw;' +
      'box-shadow:0 20px 60px rgba(20,21,32,0.35);padding:16px;' +
      'font-family:"Segoe UI",Arial,sans-serif;}' +
      '.pp-head{display:flex;align-items:center;justify-content:space-between;' +
      'margin-bottom:10px;}' +
      '.pp-head h3{margin:0;font-size:15px;color:#1c1d2e;}' +
      '.pp-close{border:none;background:none;font-size:20px;line-height:1;' +
      'cursor:pointer;color:#55576e;padding:2px 6px;}' +
      '.pp-close:hover{color:#1c1d2e;}' +
      '.pp-search{width:100%;box-sizing:border-box;padding:8px 10px;' +
      'border:1px solid #d9dae8;border-radius:6px;font-size:14px;margin-bottom:8px;}' +
      '.pp-search:focus{outline:2px solid #4b3fae;outline-offset:1px;}' +
      '.pp-results{max-height:220px;overflow-y:auto;display:flex;' +
      'flex-direction:column;gap:2px;}' +
      '.pp-result{display:block;width:100%;text-align:left;padding:8px 10px;' +
      'border:none;background:none;border-radius:6px;font-size:14px;' +
      'color:#1c1d2e;cursor:pointer;}' +
      '.pp-result:hover{background:#efedfb;}' +
      '.pp-empty{padding:8px 2px;font-size:13px;color:#55576e;}' +
      '.pp-create-row{margin-top:6px;border-top:1px solid #eee;padding-top:8px;}' +
      '.pp-create{width:100%;box-sizing:border-box;padding:8px 10px;' +
      'border:1px dashed #4b3fae;border-radius:6px;background:#fff;' +
      'color:#4b3fae;font-size:14px;cursor:pointer;text-align:left;}' +
      '.pp-create:hover{background:#efedfb;}';
    document.head.appendChild(style);
  }

  function debounce(fn, wait) {
    var timer;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  function escapeLike(s) {
    return s.replace(/[%_\\]/g, '\\$&');
  }

  function open(options) {
    options = options || {};
    var originApp = options.originApp;
    var initialQuery = options.query || '';
    var excludeFinished = !!options.excludeFinished;
    var sb = window.sbClient;

    return new Promise(function (resolve) {
      if (!sb) {
        console.error('ProjectPicker.open: window.sbClient is not set (auth-gate.js should set it after sign-in).');
        resolve(null);
        return;
      }

      ensureStyles();

      var overlay = document.createElement('div');
      overlay.className = 'pp-overlay';

      var dialog = document.createElement('div');
      dialog.className = 'pp-dialog';
      dialog.innerHTML =
        '<div class="pp-head"><h3>Link to project</h3>' +
        '<button type="button" class="pp-close" aria-label="Close">×</button></div>' +
        '<input type="text" class="pp-search" placeholder="Search projects…" autocomplete="off" />' +
        '<div class="pp-results" role="listbox"></div>' +
        '<div class="pp-create-row"></div>';

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      var searchInput = dialog.querySelector('.pp-search');
      var resultsEl = dialog.querySelector('.pp-results');
      var createRowEl = dialog.querySelector('.pp-create-row');
      var closeBtn = dialog.querySelector('.pp-close');

      var settled = false;
      function finish(project) {
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', onKeydown);
        overlay.remove();
        resolve(project || null);
      }

      function onKeydown(e) {
        if (e.key === 'Escape') finish(null);
      }
      document.addEventListener('keydown', onKeydown);

      overlay.addEventListener('mousedown', function (e) {
        if (e.target === overlay) finish(null);
      });
      closeBtn.addEventListener('click', function () { finish(null); });

      function renderResults(projects, query) {
        var visible = excludeFinished
          ? projects.filter(function (p) { return p.status !== 'delivered' && p.status !== 'rejected'; })
          : projects;

        resultsEl.innerHTML = '';
        if (!visible.length) {
          var empty = document.createElement('div');
          empty.className = 'pp-empty';
          empty.textContent = query.trim() ? 'No matching projects.' : 'Type to search existing projects.';
          resultsEl.appendChild(empty);
        } else {
          visible.forEach(function (p) {
            var row = document.createElement('button');
            row.type = 'button';
            row.className = 'pp-result';
            row.textContent = p.canonical_name;
            row.addEventListener('click', function () { finish(p); });
            resultsEl.appendChild(row);
          });
        }

        createRowEl.innerHTML = '';
        var trimmed = query.trim();
        if (!trimmed) return;
        // Checked against the full (unfiltered) set, not `visible` — so a
        // name collision with a hidden finished project still suppresses
        // "Create new" instead of letting a duplicate get created.
        var exact = projects.some(function (p) {
          return p.canonical_name.toLowerCase() === trimmed.toLowerCase();
        });
        if (exact) return;

        var createBtn = document.createElement('button');
        createBtn.type = 'button';
        createBtn.className = 'pp-create';
        createBtn.textContent = 'Create new project: “' + trimmed + '”';
        createBtn.addEventListener('click', function () { createProject(trimmed); });
        createRowEl.appendChild(createBtn);
      }

      var searchToken = 0;
      function search(query) {
        var trimmed = query.trim();
        if (!trimmed) {
          renderResults([], '');
          return;
        }
        var token = ++searchToken;
        sb.from('projects')
          .select('id, canonical_name, status')
          .ilike('canonical_name', '%' + escapeLike(trimmed) + '%')
          .order('canonical_name')
          .limit(20)
          .then(function (res) {
            if (token !== searchToken) return; // a newer keystroke superseded this request
            if (res.error) {
              resultsEl.innerHTML = '';
              var err = document.createElement('div');
              err.className = 'pp-empty';
              err.textContent = 'Search failed: ' + res.error.message;
              resultsEl.appendChild(err);
              return;
            }
            renderResults(res.data || [], query);
          });
      }

      function createProject(name) {
        createRowEl.innerHTML = '<span class="pp-empty">Creating…</span>';
        sb.from('projects')
          .insert({ canonical_name: name, origin_app: originApp })
          .select('id, canonical_name')
          .single()
          .then(function (res) {
            if (res.error) {
              createRowEl.innerHTML = '';
              var err = document.createElement('div');
              err.className = 'pp-empty';
              err.textContent = 'Couldn’t create project: ' + res.error.message;
              createRowEl.appendChild(err);
              return;
            }
            finish(res.data);
          });
      }

      searchInput.addEventListener('input', debounce(function () {
        search(searchInput.value);
      }, 200));

      searchInput.value = initialQuery;
      search(initialQuery);
      setTimeout(function () {
        searchInput.focus();
        searchInput.select();
      }, 0);
    });
  }

  window.ProjectPicker = { open: open };
})();
