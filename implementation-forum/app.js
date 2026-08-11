const VALID_TYPES = ['Release', 'Delivery', 'Digital', 'Data', 'Cyber', 'Operations', 'D365', 'Delayed'];
const TYPE_COLORS = {
  Release: { highlight: '#4fce65', background: 'var(--card-bg)' },
  Delivery: { highlight: '#5b8cff', background: 'var(--card-bg)' },
  Digital: { highlight: '#dc60c3', background: 'var(--card-bg)' },
  Data: { highlight: '#ffd505', background: 'var(--card-bg)' },
  Cyber: { highlight: '#ff8b3e', background: 'var(--card-bg)' },
  Operations: { highlight: '#ff4853', background: 'var(--card-bg)' },
  D365: { highlight: '#9aa0a6', background: 'var(--card-bg)' },
  Delayed: { highlight: '#ffffff', background: 'rgba(255, 0, 0, 0.1)' },
};
const VALID_SPRINTS = [0, 1];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const sb = window.sbClient;
function canEdit() { return window.currentAccess && window.currentAccess['implementation-forum'] === 'editor'; }

let tasks = [];
let sprints = [];
let draggedCardId = null;

// ---- Supabase row <-> task mapping ----

function rowToTask(row) {
  return {
    id: row.id,
    sprint: row.sprint,
    title: row.title,
    type: row.type,
    isNew: row.is_new,
    isChanged: row.is_changed,
  };
}

// ---- Supabase row <-> sprint mapping ----

function parseIsoDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function rowToSprint(row) {
  return { id: row.id, sprint: row.sprint, name: row.name, date: parseIsoDate(row.start_date) };
}

function toIsoDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function taskToRow({ sprint, title, type, isNew, isChanged }) {
  return { sprint, title, type, is_new: isNew, is_changed: isChanged };
}

// ---- CSV export (manual backup only) ----

