// ═══════════════════════════════════════════
// PRAYER NAMES — שמות לרפואה שלמה / לעילוי נשמה
// ═══════════════════════════════════════════
// One shared list (appState.prayerNames), rendered into a collapsible
// section on BOTH the Tehilim and Mishna tabs — same data, same CRUD, same
// modal form; only the list container differs per tab (LOCATIONS below).
// Reuses escapeHtml/saveState/toggleCollapsibleSection/applyCollapsedSection
// from js/utils.js per CLAUDE.md §4 — do not duplicate that logic here.

const PRAYER_NAMES_LOCATIONS = ['tehilim', 'mishna'];

function getPrayerNames() {
  return appState.prayerNames || [];
}

function _prayerNameById(id) {
  return getPrayerNames().find(p => p.id === id);
}

function _validatePrayerName(name, gender, parentName, type) {
  name = (name || '').trim().slice(0, 60);
  parentName = (parentName || '').trim().slice(0, 60);
  if (!name) return { ok: false, error: 'נא להזין שם פרטי' };
  if (!parentName) return { ok: false, error: 'נא להזין שם ההורה' };
  gender = gender === 'daughter' ? 'daughter' : 'son';
  type = type === 'memorial' ? 'memorial' : 'health';
  return { ok: true, name, gender, parentName, type };
}

function addPrayerName(name, gender, parentName, type) {
  const v = _validatePrayerName(name, gender, parentName, type);
  if (!v.ok) return v;
  if (!appState.prayerNames) appState.prayerNames = [];
  const entry = {
    id: 'pn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name: v.name, gender: v.gender, parentName: v.parentName, type: v.type,
  };
  appState.prayerNames.push(entry);
  saveState();
  return { ok: true, entry };
}

function updatePrayerName(id, name, gender, parentName, type) {
  const entry = _prayerNameById(id);
  if (!entry) return { ok: false, error: 'לא נמצא' };
  const v = _validatePrayerName(name, gender, parentName, type);
  if (!v.ok) return v;
  entry.name = v.name; entry.gender = v.gender; entry.parentName = v.parentName; entry.type = v.type;
  saveState();
  return { ok: true, entry };
}

function deletePrayerName(id) {
  appState.prayerNames = getPrayerNames().filter(p => p.id !== id);
  saveState();
}

// ── Add/edit modal — a single shared instance, not one per tab ─────────────
let _prayerNameFormGender = 'son';
let _prayerNameFormType = 'health';

function _setPrayerNameGender(g) {
  _prayerNameFormGender = g === 'daughter' ? 'daughter' : 'son';
  document.getElementById('prayer-name-gender-son')?.classList.toggle('active', _prayerNameFormGender === 'son');
  document.getElementById('prayer-name-gender-daughter')?.classList.toggle('active', _prayerNameFormGender === 'daughter');
}

function _setPrayerNameType(t) {
  _prayerNameFormType = t === 'memorial' ? 'memorial' : 'health';
  document.getElementById('prayer-name-type-health')?.classList.toggle('active', _prayerNameFormType === 'health');
  document.getElementById('prayer-name-type-memorial')?.classList.toggle('active', _prayerNameFormType === 'memorial');
}

function openPrayerNameForm(editId) {
  const modal = document.getElementById('prayer-names-modal');
  if (!modal) return;
  const titleEl  = document.getElementById('prayer-names-form-title');
  const idEl     = document.getElementById('prayer-name-edit-id');
  const nameEl   = document.getElementById('prayer-name-input');
  const parentEl = document.getElementById('prayer-name-parent-input');
  const errEl    = document.getElementById('prayer-name-form-error');
  if (errEl) errEl.textContent = '';

  const entry = editId ? _prayerNameById(editId) : null;
  if (editId && !entry) return;

  if (entry) {
    if (titleEl) titleEl.textContent = 'עריכת שם';
    if (idEl) idEl.value = editId;
    if (nameEl) nameEl.value = entry.name;
    if (parentEl) parentEl.value = entry.parentName;
    _setPrayerNameGender(entry.gender);
    _setPrayerNameType(entry.type);
  } else {
    if (titleEl) titleEl.textContent = 'שם חדש';
    if (idEl) idEl.value = '';
    if (nameEl) nameEl.value = '';
    if (parentEl) parentEl.value = '';
    _setPrayerNameGender('son');
    _setPrayerNameType('health'); // default, per spec
  }
  modal.style.display = 'flex';
}

