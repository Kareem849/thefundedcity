// FOUNDERS' SUMMIT panel: the five founders' profiles and social links. Clicking a statue opens its
// founder. The city's owner can fill in or edit any founder (that unveils the statue).
import { foundersStore, FOUNDER_LINKS, revealed, safeUrl, type Founder, type FounderLink } from './founders';

export interface FoundersPanel { open: (id?: string) => void; close: () => void; isOpen: () => boolean }
const esc = (v: string) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const CLOSE = '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const initials = (n: string) => n.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

export function createFoundersPanel(root: HTMLElement, opts: { onVisitTower: (id: string) => void; onMayor: () => void; canRide?: () => boolean; onRide?: () => void }): FoundersPanel {
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="media-overlay founders-overlay" id="fd-overlay" hidden>
      <section class="media-panel founders-panel" role="dialog" aria-modal="true" aria-labelledby="fd-title">
        <header class="mp-head">
          <div class="mp-title"><span class="mp-eyebrow fd-eyebrow">IN THE MOUNTAINS · BETWEEN DESERT AND FOREST</span><h2 id="fd-title">Founders’ Summit</h2></div>
          <button class="icon-btn sq mp-close" id="fd-close" aria-label="Close Founders’ Summit">${CLOSE}</button>
        </header>
        <div class="mp-body" id="fd-body"></div>
        <footer class="mp-foot"><span class="mp-feed">The five founders of FUNDEDCITY. Only founders can be Mayor; traders vote at the end of every month in City Hall.</span></footer>
      </section>
    </div>`,
  );
  const overlay = root.querySelector<HTMLElement>('#fd-overlay')!;
  const body = overlay.querySelector<HTMLElement>('#fd-body')!;
  overlay.querySelector('#fd-close')!.addEventListener('click', () => close());
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });
  const store = foundersStore();
  let sel = 'founder-1';
  let editing: string | null = null;
  let flash = '';
  store.onChange(() => { if (isOpen() && !editing) render(); });

  function linksHtml(f: Founder) {
    const ls = FOUNDER_LINKS.map(([k, label]) => [label, safeUrl(f.links[k])] as const).filter(([, u]) => u);
    return ls.length ? `<div class="fd-links">${ls.map(([label, u]) => `<a class="fd-link" href="${esc(u!)}" target="_blank" rel="noopener noreferrer">${esc(label)}<small>${esc(u!.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, ''))}</small></a>`).join('')}</div>` : '<p class="tn-empty">No links yet.</p>';
  }
  function render() {
    const list = store.list();
    const f = list.find((x) => x.id === sel) ?? list[0];
    const i = list.indexOf(f);
    const can = store.canEdit();
    body.innerHTML = (flash ? `<div class="bk-flash">${esc(flash)}</div>` : '') + `
      <div class="fd-row">${list.map((x, k) => `<button class="fd-chip ${x.id === f.id ? 'on' : ''} ${revealed(x) ? '' : 'veiled'}" data-id="${x.id}"><span class="fd-av">${revealed(x) ? esc(initials(x.name)) : '?'}</span><span><b>${revealed(x) ? esc(x.name) : 'To be revealed'}</b><em>Founder ${k + 1}</em></span></button>`).join('')}</div>
      ${editing === f.id ? editForm(f) : `
      <article class="fd-card ${revealed(f) ? '' : 'veiled'}">
        <div class="fd-head"><span class="fd-big">${revealed(f) ? esc(initials(f.name)) : '?'}</span><div><span class="fd-n">FOUNDER ${i + 1}</span><h3>${revealed(f) ? esc(f.name) : 'To be revealed'}</h3><span class="fd-role">${esc(f.role || 'Founder')}${f.handle && revealed(f) ? ` · ${esc(f.handle)}` : ''}</span></div>${revealed(f) ? '<span class="fd-mayor">Mayor candidate</span>' : ''}</div>
        ${revealed(f) ? `<p class="fd-bio">${f.bio ? esc(f.bio) : `Founder of FUNDEDCITY.`}</p>${linksHtml(f)}` : '<p class="fd-bio">This founder’s statue is still veiled. Their profile and links appear here when they’re announced.</p>'}
        <div class="bk-actions">
          ${revealed(f) && f.towerId ? `<button class="btn btn-gold" id="fd-tower">Visit ${esc(f.name)} tower</button>` : ''}
          ${revealed(f) ? '<button class="btn btn-ghost" id="fd-mayor-btn">Mayor election</button>' : ''}
          ${opts.canRide?.() ? '<button class="btn btn-ghost" id="fd-ride">Ride the cable car up</button>' : ''}
          ${can ? `<button class="btn btn-ghost" id="fd-edit">${revealed(f) ? 'Edit profile' : 'Fill in this founder'}</button>` : ''}
        </div>
      </article>`}`;
    flash = '';
    body.querySelectorAll<HTMLButtonElement>('[data-id]').forEach((b) => b.addEventListener('click', () => { sel = b.dataset.id!; editing = null; render(); }));
    body.querySelector('#fd-tower')?.addEventListener('click', () => { close(); opts.onVisitTower(f.towerId!); });
    body.querySelector('#fd-mayor-btn')?.addEventListener('click', () => { close(); opts.onMayor(); });
    body.querySelector('#fd-ride')?.addEventListener('click', () => { close(); opts.onRide?.(); });
    body.querySelector('#fd-edit')?.addEventListener('click', () => { editing = f.id; render(); });
    const form = body.querySelector<HTMLFormElement>('#fd-form');
    if (form) {
      form.querySelector('#fd-cancel')!.addEventListener('click', () => { editing = null; render(); });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const d = new FormData(form);
        const s = (k: string) => String(d.get(k) ?? '').trim();
        const links: Founder['links'] = {};
        const bad: string[] = [];
        for (const [k, label] of FOUNDER_LINKS) {
          const v = s('l_' + k);
          if (!v) continue;
          const u = safeUrl(v.startsWith('http') ? v : 'https://' + v);
          if (u) links[k as FounderLink] = u; else bad.push(label);
        }
        if (bad.length) { form.querySelector<HTMLElement>('#fd-msg')!.textContent = `Check these links (https only): ${bad.join(', ')}`; return; }
        const next = store.list().map((x) => (x.id === f.id ? { ...x, name: s('name').slice(0, 40), handle: s('handle').slice(0, 40), role: s('role').slice(0, 40) || 'Founder', bio: s('bio').slice(0, 600), links } : x));
        const ok = await store.save(next);
        if (ok) { editing = null; flash = s('name') ? `${s('name')} is on the summit.` : 'Saved: this statue stays veiled until it has a name.'; render(); }
        else form.querySelector<HTMLElement>('#fd-msg')!.textContent = 'Couldn’t save: only the city’s owner can edit founders.';
      });
    }
  }
  function editForm(f: Founder) {
    return `<form class="bk-form tn-form fd-form" id="fd-form">
      <p class="bk-lead">Founder ${store.list().indexOf(f) + 1}. A name unveils the statue; leave it empty to keep it veiled.</p>
      <label>Name<input name="name" maxlength="40" value="${esc(f.name)}" /></label>
      <label>Handle<input name="handle" maxlength="40" value="${esc(f.handle)}" placeholder="@handle" /></label>
      <label>Role<input name="role" maxlength="40" value="${esc(f.role)}" placeholder="Founder" /></label>
      <label class="wide">Bio<textarea name="bio" rows="3" maxlength="600">${esc(f.bio)}</textarea></label>
      ${FOUNDER_LINKS.map(([k, label]) => `<label>${label}<input name="l_${k}" maxlength="200" value="${esc(f.links[k] ?? '')}" placeholder="https://…" /></label>`).join('')}
      <div class="bk-actions"><button class="btn btn-gold" type="submit">Save founder</button><button class="btn btn-ghost" type="button" id="fd-cancel">Cancel</button><span id="fd-msg"></span></div>
    </form>`;
  }
  function open(id?: string) {
    if (id) sel = id;
    editing = null;
    overlay.hidden = false;
    document.body.classList.add('media-open');
    render();
  }
  function close() {
    overlay.hidden = true;
    document.body.classList.remove('media-open');
  }
  function isOpen() { return !overlay.hidden; }
  return { open, close, isOpen };
}
