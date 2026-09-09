/*
 * Shared comment panel for a public.projects row, backed by
 * public.project_comments (see
 * supabase/migrations/20260909120000_create_project_comments.sql).
 * Meant to be embedded inline (a panel/tab in a project's detail view),
 * not a modal like ProjectPicker — mount() renders in place and stays
 * live in the container you give it.
 *
 * Reuses window.sbClient, same as ProjectPicker.
 *
 * Usage:
 *   ProjectComments.mount(document.getElementById('comments-slot'), {
 *     projectId: project.id,
 *     sourceApp: 'intake'   // 'intake' | 'roadmap-db' | 'schedule-a-db-v2'
 *   });
 *
 * sourceApp is the project_key this app comments under — it's checked
 * server-side (has_project_access(source_app, 'editor')) on every insert,
 * so passing a key the signed-in user isn't an editor of just makes the
 * "Post" button fail with a permissions error, not a spoofed source_app.
 * Pass canPost: false to render a read-only feed (e.g. from project-list,
 * which has viewer-only access via roadmap-db).
 *
 * Each comment renders only its category and date — no author or source
 * app, by design (requested directly; keep it that way rather than
 * re-adding attribution later without checking first).
 */
(function () {
  'use strict';

  var STYLE_ID = 'project-comments-styles';

  var CATEGORIES = [
    { value: '', label: 'No category' },
    { value: 'general', label: 'General' },
    { value: 'decision', label: 'Decision' },
    { value: 'status', label: 'Status' }
  ];

  var CATEGORY_LABELS = CATEGORIES.reduce(function (map, c) {
    if (c.value) map[c.value] = c.label;
    return map;
  }, {});

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.pc-panel{font-family:"Segoe UI",Arial,sans-serif;font-size:14px;color:#1c1d2e;}' +
      '.pc-list{display:flex;flex-direction:column;gap:10px;margin-bottom:12px;' +
      'max-height:320px;overflow-y:auto;}' +
      '.pc-empty{color:#55576e;font-size:13px;padding:4px 0;}' +
      '.pc-item{border:1px solid #eceafa;border-radius:8px;padding:8px 10px;}' +
      '.pc-item-head{display:flex;align-items:center;gap:6px;margin-bottom:4px;' +
      'font-size:12px;color:#55576e;}' +
      '.pc-tag{display:inline-block;padding:1px 7px;border-radius:10px;' +
      'background:#efedfb;color:#4b3fae;font-size:11px;font-weight:600;}' +
      '.pc-tag-blocker{background:#fdecec;color:#b3261e;}' +
      '.pc-tag-decision{background:#e8f5ec;color:#1e7a3d;}' +
      '.pc-tag-status{background:#fbf1d9;color:#8a6116;}' +
      '.pc-body{white-space:pre-wrap;word-break:break-word;}' +
      '.pc-form{display:flex;flex-direction:column;gap:6px;}' +
      '.pc-textarea{width:100%;box-sizing:border-box;padding:8px 10px;' +
      'border:1px solid #d9dae8;border-radius:6px;font-size:14px;' +
      'font-family:inherit;resize:vertical;min-height:56px;}' +
      '.pc-textarea:focus{outline:2px solid #4b3fae;outline-offset:1px;}' +
      '.pc-form-row{display:flex;gap:8px;align-items:center;}' +
      '.pc-select{padding:6px 8px;border:1px solid #d9dae8;border-radius:6px;' +
      'font-size:13px;background:#fff;}' +
      '.pc-post{margin-left:auto;padding:7px 16px;border:none;border-radius:6px;' +
      'background:#4b3fae;color:#fff;font-size:14px;cursor:pointer;}' +
      '.pc-post:disabled{background:#c7c3e8;cursor:default;}' +
      '.pc-post:not(:disabled):hover{background:#3d3390;}' +
      '.pc-error{color:#b3261e;font-size:12px;}';
    document.head.appendChild(style);
  }

  function tagClass(category) {
    return category === 'blocker' ? ' pc-tag-' + category
      : category === 'decision' ? ' pc-tag-decision'
      : category === 'status' ? ' pc-tag-status'
      : '';
  }

  function formatDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function renderList(listEl, comments) {
    listEl.innerHTML = '';
    if (!comments.length) {
      var empty = document.createElement('div');
      empty.className = 'pc-empty';
      empty.textContent = 'No comments yet.';
      listEl.appendChild(empty);
      return;
    }
    comments.forEach(function (c) {
      var item = document.createElement('div');
      item.className = 'pc-item';

      var head = document.createElement('div');
      head.className = 'pc-item-head';

      if (c.category) {
        var tag = document.createElement('span');
        tag.className = 'pc-tag' + tagClass(c.category);
        tag.textContent = CATEGORY_LABELS[c.category] || c.category;
        head.appendChild(tag);
      }

      var when = document.createElement('span');
      when.textContent = formatDate(c.created_at);
      head.appendChild(when);

      var body = document.createElement('div');
      body.className = 'pc-body';
      body.textContent = c.body;

      item.appendChild(head);
      item.appendChild(body);
      listEl.appendChild(item);
    });
  }

  function mount(container, options) {
    options = options || {};
    var projectId = options.projectId;
    var sourceApp = options.sourceApp;
    var canPost = options.canPost !== false;
    var sb = window.sbClient;

    if (!sb) {
      console.error('ProjectComments.mount: window.sbClient is not set (auth-gate.js should set it after sign-in).');
      return;
    }
    if (!projectId) {
      console.error('ProjectComments.mount: options.projectId is required.');
      return;
    }
    if (canPost && !sourceApp) {
      console.error('ProjectComments.mount: options.sourceApp is required when canPost is true.');
      return;
    }

    ensureStyles();

    var panel = document.createElement('div');
    panel.className = 'pc-panel';

    var listEl = document.createElement('div');
    listEl.className = 'pc-list';
    panel.appendChild(listEl);

    var currentUserId = null;

    var formEl = null;
    var textarea = null;
    var select = null;
    var postBtn = null;
    var errorEl = null;

    if (canPost) {
      formEl = document.createElement('div');
      formEl.className = 'pc-form';

      textarea = document.createElement('textarea');
      textarea.className = 'pc-textarea';
      textarea.placeholder = 'Add a comment…';

      var row = document.createElement('div');
      row.className = 'pc-form-row';

      select = document.createElement('select');
      select.className = 'pc-select';
      CATEGORIES.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c.value;
        opt.textContent = c.label;
        select.appendChild(opt);
      });

      postBtn = document.createElement('button');
      postBtn.type = 'button';
      postBtn.className = 'pc-post';
      postBtn.textContent = 'Post';
      postBtn.disabled = true;

      errorEl = document.createElement('div');
      errorEl.className = 'pc-error';

      row.appendChild(select);
      row.appendChild(postBtn);

      formEl.appendChild(textarea);
      formEl.appendChild(row);
      formEl.appendChild(errorEl);
      panel.appendChild(formEl);

      textarea.addEventListener('input', function () {
        postBtn.disabled = !textarea.value.trim();
      });

      postBtn.addEventListener('click', function () {
        var body = textarea.value.trim();
        if (!body) return;
        postBtn.disabled = true;
        errorEl.textContent = '';
        sb.from('project_comments')
          .insert({
            project_id: projectId,
            body: body,
            category: select.value || null,
            source_app: sourceApp,
            created_by: currentUserId
          })
          .then(function (res) {
            if (res.error) {
              errorEl.textContent = 'Couldn’t post: ' + res.error.message;
              postBtn.disabled = false;
              return;
            }
            textarea.value = '';
            load();
          });
      });
    }

    container.innerHTML = '';
    container.appendChild(panel);

    function load() {
      sb.from('project_comments')
        .select('id, body, category, source_app, created_by, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .then(function (res) {
          if (res.error) {
            listEl.innerHTML = '';
            var err = document.createElement('div');
            err.className = 'pc-empty';
            err.textContent = 'Couldn’t load comments: ' + res.error.message;
            listEl.appendChild(err);
            return;
          }
          renderList(listEl, res.data || []);
        });
    }

    sb.auth.getUser().then(function (res) {
      currentUserId = res.data && res.data.user ? res.data.user.id : null;
      load();
    });
  }

  window.ProjectComments = { mount: mount };
})();