function escapeCsvField(value) {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function tasksToCsv(list) {
  const lines = ['id,sprint,title,type,isNew,isChanged'];
  for (const t of list) {
    lines.push(
      [
        t.id,
        t.sprint,
        escapeCsvField(t.title),
        escapeCsvField(t.type),
        t.isNew ? '1' : '0',
        t.isChanged ? '1' : '0',
      ].join(',')
    );
  }
  return lines.join('\n') + '\n';
}

// ---- validation ----

function validateTask({ title, type, sprint }) {
  const errors = [];
  if (typeof title !== 'string' || title.trim().length === 0) errors.push('title is required');
  if (!VALID_TYPES.includes(type)) errors.push(`type must be one of: ${VALID_TYPES.join(', ')}`);
  if (!VALID_SPRINTS.includes(Number(sprint))) errors.push('sprint must be 0 (Next) or 1 (Next+1)');
  return errors;
}

// ---- DOM references ----

const cardLists = {
  0: document.querySelector('.card-list[data-sprint="0"]'),
  1: document.querySelector('.card-list[data-sprint="1"]'),
};

const dataStatus = document.getElementById('data-status');
const exportBtn = document.getElementById('export-btn');
const exportPngBtn = document.getElementById('export-png-btn');
const nextForumBtn = document.getElementById('next-forum-btn');
const addTaskBtn = document.getElementById('add-task-btn');

const modalBackdrop = document.getElementById('modal-backdrop');
const taskForm = document.getElementById('task-form');
const modalTitle = document.getElementById('modal-title');
const taskIdInput = document.getElementById('task-id');
const taskTitleInput = document.getElementById('task-title');
const taskTypeSelect = document.getElementById('task-type');
const taskSprintSelect = document.getElementById('task-sprint');
const taskNewInput = document.getElementById('task-new');
const taskChangedInput = document.getElementById('task-changed');
const deleteBtn = document.getElementById('delete-task-btn');

taskTypeSelect.innerHTML = VALID_TYPES.map((t) => `<option value="${t}">${t}</option>`).join('');

function setDataStatus(text) {
  dataStatus.textContent = text;
}

// ---- load from Supabase ----

async function loadTasks() {
  setDataStatus('Loading…');
  const { data, error } = await sb.from('tasks').select('*').order('id');
  if (error) {
    console.error(error);
    setDataStatus('Failed to load tasks');
    return;
  }
  tasks = data.map(rowToTask);
  setDataStatus(`Connected (${tasks.length} tasks)`);
  addTaskBtn.disabled = !canEdit();
  if (nextForumBtn) nextForumBtn.disabled = !canEdit();
  render();
}

// ---- CSV backup download ----

exportBtn.addEventListener('click', () => {
  const blob = new Blob([tasksToCsv(tasks)], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tasks.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// ---- sprint dates ----

function formatSprintDate(date) {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

async function loadSprints() {
  const { data, error } = await sb.from('sprints').select('*').order('start_date');
  if (error) {
    console.error(error);
    return;
  }
  sprints = data.map(rowToSprint);
  if (editSprintsBtn) editSprintsBtn.disabled = !canEdit();
  updateColumnTitles();
}

function updateColumnTitles() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = sprints.filter((s) => s.date >= today).sort((a, b) => a.date - b.date);

  const nextTitle = document.getElementById('column-title-0');
  const nextPlusOneTitle = document.getElementById('column-title-1');
  if (upcoming[0]) nextTitle.textContent = `Next (Sprint ${upcoming[0].sprint}, ${formatSprintDate(upcoming[0].date)})`;
  if (upcoming[1]) nextPlusOneTitle.textContent = `Next+1 (Sprint ${upcoming[1].sprint}, ${formatSprintDate(upcoming[1].date)})`;
}

// ---- sprint editor (admin) ----

// These elements only exist on admin.html; index.html omits sprint editing entirely.
const editSprintsBtn = document.getElementById('edit-sprints-btn');
const sprintsModalBackdrop = document.getElementById('sprints-modal-backdrop');
const sprintsListEl = document.getElementById('sprints-list');
const addSprintBtn = document.getElementById('add-sprint-btn');
const sprintsCloseBtn = document.getElementById('sprints-close-btn');

function renderSprintsList() {
  sprintsListEl.innerHTML = '';
  const sorted = [...sprints].sort((a, b) => a.date - b.date);
  for (const s of sorted) {
    sprintsListEl.appendChild(renderSprintRow(s));
  }
}

function renderSprintRow(s) {
  const row = document.createElement('div');
  row.className = 'sprint-row';

  const numberInput = document.createElement('input');
  numberInput.type = 'number';
  numberInput.value = s.sprint;
  numberInput.addEventListener('change', () => saveSprintField(s.id, 'sprint', Number(numberInput.value)));

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = s.name;
  nameInput.addEventListener('change', () => saveSprintField(s.id, 'name', nameInput.value));

  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.value = toIsoDateString(s.date);
  dateInput.addEventListener('change', () => saveSprintField(s.id, 'start_date', dateInput.value));

  const rowDeleteBtn = document.createElement('button');
  rowDeleteBtn.type = 'button';
  rowDeleteBtn.className = 'btn btn-danger';
  rowDeleteBtn.textContent = 'Delete';
  rowDeleteBtn.addEventListener('click', () => deleteSprint(s.id));

  row.appendChild(numberInput);
  row.appendChild(nameInput);
  row.appendChild(dateInput);
  row.appendChild(rowDeleteBtn);
  return row;
}

async function saveSprintField(id, field, value) {
  const patch = { [field]: value };
  const { error } = await sb.from('sprints').update(patch).eq('id', id);
  if (error) {
    console.error(error);
    alert('Failed to update sprint.');
    renderSprintsList();
    return;
  }
  const s = sprints.find((sp) => sp.id === id);
  if (s) {
    if (field === 'start_date') s.date = parseIsoDate(value);
    else s[field] = value;
  }
  updateColumnTitles();
}

async function deleteSprint(id) {
  const { error } = await sb.from('sprints').delete().eq('id', id);
  if (error) {
    console.error(error);
    alert('Failed to delete sprint.');
    return;
  }
  sprints = sprints.filter((s) => s.id !== id);
  renderSprintsList();
  updateColumnTitles();
}

async function addSprint() {
  const maxSprint = sprints.reduce((max, s) => Math.max(max, s.sprint), 0);
  const latest = [...sprints].sort((a, b) => b.date - a.date)[0];
  const nextDate = latest
    ? new Date(latest.date.getFullYear(), latest.date.getMonth(), latest.date.getDate() + 14)
    : new Date();
  const nextNumber = maxSprint + 1;

  const { data, error } = await sb
    .from('sprints')
    .insert({ sprint: nextNumber, name: `Sprint ${nextNumber}`, start_date: toIsoDateString(nextDate) })
    .select()
    .single();
  if (error) {
    console.error(error);
    alert('Failed to add sprint.');
    return;
  }
  sprints.push(rowToSprint(data));
  renderSprintsList();
  updateColumnTitles();
}

if (editSprintsBtn) {
  editSprintsBtn.addEventListener('click', () => {
    if (!canEdit()) return;
    renderSprintsList();
    sprintsModalBackdrop.classList.remove('hidden');
  });

  sprintsCloseBtn.addEventListener('click', () => sprintsModalBackdrop.classList.add('hidden'));

  sprintsModalBackdrop.addEventListener('click', (e) => {
    if (e.target === sprintsModalBackdrop) sprintsModalBackdrop.classList.add('hidden');
  });

  addSprintBtn.addEventListener('click', addSprint);
}

// ---- rendering ----

function render() {
  cardLists[0].innerHTML = '';
  cardLists[1].innerHTML = '';

  const bySprint = { 0: [], 1: [] };
  for (const task of tasks) {
    if (bySprint[task.sprint]) bySprint[task.sprint].push(task);
  }

  for (const sprint of [0, 1]) {
    const list = cardLists[sprint];
    if (bySprint[sprint].length === 0) {
      const hint = document.createElement('div');
      hint.className = 'empty-hint';
      hint.textContent = 'No tasks';
      list.appendChild(hint);
      continue;
    }

    for (const type of VALID_TYPES) {
      const group = bySprint[sprint]
        .filter((t) => t.type === type)
        .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
      if (group.length === 0) continue;

      const header = document.createElement('div');
      header.className = 'group-header';
      header.style.setProperty('--type-color', TYPE_COLORS[type].highlight);

      const dot = document.createElement('span');
      dot.className = 'group-header-dot';

      header.appendChild(dot);
      header.appendChild(document.createTextNode(type));
      list.appendChild(header);

      for (const task of group) {
        list.appendChild(renderCard(task));
      }
    }
  }
}

function renderCard(task) {
  const card = document.createElement('div');
  card.className = 'card';
  card.draggable = canEdit();
  card.dataset.id = task.id;
  card.style.setProperty('--type-color', TYPE_COLORS[task.type].highlight);
  card.style.setProperty('--type-bg', TYPE_COLORS[task.type].background);

  const titleRow = document.createElement('div');
  titleRow.className = 'card-title-row';

  const title = document.createElement('p');
  title.className = 'card-title';
  title.textContent = task.title;
  titleRow.appendChild(title);

  if (task.isNew || task.isChanged) {
    const badges = document.createElement('span');
    badges.className = 'card-badges';

    if (task.isNew) {
      const badge = document.createElement('span');
      badge.className = 'badge-icon badge-new';
      badge.textContent = '★';
      badge.title = 'New';
      badges.appendChild(badge);
    }

    if (task.isChanged) {
      const badge = document.createElement('span');
      badge.className = 'badge-icon badge-changed';
      badge.textContent = '→';
      badge.title = 'Changed';
      badges.appendChild(badge);
    }

    titleRow.appendChild(badges);
  }

  card.appendChild(titleRow);

  card.addEventListener('click', () => { if (canEdit()) openEditModal(task); });

  card.addEventListener('dragstart', () => {
    draggedCardId = task.id;
    card.classList.add('dragging');
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    draggedCardId = null;
  });

  return card;
}

for (const sprint of [0, 1]) {
  const list = cardLists[sprint];

  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    list.classList.add('drag-over');
  });

  list.addEventListener('dragleave', () => {
    list.classList.remove('drag-over');
  });

  list.addEventListener('drop', async (e) => {
    e.preventDefault();
    list.classList.remove('drag-over');
    if (!canEdit()) return;
    if (draggedCardId === null) return;
    const task = tasks.find((t) => t.id === draggedCardId);
    if (!task) return;

    const { error } = await sb.from('tasks').update({ sprint }).eq('id', task.id);
    if (error) {
      console.error(error);
      alert('Failed to move task.');
      return;
    }
    task.sprint = sprint;
    render();
  });
}

// ---- PNG export ----

function copyComputedStyle(source, target) {
  const computed = getComputedStyle(source);
  let cssText = '';
  for (let i = 0; i < computed.length; i++) {
    const prop = computed[i];
    cssText += `${prop}:${computed.getPropertyValue(prop)};`;
  }
  target.style.cssText = cssText;
}

function cloneWithComputedStyles(node) {
  const clone = node.cloneNode(false);
  if (node.nodeType === Node.ELEMENT_NODE) {
    copyComputedStyle(node, clone);
  }
  for (const child of node.childNodes) {
    clone.appendChild(cloneWithComputedStyles(child));
  }
  return clone;
}

async function exportBoardAsPng() {
  const board = document.getElementById('board');
  const rect = board.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  const bg = getComputedStyle(document.body).backgroundColor;

  const clonedBoard = cloneWithComputedStyles(board);
  clonedBoard.style.margin = '0';

  const svgMarkup =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;background:${bg};">` +
    clonedBoard.outerHTML +
    `</div></foreignObject></svg>`;

  const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgMarkup);

  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Failed to rasterize board'));
      img.src = svgDataUrl;
    });

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = bg || '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    canvas.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'kanban-board.png';
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  } catch (err) {
    console.error(err);
    alert('Could not export board to PNG.');
  }
}