function closePrayerNameForm() {
  const modal = document.getElementById('prayer-names-modal');
  if (modal) modal.style.display = 'none';
}

function savePrayerNameForm() {
  const id         = document.getElementById('prayer-name-edit-id')?.value;
  const name       = document.getElementById('prayer-name-input')?.value || '';
  const parentName = document.getElementById('prayer-name-parent-input')?.value || '';
  const errEl      = document.getElementById('prayer-name-form-error');

  const result = id
    ? updatePrayerName(id, name, _prayerNameFormGender, parentName, _prayerNameFormType)
    : addPrayerName(name, _prayerNameFormGender, parentName, _prayerNameFormType);

  if (!result.ok) {
    if (errEl) errEl.textContent = result.error;
    return;
  }
  closePrayerNameForm();
  renderAllPrayerNames();
}

function confirmDeletePrayerName(id) {
  const entry = _prayerNameById(id);
  if (!entry) return;
  // Look the name up fresh here rather than taking it as a parameter — same
  // reasoning as confirmDeleteTehilimFavorite (js/tehilim.js): free-text
  // through an onclick="..." attribute is a second, harder-to-escape
  // injection context on top of plain innerHTML text.
  const genderLabel = entry.gender === 'daughter' ? 'בת' : 'בן';
  if (!confirm(`למחוק את "${entry.name} ${genderLabel} ${entry.parentName}"?`)) return;
  deletePrayerName(id);
  renderAllPrayerNames();
}

// ── Rendering — same list, drawn into whichever tab(s) are in the DOM ──────
function _renderPrayerNameRow(p) {
  const genderLabel = p.gender === 'daughter' ? 'בת' : 'בן';
  const safeName = escapeHtml(p.name), safeParent = escapeHtml(p.parentName);
  return `
    <div style="display:flex;align-items:center;gap:6px;background:var(--surface);
      border:1px solid var(--border);border-radius:8px;padding:7px 10px;margin-bottom:6px">
      <span style="flex:1;font-size:13px;color:var(--cream)">${safeName} ${genderLabel} ${safeParent}</span>
      <button onclick="openPrayerNameForm('${p.id}')" aria-label="ערוך את ${safeName}"
        style="background:none;border:none;cursor:pointer;font-size:14px;padding:4px;flex-shrink:0">✏️</button>
      <button onclick="confirmDeletePrayerName('${p.id}')" aria-label="מחק את ${safeName}"
        style="background:none;border:none;cursor:pointer;font-size:14px;padding:4px;flex-shrink:0">🗑️</button>
    </div>`;
}

function renderPrayerNamesList(loc) {
  const listEl  = document.getElementById(`prayer-names-list-${loc}`);
  const emptyEl = document.getElementById(`prayer-names-empty-${loc}`);
  if (!listEl) return;
  const names = getPrayerNames();

  if (emptyEl) emptyEl.style.display = names.length ? 'none' : 'block';
  if (!names.length) { listEl.innerHTML = ''; return; }

  const health   = names.filter(p => p.type === 'health');
  const memorial = names.filter(p => p.type === 'memorial');
  const group = (title, arr) => !arr.length ? '' : `
    <div style="margin-bottom:8px">
      <div style="font-size:11px;color:var(--gold);font-weight:700;margin-bottom:5px">${title} (${arr.length})</div>
      ${arr.map(_renderPrayerNameRow).join('')}
    </div>`;

  listEl.innerHTML = group('🙏 לרפואה שלמה', health) + group('🕯️ לעילוי נשמה', memorial);
}

function renderAllPrayerNames() {
  PRAYER_NAMES_LOCATIONS.forEach(renderPrayerNamesList);
}

// Call once per tab, after its collapsible section markup exists in the DOM
// (from that tab's own init function) — restores collapse state and draws
// the (shared) list into that tab's container.
function initPrayerNamesSection(loc) {
  applyCollapsedSection(`prayer-names-${loc}-section`);
  renderPrayerNamesList(loc);
}