exportPngBtn.addEventListener('click', exportBoardAsPng);

// ---- next forum ----

const nextForumConfirmBackdrop = document.getElementById('next-forum-confirm-backdrop');
const nextForumNoBtn = document.getElementById('next-forum-no-btn');
const nextForumYesBtn = document.getElementById('next-forum-yes-btn');

// These elements only exist on admin.html; index.html omits the Next Forum feature entirely.
if (nextForumBtn) {
  nextForumBtn.addEventListener('click', () => {
    nextForumConfirmBackdrop.classList.remove('hidden');
  });

  nextForumNoBtn.addEventListener('click', () => {
    nextForumConfirmBackdrop.classList.add('hidden');
  });

  nextForumConfirmBackdrop.addEventListener('click', (e) => {
    if (e.target === nextForumConfirmBackdrop) nextForumConfirmBackdrop.classList.add('hidden');
  });

  nextForumYesBtn.addEventListener('click', async () => {
    nextForumConfirmBackdrop.classList.add('hidden');
    if (!canEdit()) return;

    const { data: freshRows, error: fetchErr } = await sb.from('tasks').select('*');
    if (fetchErr) {
      console.error(fetchErr);
      alert('Failed to load tasks.');
      return;
    }
    const fresh = freshRows.map(rowToTask);

    // Drop the old "Next" activity, promote "Next+1" into "Next", then carry
    // everything except Release items forward into the new "Next+1".
    const { error: deleteErr } = await sb.from('tasks').delete().eq('sprint', 0);
    if (deleteErr) {
      console.error(deleteErr);
      alert('Failed to advance sprint.');
      return;
    }

    const { error: updateErr } = await sb.from('tasks').update({ sprint: 0 }).eq('sprint', 1);
    if (updateErr) {
      console.error(updateErr);
      alert('Failed to advance sprint.');
      return;
    }

    const carryForward = fresh
      .filter((t) => t.sprint === 1 && t.type !== 'Release')
      .map((t) => taskToRow({ ...t, sprint: 1 }));

    if (carryForward.length) {
      const { error: insertErr } = await sb.from('tasks').insert(carryForward);
      if (insertErr) {
        console.error(insertErr);
        alert('Failed to duplicate tasks into next sprint.');
        return;
      }
    }

    await loadTasks();
  });
}

// ---- modal ----

function openAddModal(defaultSprint = 0) {
  if (!canEdit()) return;
  modalTitle.textContent = 'Add Task';
  taskIdInput.value = '';
  taskTitleInput.value = '';
  taskTypeSelect.selectedIndex = 0;
  taskSprintSelect.value = String(defaultSprint);
  taskNewInput.checked = true;
  taskChangedInput.checked = false;
  deleteBtn.classList.add('hidden');
  modalBackdrop.classList.remove('hidden');
  taskTitleInput.focus();
}

function openEditModal(task) {
  modalTitle.textContent = 'Edit Task';
  taskIdInput.value = task.id;
  taskTitleInput.value = task.title;
  taskTypeSelect.value = task.type;
  taskSprintSelect.value = String(task.sprint);
  taskNewInput.checked = !!task.isNew;
  taskChangedInput.checked = !!task.isChanged;
  deleteBtn.classList.remove('hidden');
  modalBackdrop.classList.remove('hidden');
  taskTitleInput.focus();
}

function closeModal() {
  modalBackdrop.classList.add('hidden');
}

addTaskBtn.addEventListener('click', () => openAddModal());
document.getElementById('cancel-btn').addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeModal();
});

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!canEdit()) return;
  const id = taskIdInput.value;
  const payload = {
    title: taskTitleInput.value.trim(),
    type: taskTypeSelect.value,
    sprint: Number(taskSprintSelect.value),
    isNew: taskNewInput.checked,
    isChanged: taskChangedInput.checked,
  };

  const errors = validateTask(payload);
  if (errors.length) {
    alert(errors.join('\n'));
    return;
  }

  if (id) {
    const { error } = await sb.from('tasks').update(taskToRow(payload)).eq('id', Number(id));
    if (error) {
      console.error(error);
      alert('Failed to save task.');
      return;
    }
    const task = tasks.find((t) => t.id === Number(id));
    Object.assign(task, payload);
  } else {
    const { data, error } = await sb.from('tasks').insert(taskToRow(payload)).select().single();
    if (error) {
      console.error(error);
      alert('Failed to save task.');
      return;
    }
    tasks.push(rowToTask(data));
  }

  closeModal();
  render();
});

deleteBtn.addEventListener('click', async () => {
  if (!canEdit()) return;
  const id = taskIdInput.value;
  if (!id) return;

  const { error } = await sb.from('tasks').delete().eq('id', Number(id));
  if (error) {
    console.error(error);
    alert('Failed to delete task.');
    return;
  }
  tasks = tasks.filter((t) => t.id !== Number(id));
  closeModal();
  render();
});

// ---- init ----

window.onAuthReady(() => {
  loadSprints();
  loadTasks();
});
