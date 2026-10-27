import './styles.css';
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  createTraders, createResidents, COMMERCIAL_SPACES, CITY_STATS, KAREEM_ID, SECTOR_LABEL,
  levelFor, crownFor, verifiedTotal, towerTitle, type Trader, type TowerLevel, type Resident, type TraderProfilePublic,
} from './data';
import { createProfileStore } from './profile';
import { createProfilePanel } from './profilePanel';
import { createLabPanel } from './labPanel';
import { createResetPanel } from './resetPanel';
import { createPlazaPanel } from './plazaPanel';
import { createFloorPanel } from './floorPanel';
import { createCityHallPanel } from './cityHallPanel';
import { createFoundersPanel } from './foundersPanel';
import { foundersStore, revealed, STATION } from './founders';
import { SUMMIT } from './terrain';
import type { RoomId } from './plaza';
import { RESET } from './reset';
import { createInteriors, type Interior } from './interiors';
import { THEATER } from './mediaDistrict';
import { CLUBHOUSE } from './golf';
import { FIRMS, CATEGORY_LABEL, CATEGORY_COLOR } from './firms';
import { createCity, type CityBuilding } from './city';
import { createCameraRig } from './camera';
import { createInteractions } from './interactions';
import { createUI, fmtUSD } from './ui';
import { updateTweens } from './anim';
import { runPayout, clearPayoutEffects } from './payout';
import { createLighting, type LightMode } from './lighting';
import { createNavGrid } from './navigation';
import { createPlayer, type Place, type PlayerProfile } from './player';
import { createRadio } from './radio';
import { setFavicon } from './brand';
import { createCableRide } from './cableRide';
import { createCreator } from './creator';
import { isValidConfig } from './avatar';
import { createMediaPanel } from './mediaPanel';
import { createTournamentsPanel } from './tournamentsPanel';
import { tourStatus, fmtMoney, type Tournament } from './tournaments';
import { createGolfPanel } from './golfPanel';
import { getPass, onPass, passRole } from './clubPass';
import { inGolf, GOLF_GATE } from './golf';
import { createGuardPanel } from './guardPanel';
import { buildGuards } from './guards';
import { adSlot, AD_KIND_LABEL } from './ads';
import { createCafePanel } from './cafePanel';
import { createBankPanel } from './bankPanel';
import { createAirportPanel } from './airportPanel';
import { createRideSystem } from './ride';
import { vehicles, vehicleById, KIND_ACTION } from './vehicles';
import { createWeatherFx, fetchNycWeather, sunTimes, WEATHER_SNAPSHOT, type WeatherKind, type WeatherState } from './weather';
import { createWeatherUi, type WeatherChoice } from './weatherUi';
import { HOUSE_PLOT } from './buildings';
import type { PlaceInfo } from './ui';

const PAYOUT = 25_000;
// frame-time clamp (a test harness can raise it with ?maxdt=1 on very slow software renderers)
const VIEW_H = 196;
setFavicon(); // the official FundedCity pin as the browser-tab icon
const MAX_DT = Number(new URLSearchParams(location.search).get('maxdt')) || 0.05;

async function boot() {
  // make sure canvas-drawn signs use the UI font
  try {
    await Promise.race([document.fonts.load('800 40px Manrope'), new Promise((r) => setTimeout(r, 1500))]);
  } catch { /* fall back to system font */ }

  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = '<div class="stage" id="stage"></div><div class="ui" id="ui"></div>';
  const stage = document.getElementById('stage')!;
  const uiRoot = document.getElementById('ui')!;

  /* ---------------- renderer ---------------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap; // soft, consistent across GPUs
  // static city: re-render the shadow map only periodically (every frame during the payout animation)
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  stage.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'label-layer';
  stage.appendChild(labelRenderer.domElement);

  /* ---------------- scene + light ---------------- */
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;

  const hemi = new THREE.HemisphereLight(0xf4f8ff, 0xdfe9d6, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3e0, 2.9);
  sun.position.set(-120, 250, 180);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -150; sc.right = 150; sc.top = 150; sc.bottom = -150; sc.near = 80; sc.far = 700;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 6;
  sun.shadow.blurSamples = 16;
  scene.add(sun);
  scene.add(sun.target);

  /* ---------------- data + city ---------------- */
  let traders: Trader[] = createTraders();
  const kareem = () => traders.find((t) => t.id === KAREEM_ID)!;
  // 99 registered traders in Brooklyn; house #100 stays free for the signed-up user
  const residents: Resident[] = createResidents();
  const city = createCity(traders, residents);
  const MY_HOUSE = city.houseSlots[city.houseSlots.length - 1].id;
  scene.add(city.group);
  let verifiedPayouts = CITY_STATS.verifiedPayouts;

  /* ---------------- camera ---------------- */
  const rig = createCameraRig(renderer.domElement, city.bounds);

  /* ---------------- UI ---------------- */
  const searchIndex = [
    ...traders.map((t) => ({ id: t.id, name: t.name, kind: `Trader · Level ${t.level}` })),
    ...FIRMS.map((f) => ({ id: f.id, name: f.name, kind: `${CATEGORY_LABEL[f.category]} firm HQ` })),
    ...residents.map((r) => ({ id: r.id, name: r.name, kind: 'House · registered trader' })),
    ...COMMERCIAL_SPACES.map((c) => ({ id: c.id, name: c.name, kind: 'City space · Available' })),
    ...city.landmarks.map((l) => ({ id: l.id, name: l.name, kind: 'Landmark' })),
    { id: 'stadium', name: 'Liquidation Arena', kind: 'Prop firm tournaments & prizes' },
    { id: 'the-lab', name: 'THE LAB', kind: 'Firm offers & experiments · countdowns' },
    { id: 'reset-deck', name: 'RESET · yoga & mindset', kind: 'Touch The Grass Park · AI mindset guide' },
    { id: 'the-plaza', name: 'THE PLAZA', kind: 'Mall & marketplace · 0 listing fees · 75% to sellers' },
    { id: 'trading-floor', name: 'Trading Floor', kind: 'FX · Indices · Commodities · Crypto · Options pits' },
    { id: 'city-hall', name: 'City Hall', kind: 'Announcements · reviews · votes · mayor' },
    { id: 'founders-summit', name: 'Founders’ Summit', kind: 'Statues of the founders · in the mountains' },
    { id: 'founder-1', name: 'Kareem Capital', kind: 'Founder · statue at Founders’ Summit' },
    { id: 'golf-club', name: '100K+ Payouts Golf Club', kind: 'Members only · 100K+ traders, firm CEOs & marketing' },
    { id: 'statue-of-liberty', name: 'Set For Life Statue', kind: 'Landmark · in the bay' },
    { id: 'brooklyn-bridge', name: 'Rat Race Exit Bridge', kind: 'Landmark · bridge' },
    { id: 'yacht-marina', name: 'Yacht Marina', kind: 'Brooklyn waterfront' },
    { id: 'container-port', name: 'Container Port', kind: 'Brooklyn waterfront' },
    { id: 'sip-the-dip', name: 'Sip The Dip Cafe', kind: 'Café · traders meet & talk' },
    { id: 'bank-of-gains', name: 'Bank of Gains', kind: 'Max payout rankings' },
    { id: 'airport-terminal', name: 'FUNDEDCITY International Airport', kind: 'Airport · flights & radar' },
    { id: 'airport-tower', name: 'Control Tower', kind: 'Airport · radar' },
    { id: 'media-center', name: 'Economic Calendar', kind: 'Media District' },
    { id: 'media-theater', name: 'Media Theater', kind: 'Media District · press conferences' },
  ];
  const ui = createUI(uiRoot, searchIndex, {
    onSearchSelect: (id) => selectOrVisit(id),
    onWalkTo: (id) => walkTo(id),
    onSkipWalk: () => player.skip(),
    onStopWalk: () => player.stop(),
    onEditCharacter: () => openCreator('edit'),
    onSignup: () => openCreator('signup'),
    onResetCamera: () => { rig.setOrbit(false); rig.reset(); },
    onSimulate: () => simulatePayout(),
    onResetDemo: () => resetDemo(),
    onCloseCard: () => interactions.select(null),
    onRotate: (deg) => { rig.setOrbit(false); rig.rotateBy(deg); },
    onToggleOrbit: () => rig.setOrbit(!rig.controls.autoRotate),
    onMode: (m) => setMode(m),
    onPlaceAction: (id) => runAction(id),
  });
  function runAction(id: string) {
    {
      if (id.startsWith('walk:')) walkTo(id.slice(5));
      if (id.startsWith('ride:')) {
        const vid = id.slice(5);
        ui.hideCard();
        if (vid.startsWith('golf-cart') && !getPass()) { golfPanel.open('gate', 'Golf carts are for club members. Show your club pass at the members’ gate first.'); return; }
        ride.board(vid);
      }
      if (id.startsWith('adreq:')) {
        const slot = adSlot(id.slice(6));
        ui.hideCard();
        if (slot) rideToast('Request sent (demo)', `${slot.name}: the FUNDEDCITY ad team would contact you. No booking or payment is made in this demo.`);
      }
      if (id === 'golf:gate') { ui.hideCard(); golfPanel.open('gate'); }
      if (id.startsWith('profile:')) { ui.hideCard(); profilePanel.open(id.slice(8) as 'profile' | 'payouts' | 'tower'); }
      if (id.startsWith('guard:')) { const f = FIRMS.find((x) => x.id === id.slice(6)); if (f) { ui.hideCard(); guardPanel.open(f); } }
      if (id.startsWith('enter:')) { const bid = id.slice(6); ui.hideCard(); if (!nearEnough(bid) || !enter(bid)) walkTo(bid); }
      if (id.startsWith('bank:')) bankPanel.open(id.slice(5) as 'single' | 'total' | 'rules');
      if (id.startsWith('firmcard:')) { const f = FIRMS.find((x) => x.id === id.slice(9)); if (f) ui.showFirm(f, true, firmStats(f)); }
      if (id.startsWith('airport:')) airportPanel.open(id.slice(8) as 'radar' | 'flights' | 'ads');
      if (id === 'cafe:chat') cafe.open();
      if (id === 'arena:live') tournaments.open('live');
      if (id === 'arena:publish') tournaments.open('publish');
      if (id === 'media:theater') media.open('theater');
      if (id === 'golf:lounge') golfPanel.lounge.open();
      if (id.startsWith('lab:')) labPanel.open(id.slice(4) as 'experiments' | 'ask' | 'rent');
      if (id.startsWith('reset:')) resetPanel.open(id.slice(6) as 'private' | 'group');
      if (id.startsWith('plaza:')) plazaPanel.open(id.slice(6) as 'shop' | 'basket' | 'sell' | 'rules');
      if (id.startsWith('floor:')) floorPanel.open(id.slice(6) as RoomId);
      if (id.startsWith('hall:')) hallPanel.open(id.slice(5) as 'news' | 'reviews' | 'votes' | 'mayor' | 'rules');
      if (id === 'founders:open') foundersPanel.open();
      if (id === 'founders:down') leave();
    }
  }
  rig.onOrbit((on) => ui.setOrbit(on));
  const media = createMediaPanel(uiRoot, document.getElementById('discover-toasts')!, uiRoot.querySelector('.topbar-right')!);
  const playerName = () => player?.profile?.name ?? null;
  const profiles = createProfileStore();
  const cafe = createCafePanel(uiRoot, playerName);
  const bankPanel = createBankPanel(uiRoot, () => traders, playerName, {
    verifiedSingles: () => profiles.all().flatMap((p) => p.payouts.filter((r) => r.status === 'verified' && r.kind === 'single').map((r) => ({
      key: `v:${p.uid}:${r.id}`, name: p.towerName, amount: r.amount, firm: r.firm, date: r.date, mine: p.uid === profiles.uid,
    }))),
    onUpload: () => openMyProfile('payouts'),
  });
  bankPanel.onTop((label) => city.bank.setTopPayout(label));
  const airportPanel = createAirportPanel(uiRoot, city.airport);
  cafe.onLatest((m) => {
    bubbleEl.hidden = !m;
    if (m) {
      bubbleEl.replaceChildren();
      const b = document.createElement('b');
      b.textContent = m.name || 'Trader';
      const sp = document.createElement('span');
      sp.textContent = m.text.length > 60 ? m.text.slice(0, 58) + '…' : m.text;
      bubbleEl.append(b, sp);
    }
  });
  // Liquidation Arena: prop firm tournaments (firm teams publish theirs; SAMPLE listings fill in)
  let tourList: Tournament[] = [];
  const golfPanel = createGolfPanel(uiRoot, {
    getName: playerName,
    myVerifiedPayouts: () => {
      // the signed-in member's linked trader record (in this demo: Kareem Capital, the signature tower)
      if (player?.profile?.status !== 'member') return null;
      const k = kareem();
      return { name: k.name, payouts: k.payouts };
    },
    members: () => traders.filter((t) => t.payouts >= 100_000).sort((a, b) => b.payouts - a.payouts).map((t) => ({ name: t.name, payouts: t.payouts })),
    firms: FIRMS,
    onSignup: () => openCreator('signup'),
    onWalkIn: () => walkTo('golf-lawn'),
  });
  const tournaments = createTournamentsPanel(uiRoot, playerName, () => golfPanel.open('gate'));
  tournaments.onChange((list, added) => {
    tourList = list;
    for (const t of added) {
      rideToast(`New at the Liquidation Arena`, `${t.organizer}: ${t.title} · ${fmtMoney(t.prizePool)} prize pool`);
      ui.pushActivity({ text: `<b>${escapeHtml(t.organizer)}</b> published <b>${escapeHtml(t.title)}</b> at the Liquidation Arena (${fmtMoney(t.prizePool)})`, kind: 'achievement', ago: 'now' });
    }
  });
  const guardPanel = createGuardPanel(uiRoot);
  const labPanel = createLabPanel(uiRoot, playerName, () => golfPanel.open('gate'));
  labPanel.onChange((_list, added) => {
    city.lab.setBays(labPanel.bays());
    for (const e of added) {
      city.lab.launch();
      rideToast('Launched in THE LAB', `${e.firm}: ${e.title}`);
      ui.pushActivity({ text: `<b>${escapeHtml(e.firm)}</b> launched <b>${escapeHtml(e.title)}</b> in THE LAB`, kind: 'achievement', ago: 'now' });
    }
  });
  setInterval(() => city.lab.setBays(labPanel.bays()), 30_000);
  const resetPanel = createResetPanel(uiRoot, playerName);
  // THE PLAZA (mall & marketplace), the Trading Floor and City Hall
  const plazaPanel = createPlazaPanel(uiRoot, playerName);
  plazaPanel.onNew((l) => ui.pushActivity({ text: `<b>${escapeHtml(l.seller)}</b> listed <b>${escapeHtml(l.title)}</b> in THE PLAZA`, kind: 'achievement', ago: 'now' }));
  const floorPanel = createFloorPanel(uiRoot, playerName);
  floorPanel.onTicker((items) => city.tradingFloor.setTicker(items));
  const hallPanel = createCityHallPanel(uiRoot, playerName, () => player?.profile?.status === 'member', () => openCreator('signup'), (id) => foundersPanel.open(id));
  hallPanel.onChange(() => city.cityHall.setBoard(hallPanel.board()));
  hallPanel.onAnnouncement((title) => {
    rideToast('City Hall announcement', title);
    ui.pushActivity({ text: `<b>City Hall</b> announced: <b>${escapeHtml(title)}</b>`, kind: 'achievement', ago: 'now' });
  });
  setInterval(() => city.cityHall.setBoard(hallPanel.board()), 60_000);
  // Founders' Summit: statues + profiles (founders fill in later; only founders can be mayor)
  const foundersPanel = createFoundersPanel(uiRoot, { onVisitTower: (id) => selectOrVisit(id), onMayor: () => hallPanel.open('mayor'), canRide: () => cableRide.state() === 'idle', onRide: () => runAction('enter:founders-summit') });
  foundersStore().onChange((list) => { city.setFounders(list); city.cityHall.setBoard(hallPanel.board()); });
  onPass((p) => { if (p) ui.pushActivity({ text: `<b>${escapeHtml(playerName() ?? 'You')}</b> got a club pass at the <b>100K+ Payouts Golf Club</b> (${escapeHtml(passRole(p))})`, kind: 'join', ago: 'now' }); });
  const PLACE_INFO: Record<string, PlaceInfo> = {
    'statue-of-liberty': {
      id: 'statue-of-liberty', badge: 'SF', title: 'Set For Life Statue', sub: 'On its star-fort island in the bay',
      text: 'Torch raised toward the skyline: the goal every funded trader is working toward. Modelled on Lady Liberty, she stands south-west of the city and her torch lights up at night.',
      facts: [['Stands for', 'Financial freedom'], ['Inspired by', 'Statue of Liberty (1886)'], ['Location', 'South-west bay'], ['At night', 'Torch lit']],
    },
    'brooklyn-bridge': {
      id: 'brooklyn-bridge', badge: 'RR', title: 'Rat Race Exit Bridge', sub: 'Main island ↔ Brooklyn',
      text: 'Gothic stone towers, steel cables and a timber promenade over the river. Cross it to leave the rat race behind; the trader houses are on the other side.',
      facts: [['Inspired by', 'Brooklyn Bridge (1883)'], ['Towers', '2 gothic arches'], ['Here', 'Carries the −40 avenue'], ['At night', 'Cable lights on']],
      action: { label: 'Walk onto the bridge', id: 'walk:bridge-walk' },
    },
    'yacht-marina': {
      id: 'yacht-marina', badge: 'YM', title: 'Yacht Marina', sub: 'Brooklyn waterfront',
      text: 'Pontoons with motor yachts and two superyachts on the outer berth, sheltered by a breakwater with a harbour light.',
      facts: [['Berths', '9 + 2 superyachts'], ['Club', 'Marina Club'], ['Boats', 'Yachts & sailboats cruise the bay']],
      action: { label: 'Walk to the Marina Club', id: 'walk:marina-club' },
    },
    'container-port': {
      id: 'container-port', badge: 'CP', title: 'Container Port', sub: 'Brooklyn waterfront',
      text: 'Ship-to-shore gantry cranes work a container ship at the quay; another container ship sails the loop around the islands.',
      facts: [['Gantry cranes', '3'], ['At the quay', 'Container ship'], ['Yard', 'Stacked containers']],
      action: { label: 'Walk to the Port Gate', id: 'walk:port-gate' },
    },
  };
  const MEDIA_TAB: Record<string, 'calendar' | 'theater'> = { 'media-theater': 'theater', 'media-center': 'calendar', 'media-countdown': 'calendar' };
  ui.renderLeaderboard(traders);

  /* ---------------- labels ---------------- */
  const districtLabels: HTMLElement[] = [];
  for (const d of city.labels) {
    const el = ui.makeDistrictLabel(d.name, d.subtitle);
    el.classList.add(`d-${d.id}`);
    if (d.tone) el.classList.add(`tone-${d.tone}`);
    const o = new CSS2DObject(el);
    o.position.set(d.x, d.y, d.z);
    scene.add(o);
    districtLabels.push(el);
  }
  // speech bubble over the café with the latest chat message
  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'cafe-bubble';
  bubbleEl.hidden = true;
  const bubble = new CSS2DObject(bubbleEl);
  bubble.position.set(city.cafePos.x, 11, city.cafePos.z);
  scene.add(bubble);
  // gold name pin over "your" tower: your own once you have one, the demo signature tower until then
  let pin = new CSS2DObject(ui.makeNamePin('Kareem Capital'));
  let pinName = 'Kareem Capital';
  const attachPin = (b: CityBuilding) => {
    if (b.name !== pinName) {
      pin.removeFromParent();
      pin.element.remove();
      pin = new CSS2DObject(ui.makeNamePin(b.name));
      pinName = b.name;
    }
    pin.removeFromParent();
    pin.position.set(0, b.height + 1.4, 0);
    b.root.add(pin);
  };
  attachPin(city.buildings.get(KAREEM_ID)!);

  /* ---------------- interactions ---------------- */
  const focusBuilding = (b: CityBuilding, zoom = 2.6) => {
    const p = b.root.position;
    rig.focusOn(new THREE.Vector3(p.x, Math.min(b.height * 0.42, 12), p.z), { zoom, blend: 0.85, duration: 0.9 });
  };
  const showBuildingCard = (b: CityBuilding) => {
    if (inside) return;
    // standing at the door: clicking a place takes you straight in
    if (player.active && !ride.current() && nearEnough(b.id) && canEnter(b) === true && enter(b.id)) return;
    showBuildingCardInner(b);
    if (canEnter(b) !== null && document.getElementById('info-card')?.classList.contains('open') && ui.currentCardId() === b.id) {
      const card = document.getElementById('info-card')!;
      card.querySelector('.card-enter')?.remove();
      const btn = document.createElement('button');
      btn.className = 'btn btn-gold card-enter';
      btn.textContent = canEnter(b) === true ? 'Go inside' : canEnter(b) === 'members' ? 'Members only · show your pass' : 'Private: owner hasn’t opened it to visitors';
      btn.disabled = canEnter(b) === 'private';
      btn.addEventListener('click', () => runAction(canEnter(b) === 'members' ? 'golf:gate' : 'enter:' + b.id));
      card.appendChild(btn);
    }
  };
  const showBuildingCardInner = (b: CityBuilding) => {
    if (b.kind === 'trader') ui.showTrader(traders.find((t) => t.id === b.id)!);
    else if (b.kind === 'firm') { const f = FIRMS.find((x) => x.id === b.id)!; ui.showFirm(f, true, firmStats(f)); }
    else if (b.kind === 'house') ui.showHouse(residents.find((r) => r.id === b.id) ?? null, b.id);
    else if (b.kind === 'media') { ui.hideCard(); media.open(MEDIA_TAB[b.id] ?? 'calendar'); }
    else if (b.kind === 'stadium') { ui.hideCard(); tournaments.open('live'); }
    else if (b.kind === 'place' && b.id === 'golf-club') { ui.hideCard(); golfPanel.open(getPass() ? 'members' : 'gate'); }
    else if (b.kind === 'place') ui.showPlace(PLACE_INFO[b.id]);
    else if (b.kind === 'ad') ui.showPlace(adInfo(b.id));
    else if (b.kind === 'cafe') { ui.hideCard(); cafe.open(); }
    else if (b.kind === 'lab') { ui.hideCard(); labPanel.open('experiments'); }
    else if (b.kind === 'reset') { ui.hideCard(); resetPanel.open('private'); }
    else if (b.kind === 'plaza') { ui.hideCard(); plazaPanel.open('shop'); }
    else if (b.kind === 'floor') { ui.hideCard(); floorPanel.open(); }
    else if (b.kind === 'hall') { ui.hideCard(); hallPanel.open('news'); }
    else if (b.kind === 'founder') { ui.hideCard(); foundersPanel.open(b.id); }
    else if (b.kind === 'founders') { ui.hideCard(); foundersPanel.open(); }
    else if (b.kind === 'bank') { ui.hideCard(); bankPanel.open('single'); }
    else if (b.kind === 'airport') { ui.hideCard(); airportPanel.open(b.id === 'airport-terminal' ? 'flights' : 'radar'); }
    else ui.showCommercial(COMMERCIAL_SPACES.find((c) => c.id === b.id)!);
  };
  const adInfo = (id: string): PlaceInfo => {
    const s = adSlot(id)!;
    return {
      id, badge: 'AD', title: s.name, sub: `${AD_KIND_LABEL[s.kind]} · ad space available`,
      text: `Put your brand here: ${s.where}. Seen by ${s.audience.toLowerCase()}. Prices are sample figures for the demo; nothing is booked or charged.`,
      facts: [['Where', s.where], ['Size', s.size], ['Audience', s.audience], ['Sample price', `$${s.price.toLocaleString('en-US')}/mo`]],
      action: { label: 'Request this spot (demo)', id: 'adreq:' + id },
    };
  };
  const interactions = createInteractions(renderer.domElement, () => rig.view, scene, city, {
    onGround(p) {
      if (inside) return;
      if (player.active) player.walkToPoint(p.x, p.z);
    },
    vehicleTargets: () => vehicles().map((v) => v.obj),
    onVehicleHover(id, x, y) {
      const v = id ? vehicleById(id) : null;
      if (!v || inside) return ui.setTooltip(null);
      ui.setTooltip(v.name, `${v.model} · click to ${KIND_ACTION[v.kind].toLowerCase()} it`, x, y);
    },
    onVehicleClick(id) {
      if (inside) return;
      const v = vehicleById(id);
      if (!v) return;
      interactions.select(null);
      const kmh = Math.round(v.maxSpeed * 4.5);
      const how = v.kind === 'car' ? 'W/S throttle, A/D steer' : v.kind === 'boat' ? 'W/S throttle, A/D steer (stays on water)' : v.kind === 'heli' ? 'W/S, A/D, Space up, Shift down' : 'W/S throttle, A/D turn, Space climb';
      ui.showPlace({
        id: v.id, badge: v.kind === 'car' ? 'CAR' : v.kind === 'boat' ? 'BOAT' : v.kind === 'heli' ? 'HELI' : 'AIR',
        title: v.name, sub: v.model,
        text: v.kind === 'plane' ? 'Take the controls: build speed on the runway, then climb and fly anywhere over the city.' : v.kind === 'heli' ? 'Lift off and hover over any district; land anywhere.' : v.kind === 'boat' ? 'Take the helm and cruise the bay, the river and round the islands.' : 'Get behind the wheel and drive anywhere on the islands, across the bridges.',
        facts: [['Top speed', `${kmh} km/h`], ['Controls', how], ['Exit', 'Press E'], ...((): Array<[string, string]> => {
          const slot = adSlot(String(v.obj.userData.adSlot ?? ''));
          return slot ? [['Hull ad space', `${slot.size} · sample $${slot.price.toLocaleString('en-US')}/mo`]] : [];
        })()],
        action: { label: `${KIND_ACTION[v.kind]} it`, id: 'ride:' + v.id },
      });
    },
    onSelect(b) {
      if (inside) return;
      showBuildingCard(b);
      focusBuilding(b);
    },
    onDeselect() {
      ui.hideCard();
    },
    onHover(b, x, y) {
      if (!b || inside) return ui.setTooltip(null);
      if (b.kind === 'trader') {
        const t = traders.find((tt) => tt.id === b.id)!;
        ui.setTooltip(t.name, `Level ${t.level} · ${fmtUSD(t.payouts)} verified`, x, y);
      } else if (b.kind === 'firm') {
        const f = FIRMS.find((ff) => ff.id === b.id)!;
        ui.setTooltip(f.name, `${CATEGORY_LABEL[f.category]} firm HQ · ${player.discovered.has(f.id) ? 'plans unlocked' : 'visit to unlock plans'}`, x, y);
      } else if (b.kind === 'house') {
        const r = residents.find((rr) => rr.id === b.id);
        ui.setTooltip(r ? r.name : 'Available house', r?.mine ? 'Your house' : r ? `Registered · ${SECTOR_LABEL[r.sector]} · no payout yet` : 'Free for the next member', x, y);
      } else if (b.kind === 'stadium') {
        const now = Date.now();
        const live = tourList.filter((t) => tourStatus(t, now) === 'live').length;
        const soon = tourList.filter((t) => tourStatus(t, now) === 'upcoming').length;
        ui.setTooltip('Liquidation Arena', `Prop firm tournaments · ${live} live · ${soon} upcoming`, x, y);
      } else if (b.kind === 'ad') {
        const sl = adSlot(b.id);
        ui.setTooltip(b.name, sl ? `Ad space available · sample $${sl.price}/mo` : 'Ad space', x, y);
      } else if (b.kind === 'lab') {
        const live = labPanel.bays().filter(Boolean).length;
        ui.setTooltip('THE LAB', `Firm offers & experiments · ${live} of 4 bays running · click to look inside`, x, y);
      } else if (b.kind === 'plaza') {
        ui.setTooltip('THE PLAZA', 'Mall & marketplace · 0 listing fees · 75% to the seller · click to go in', x, y);
      } else if (b.kind === 'floor') {
        const a = floorPanel.activity();
        const n = Object.values(a).reduce((x, y2) => x + y2, 0);
        ui.setTooltip('Trading Floor', `FX · Indices · Commodities · Crypto · Options · ${n} post${n === 1 ? '' : 's'} today`, x, y);
      } else if (b.kind === 'hall') {
        const bd = hallPanel.board();
        ui.setTooltip('City Hall', `${bd.mayor ? 'Mayor: ' + bd.mayor : 'Mayoral election running'} · ${bd.polls} open vote${bd.polls === 1 ? '' : 's'}`, x, y);
      } else if (b.kind === 'founder') {
        const f = foundersStore().list().find((x) => x.id === b.id);
        ui.setTooltip(f && revealed(f) ? f.name : b.name, f && revealed(f) ? `${f.role || 'Founder'} · click for profile & links` : 'Founder · statue still veiled', x, y);
      } else if (b.kind === 'founders') {
        ui.setTooltip('Founders’ Summit', 'Statues of the five founders · cable car from the north-west corner', x, y);
      } else if (b.kind === 'reset') {
        ui.setTooltip('RESET · yoga & mindset', 'Talk through a losing trade with the AI guide · private or group', x, y);
      } else if (b.kind === 'cafe') {
        ui.setTooltip('Sip The Dip Cafe', 'Traders meet & talk · click to join the chat', x, y);
      } else if (b.kind === 'bank') {
        ui.setTooltip('Bank of Gains', 'Max single payout rankings · register yours', x, y);
      } else if (b.kind === 'airport') {
        ui.setTooltip(b.name, b.id === 'airport-terminal' ? 'Arrivals, departures & aircraft ads' : 'Live radar', x, y);
      } else if (b.kind === 'place') {
        ui.setTooltip(b.name, b.id === 'golf-club' ? 'Members only · 100K+ traders, firm CEOs & marketing teams' : PLACE_INFO[b.id]?.sub ?? '', x, y);
      } else if (b.kind === 'media') {
        const sub: Record<string, string> = { 'media-theater': 'Big screen · press conferences & live events', 'media-center': 'Economic calendar · click to open', 'media-countdown': 'Countdown to the next major event' };
        ui.setTooltip(b.name, `Media District · ${sub[b.id] ?? ''}`, x, y);
      } else {
        const c = COMMERCIAL_SPACES.find((cc) => cc.id === b.id)!;
        ui.setTooltip(b.name, `Available · from ${fmtUSD(c.price)}/mo`, x, y);
      }
    },
  });

  /* ---------------- character, walking, discovery ---------------- */
  const nav = createNavGrid(city.walk, city.obstacles, 0.6);
  const places: Place[] = [
    ...[...city.buildings.values()].filter((b) => b.kind !== 'house' && b.kind !== 'place' && b.kind !== 'ad' && b.kind !== 'founder').map((b) => ({
      id: b.id, name: b.kind === 'firm' ? `${b.name} HQ` : b.name, kind: b.kind as Place['kind'],
      x: b.root.position.x, z: b.root.position.z, r: b.radius + 2.2,
      // the summit is reached by the cable car: walking there takes you to the lower station
      ...(b.id === 'founders-summit' ? { x: STATION.x + 4.5, z: STATION.z + 4.5, r: 3 } : {}),
    })),
    ...city.landmarks.map((l) => ({ id: l.id, name: l.name, kind: 'landmark' as const, x: l.x, z: l.z, r: l.r })),
  ];
  const KIND_LABEL: Record<Place['kind'], string> = { trader: 'Trader tower', firm: 'Prop firm HQ', commercial: 'City space', landmark: 'Landmark', media: 'Media District', stadium: 'Stadium', cafe: 'Café', bank: 'Bank', airport: 'Airport', lab: 'THE LAB', reset: 'Touch The Grass Park', plaza: 'Mall', floor: 'Trading Floor', hall: 'City Hall', founders: 'Founders’ Summit' };
  const GROUP_LABEL: Record<Place['kind'], string> = { trader: 'Trader towers', firm: 'Prop firm HQs', commercial: 'City spaces', landmark: 'Landmarks', media: 'Media District', stadium: 'Stadium', cafe: 'Waterfront', bank: 'Capital Square', airport: 'Airport', lab: 'Capital Square', reset: 'Landmarks', plaza: 'THE PLAZA district', floor: 'Trading Floor', hall: 'Capital Square', founders: 'The mountains' };
  /** real numbers for a firm card: members who list the firm, and their verified payouts from it */
  const firmStats = (f: (typeof FIRMS)[number]) => {
    const all = profiles.all();
    const traders = all.filter((p) => p.firms.includes(f.name) || p.payouts.some((r) => r.firm === f.name || r.firm === f.id)).length;
    const payouts = all.reduce((a, p) => a + p.payouts.filter((r) => r.status === 'verified' && (r.firm === f.name || r.firm === f.id)).reduce((x, r) => x + r.amount, 0), 0);
    return { traders, payouts };
  };
  const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const creator = createCreator(document.body);
  const PROFILE_KEY = 'fundedcity-profile';

  const player = createPlayer({
    scene, nav, rig, groundY: 0.12, places, heightAt: city.heightAt,
    makePin: (p) => ui.makePlayerPin(p.name, p.status),
    isTyping: () => creator.open || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? ''),
    onDiscover(place) {
      const n = player.discovered.size;
      ui.showDiscovery(place.name, place.kind === 'firm' ? 'Plans, services & offers unlocked' : place.kind === 'media' ? 'Calendar, theater & news unlocked' : place.kind === 'stadium' ? 'Prop firm tournaments unlocked' : place.kind === 'cafe' ? 'Chat with traders unlocked' : place.kind === 'bank' ? 'Payout rankings unlocked' : place.kind === 'airport' ? 'Flight board & radar unlocked' : place.kind === 'lab' ? 'Experiments & the Lab AI unlocked' : place.kind === 'reset' ? 'Mindset sessions unlocked' : place.kind === 'plaza' ? 'Shopping & selling unlocked' : place.kind === 'floor' ? 'The five trading pits unlocked' : place.kind === 'hall' ? 'Votes & the mayoral election unlocked' : place.kind === 'founders' ? 'The founders’ statues unlocked' : KIND_LABEL[place.kind], n, places.length);
      if (place.kind === 'firm' && ui.currentCardId() === place.id) { const f = FIRMS.find((x) => x.id === place.id)!; ui.showFirm(f, true, firmStats(f)); }
      ui.pushActivity({ text: `<b>${escapeHtml(player.profile?.name ?? 'You')}</b> discovered <b>${escapeHtml(place.name)}</b>`, kind: 'achievement', ago: 'now' });
      refreshPlayerUI();
      saveProfile();
    },
    onArrive(id) {
      if (!id) return;
      if (city.buildings.has(id)) {
        rig.follow(null);
        // reaching a place takes you inside it (your home, your tower, the café, the bank...)
        if (!enter(id)) interactions.select(id);
      }
    },
    onWalkState: (st) => ui.setWalk(st),
  });

  /* ---------------- FUNDEDCITY Radio (header) ---------------- */
  const radio = createRadio(uiRoot.querySelector('.topbar-right')!, { onListening: (on) => player.setListening(on) });

  /* ---------------- ride anything ---------------- */
  const rideToast = (title: string, sub: string) => {
    const el = document.createElement('div');
    el.className = 'media-toast glass-card ride-toast';
    el.innerHTML = `<div><span class="mt-eyebrow">${escapeHtml(title)}</span><em>${escapeHtml(sub)}</em></div>`;
    document.getElementById('discover-toasts')!.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, 4000);
  };
  const ride = createRideSystem(uiRoot, {
    rig, nav, onLand: city.onLand, heightAt: city.heightAt, bounds: city.bounds, player,
    isTyping: () => creator.open || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? ''),
    toast: rideToast,
    needCharacter: () => openCreator('create'),
  });

  /* ---------------- the cable car up to Founders' Summit, ridden in a glass gondola ---------------- */
  const cableRide = createCableRide(uiRoot, {
    cable: city.cable, rig, player,
    exitSpot: () => {
      const x = STATION.x + 6.4, z = STATION.z + 6.4;
      return nav.walkable(x, z) ? { x, z } : nav.nearestWalkable(x, z, 30) ?? { x, z };
    },
    canBoard: () => !inside && !ride.current() && !document.body.classList.contains('media-open'),
    isTyping: () => creator.open || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? ''),
    needCharacter: () => openCreator('create'),
    onTop: () => { enter('founders-summit'); },
    onBottom: () => rideToast('Back in the city', 'You stepped off the cable car at the lower station.'),
  });

  /* ---------------- AI customer-service guards at every prop firm HQ ---------------- */
  const guards = buildGuards(scene, [...city.buildings.values()].filter((b) => b.kind === 'firm').map((b) => {
    const f = FIRMS.find((x) => x.id === b.id)!;
    return { b, name: f.name, color: CATEGORY_COLOR[f.category] };
  }), nav);
  const guardTags = guards.guards.map((g) => {
    const el = document.createElement('button');
    el.className = 'guard-tag';
    el.type = 'button';
    el.innerHTML = `<b>AI</b><span>Ask ${escapeHtml(FIRMS.find((f) => f.id === g.firmId)?.sign ?? g.firmName)} support</span>`;
    el.addEventListener('click', (e) => { e.stopPropagation(); const f = FIRMS.find((x) => x.id === g.firmId); if (f) guardPanel.open(f); });
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    const o = new CSS2DObject(el);
    o.position.set(g.x, 3.3, g.z);
    o.center.set(0.5, 1);
    scene.add(o);
    return { g, el, o };
  });
  uiRoot.insertAdjacentHTML('beforeend', '<button class="ride-prompt glass-card guard-prompt" id="guard-prompt" hidden></button>');
  const guardPrompt = document.getElementById('guard-prompt') as HTMLButtonElement;
  let nearGuard: (typeof guards.guards)[number] | null = null;
  let guardTimer = 0;
  const openNearGuard = () => { const f = nearGuard && FIRMS.find((x) => x.id === nearGuard!.firmId); if (f) guardPanel.open(f); };
  guardPrompt.addEventListener('click', openNearGuard);
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyQ' || e.repeat || !nearGuard || creator.open || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '')) return;
    openNearGuard();
  });
  function updateGuardPrompt(dt: number) {
    guardTimer -= dt;
    if (guardTimer > 0) return;
    guardTimer = 0.2;
    const pp = player.position;
    const ref = rig.chasing || player.active ? pp : rig.controls.target;
    const showTags = rig.chasing || rig.camera.zoom > 2.3;
    for (const t of guardTags) {
      const d = Math.hypot(t.g.x - ref.x, t.g.z - ref.z);
      t.o.visible = showTags && d < (rig.chasing ? 28 : player.active ? 16 : 30);
    }
    nearGuard = null;
    if (player.active && !player.riding && !inside && !document.body.classList.contains('media-open')) {
      let best = 4;
      for (const g of guards.guards) {
        const d = Math.hypot(g.x - pp.x, g.z - pp.z);
        if (d < best) { best = d; nearGuard = g; }
      }
    }
    guardPrompt.hidden = !nearGuard;
    if (nearGuard) guardPrompt.innerHTML = `<kbd>Q</kbd> Ask ${escapeHtml(nearGuard.firmName)} support (AI)`;
  }

  /* ---------------- inside views ---------------- */
  const interiors = createInteriors({
    scene,
    flights: () => city.airport.flights(),
    topPayouts: () => [...traders].sort((a, b) => b.payouts - a.payouts).slice(0, 8).map((t) => ({ name: t.name, amount: t.payouts, title: towerTitle(t.payouts) })),
    statue: (() => { const b = city.buildings.get('statue-of-liberty')!; return { x: b.root.position.x, z: b.root.position.z, height: b.height }; })(),
    cafe: () => city.buildings.get('sip-the-dip'),
  });
  let inside: Interior | null = null;
  /** can you go in? true, 'private' (owner hasn't opened it), 'members' (golf club), or null (no inside view) */
  function canEnter(b: CityBuilding): true | 'private' | 'members' | null {
    if (b.kind === 'house') {
      if (b.id === MY_HOUSE) return true;
      const r = residents.find((x) => x.id === b.id);
      if (r?.uid) return profiles.all().find((p) => p.uid === r.uid)?.allowVisitors ? true : 'private';
      return true; // sample show homes
    }
    if (b.kind === 'trader') {
      const t = traders.find((x) => x.id === b.id);
      if (!t) return null;
      return t.mine || t.demo || t.profile?.allowVisitors ? true : 'private';
    }
    if (b.id === 'golf-club') return getPass() ? true : 'members';
    if (b.kind === 'place') return ['statue-of-liberty', 'yacht-marina', 'container-port'].includes(b.id) ? true : null;
    return ['cafe', 'bank', 'firm', 'airport', 'stadium', 'media', 'lab', 'reset', 'plaza', 'floor', 'hall', 'founders'].includes(b.kind) ? true : null;
  }
  function nearEnough(id: string) {
    const b = city.buildings.get(id);
    if (!b || !player.active) return false;
    return Math.hypot(player.position.x - b.root.position.x, player.position.z - b.root.position.z) < b.radius + 9;
  }
  function interiorFor(b: CityBuilding): Interior | null {
    const owner = (name: string, payouts: number, sector: string, mine: boolean) => ({ name, payouts, sector, mine, title: towerTitle(payouts) });
    switch (b.kind) {
      case 'house': {
        const r = residents.find((x) => x.id === b.id);
        const mine = b.id === MY_HOUSE && !!r?.mine;
        return interiors.home(b.id, owner(r?.name ?? 'Show home', 0, r ? SECTOR_LABEL[r.sector] : 'FUNDEDCITY', mine));
      }
      case 'trader': {
        const t = traders.find((x) => x.id === b.id)!;
        return interiors.penthouse(b, owner(t.name, t.payouts, SECTOR_LABEL[t.sector], !!t.mine));
      }
      case 'cafe': return interiors.cafeSeat(b);
      case 'lab': return interiors.missionControl(city.lab.screenTextures);
      case 'reset':
        return interiors.seat(b.id, 'RESET · on your mat', 'Breathe with the class. The AI guide is listening.', new THREE.Vector3(RESET.x + 1.2, 1.85, RESET.z - 4.3), new THREE.Vector3(RESET.x + 0.4, 1.0, RESET.z + 20), [{ id: 'reset:private', label: 'Private session' }, { id: 'reset:group', label: 'Group circle' }], 64);
      case 'bank': return interiors.bank();
      case 'founders': {
        // ride the cable car up: stand on the plaza facing the statues, the city far below behind you
        const d = Math.PI / 4;
        return interiors.seat(b.id, 'Founders’ Summit', 'Up the cable car: the founders’ statues in the mountains', new THREE.Vector3(SUMMIT.x + Math.sin(d) * 3 - Math.sin(d) * 9, SUMMIT.y + 5.2, SUMMIT.z + Math.cos(d) * 3 + Math.cos(d) * 9), new THREE.Vector3(SUMMIT.x - Math.sin(d) * 19 - Math.sin(d) * 7, SUMMIT.y + 7.4, SUMMIT.z - Math.cos(d) * 19 + Math.cos(d) * 7), [{ id: 'founders:open', label: 'The founders' }, { id: 'hall:mayor', label: 'Mayor election' }, ...(cableRide.state() === 'top' ? [{ id: 'founders:down', label: 'Cable car down' }] : [])], 62);
      }
      case 'plaza': return interiors.mallAtrium();
      case 'floor': return interiors.tradingPits(city.tradingFloor.tickerTexture);
      case 'hall': return interiors.councilChamber(city.cityHall.boardTexture, city.cityHall.clockTexture);
      case 'firm': {
        const f = FIRMS.find((x) => x.id === b.id)!;
        return interiors.lobby(b, { id: f.id, name: f.name, color: CATEGORY_COLOR[f.category], plans: f.plans, split: f.split, payouts: f.payouts, checked: f.checked ?? '26 Oct 2026', site: f.website.replace(/^https?:\/\/(www\.)?/, '') });
      }
      case 'airport': return b.id === 'airport-terminal' ? interiors.terminal(b) : interiors.tower(b);
      case 'stadium': {
        const p = b.root.position;
        return interiors.seat(b.id, 'Liquidation Arena · in the crowd', 'Prop firm tournaments on the big screens', new THREE.Vector3(p.x + 1.5, 4.0, p.z + 14.6), new THREE.Vector3(p.x, 3.6, p.z), [{ id: 'arena:live', label: 'Tournaments' }, { id: 'arena:publish', label: 'Publish one' }], 62);
      }
      case 'media':
        return interiors.seat(b.id, 'Media Theater · your seat', 'Press conferences and live events on the big screen', new THREE.Vector3(THEATER.x + 1.5, 5.4, THEATER.z + 18.5), new THREE.Vector3(THEATER.x, 9.2, THEATER.z), [{ id: 'media:theater', label: 'What’s on' }], 60);
      case 'place':
        if (b.id === 'golf-club') return interiors.seat(b.id, '100K+ Payouts Golf Club · terrace', 'Members only: the course from the clubhouse', new THREE.Vector3(CLUBHOUSE.x - 6.6, 2.3, CLUBHOUSE.z + 2), new THREE.Vector3(CLUBHOUSE.x - 40, 0.2, CLUBHOUSE.z - 6), [{ id: 'golf:lounge', label: 'Members’ lounge' }], 62, (k) => {
          k.rb(1.6, 0.06, 0.9, 0.03, k.mat(0xffffff), CLUBHOUSE.x - 7.6, 1.0, CLUBHOUSE.z + 1.4);
          k.add(new THREE.CylinderGeometry(0.06, 0.05, 0.2, 12), k.mat(0xf2c14e, { transparent: true, opacity: 0.85 }), CLUBHOUSE.x - 7.4, 1.18, CLUBHOUSE.z + 1.5);
        });
        if (b.id === 'statue-of-liberty') return interiors.statueCrown();
        if (b.id === 'yacht-marina') return interiors.seat(b.id, 'Marina Club · the deck', 'Yachts and superyachts on the pontoons', new THREE.Vector3(213, 3.2, 84), new THREE.Vector3(213, -1, 116), [], 62);
        if (b.id === 'container-port') return interiors.seat(b.id, 'Gantry crane cab', 'Above the container ship at the quay', new THREE.Vector3(283, 13.6, 117.6), new THREE.Vector3(240, 2, 124), [], 64);
        return null;
      default: return null;
    }
  }
  uiRoot.insertAdjacentHTML('beforeend', `<div class="interior-bar glass-card" id="interior-bar" hidden>
    <div class="ib-text"><span class="ib-eyebrow">INSIDE</span><b id="ib-title"></b><span id="ib-sub"></span></div>
    <div class="ib-actions" id="ib-actions"></div>
    <button class="btn btn-ghost" id="ib-leave">Leave <kbd>Esc</kbd></button>
  </div>`);
  const ibar = document.getElementById('interior-bar')!;
  document.getElementById('ib-leave')!.addEventListener('click', () => leave());
  const FAR = new THREE.Vector3(0, 5000, 0);
  function enter(id: string): boolean {
    const b = city.buildings.get(id);
    if (!b) return false;
    const ok = canEnter(b);
    if (ok === null) return false;
    if (ok === 'private') { rideToast('Private', `${b.name} hasn’t opened it to visitors.`); return false; }
    if (ok === 'members') { golfPanel.open('gate', 'The clubhouse is for members: show your club pass at the gate.'); return false; }
    // somewhere else while you're on the cable car / up at the summit: ride down first
    if (cableRide.busy() && b.kind !== 'founders') { cableRide.then(() => walkTo(id)); if (inside) leave(); return true; }
    // the summit is reached by riding the cable car up (with no character yet, you just get the view)
    if (b.kind === 'founders' && player.active && cableRide.state() !== 'top') {
      if (cableRide.busy()) return true;
      if (ride.current()) return false;
      if (!cableRide.nearStation()) { walkTo('founders-summit'); return true; }
      if (inside) leave();
      interactions.select(null, false);
      ui.hideCard();
      return cableRide.boardUp();
    }
    if (inside) leaveNow();
    if (ride.current()) return false;
    const it = interiorFor(b);
    if (!it) return false;
    player.stop();
    rig.setChase(null);
    rig.follow(null);
    interactions.select(null, false);
    ui.hideCard();
    ui.setTooltip(null);
    inside = it;
    rig.setInterior(it.cam);
    document.body.classList.add('interior');
    labelRenderer.domElement.style.visibility = 'hidden';
    ibar.hidden = false;
    document.getElementById('ib-title')!.textContent = it.title;
    document.getElementById('ib-sub')!.textContent = it.sub;
    const acts = document.getElementById('ib-actions')!;
    acts.replaceChildren(...it.actions.map((a) => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-gold';
      btn.textContent = a.label;
      btn.addEventListener('click', () => runAction(a.id));
      return btn;
    }));
    renderer.shadowMap.needsUpdate = true;
    if (b.kind === 'cafe') setTimeout(() => { if (inside === it) cafe.open(); }, 350);
    if (b.kind === 'reset') setTimeout(() => { if (inside === it) resetPanel.open('private'); }, 350);
    if (b.kind === 'lab') setTimeout(() => { if (inside === it) labPanel.open('experiments'); }, 350);
    if (b.kind === 'plaza') setTimeout(() => { if (inside === it) plazaPanel.open('shop'); }, 350);
    if (b.kind === 'floor') setTimeout(() => { if (inside === it) floorPanel.open(); }, 350);
    if (b.kind === 'hall') setTimeout(() => { if (inside === it) hallPanel.open('news'); }, 350);
    if (b.kind === 'founders') setTimeout(() => { if (inside === it) foundersPanel.open(); }, 350);
    if (b.kind === 'firm') { const f = FIRMS.find((x) => x.id === b.id)!; ui.showFirm(f, true, firmStats(f)); }
    return true;
  }
  function leaveNow() {
    if (!inside) return;
    inside.dispose();
    inside = null;
    rig.setInterior(null);
    document.body.classList.remove('interior');
    labelRenderer.domElement.style.visibility = '';
    ibar.hidden = true;
    renderer.shadowMap.needsUpdate = true;
  }
  function leave() {
    if (!inside) return;
    const id = inside.id;
    // leaving the summit means taking the cable car back down
    if (id === 'founders-summit' && cableRide.state() === 'top') {
      leaveNow();
      ui.hideCard();
      cableRide.boardDown();
      return;
    }
    leaveNow();
    ui.hideCard();
    const b = city.buildings.get(id);
    const p = player.active ? player.position : b?.root.position ?? rig.controls.target;
    rig.focusOn(new THREE.Vector3(p.x, 1, p.z), { zoom: 3.4, blend: 1, duration: 0.8 });
  }
  // Esc leaves the inside view (unless it's closing a panel first)
  let escForPanel = false;
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') escForPanel = document.body.classList.contains('media-open') || !!document.querySelector('#info-card.open'); }, true);
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !inside) return;
    if (escForPanel) { if (document.querySelector('#info-card.open')) ui.hideCard(); return; }
    leave();
  });

  /* ---------------- who's who on the members' lawn ---------------- */
  const golfTags = city.golf.groups.map((g) => {
    const el = document.createElement('div');
    el.className = 'golf-tag';
    el.innerHTML = g.firm
      ? `<b>${escapeHtml(g.firm.name)}</b><span>CEO & marketing${g.trader ? ` · with ${escapeHtml(g.trader)}` : ''}</span>`
      : `<b>${escapeHtml(g.trader ?? 'Member')}</b><span>100K+ trader</span>`;
    const o = new CSS2DObject(el);
    o.position.set(g.x, 3.4, g.z);
    o.center.set(0.5, 1);
    o.visible = false;
    scene.add(o);
    return { g, o };
  });
  let golfTagTimer = 0;
  function updateGolfTags(dt: number) {
    golfTagTimer -= dt;
    if (golfTagTimer > 0) return;
    golfTagTimer = 0.25;
    const ref = rig.chasing ? player.position : rig.controls.target;
    const on = rig.chasing || rig.camera.zoom > 3;
    for (const t of golfTags) t.o.visible = on && Math.hypot(t.g.x - ref.x, t.g.z - ref.z) < (rig.chasing ? 20 : 11);
  }

  /* ---------------- golf club: members only past the gate ---------------- */
  const lastOutside = new THREE.Vector3(GOLF_GATE.x + 3, 0, GOLF_GATE.z);
  const lastOutsideCar = new THREE.Vector3();
  let gateMsgAt = 0;
  let gateTimer = 0;
  function enforceGolfGate(dt: number) {
    gateTimer -= dt;
    if (gateTimer > 0 || !player.active) return;
    gateTimer = 0.1;
    const pass = getPass();
    const v = ride.current();
    const turnBack = () => {
      if (performance.now() < gateMsgAt) return;
      gateMsgAt = performance.now() + 6000;
      rideToast('Members only', 'The 100K+ Payouts Golf Club checks club passes at the members’ gate.');
      golfPanel.open('gate', 'You need a club pass to go past the members’ gate.');
    };
    if (v) {
      if (v.kind !== 'car') return;
      const o = v.obj.position;
      if (!inGolf(o.x, o.z)) { lastOutsideCar.copy(o); return; }
      if (pass || v.id.startsWith('golf-cart')) return;
      if (lastOutsideCar.lengthSq()) o.set(lastOutsideCar.x, o.y, lastOutsideCar.z);
      turnBack();
      return;
    }
    const pp = player.position;
    if (!inGolf(pp.x, pp.z)) { lastOutside.set(pp.x, 0, pp.z); return; }
    if (pass) return;
    player.teleport(lastOutside.x, lastOutside.z, Math.PI / 2); // face east, away from the course
    turnBack();
  }

  /* ---------------- walk view (third person) ---------------- */
  const walkSubjectPos = new THREE.Vector3();
  const walkSubject = () => {
    const p = player.position;
    walkSubjectPos.set(p.x, city.heightAt(p.x, p.z), p.z);
    return { pos: walkSubjectPos, heading: player.heading, kind: 'walk' as const, size: 0 };
  };
  function setWalkView(on: boolean) {
    if (on) {
      if (!player.active) { openCreator('create'); return; }
      if (ride.current() || cableRide.busy()) return;
      rig.setChase(walkSubject);
    } else if (rig.chasing && !ride.current() && !cableRide.busy()) {
      rig.setChase(null);
      const p = player.position;
      rig.focusOn(new THREE.Vector3(p.x, 1, p.z), { zoom: 3.4, blend: 1, duration: 0.8 });
    }
  }
  const PERSON = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="10" cy="4.6" r="2.2" fill="currentColor"/><path d="M10 7.6v5.2M10 9.6l-3.4 2.2M10 9.6l3.4 2.2M10 12.8l-2.6 4.6M10 12.8l2.6 4.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none"/></svg>';
  document.getElementById('reset-camera')!.insertAdjacentHTML('afterend', `<button class="icon-btn sq" id="walk-view" title="Walk view (V)" aria-label="Walk view" aria-pressed="false">${PERSON}</button>`);
  const walkViewBtn = document.getElementById('walk-view')!;
  /* ---------------- clean view: hide every panel, label and note to see just the city (H) ---------------- */
  const EYE = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M1.8 10s3-5.6 8.2-5.6S18.2 10 18.2 10s-3 5.6-8.2 5.6S1.8 10 1.8 10z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="10" r="2.4" fill="currentColor"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M1.8 10s3-5.6 8.2-5.6S18.2 10 18.2 10s-3 5.6-8.2 5.6S1.8 10 1.8 10z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="10" r="2.4" fill="currentColor"/><path d="M3 17L17 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  uiRoot.insertAdjacentHTML('beforeend', `<button class="clean-toggle glass-card" id="clean-toggle" type="button" aria-pressed="false" title="Hide all panels and labels (H)">${EYE_OFF}<span>Hide UI</span></button>`);
  const cleanBtn = document.getElementById('clean-toggle') as HTMLButtonElement;
  const setClean = (on: boolean) => {
    document.body.classList.toggle('clean', on);
    cleanBtn.setAttribute('aria-pressed', String(on));
    cleanBtn.innerHTML = on ? `${EYE}<span>Show UI</span>` : `${EYE_OFF}<span>Hide UI</span>`;
    cleanBtn.title = on ? 'Show panels and labels (H)' : 'Hide all panels and labels (H)';
    if (on) { ui.hideCard(); ui.setTooltip(null); }
  };
  cleanBtn.addEventListener('click', () => setClean(!document.body.classList.contains('clean')));
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyH' || e.repeat || creator.open || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '')) return;
    setClean(!document.body.classList.contains('clean'));
  });
  walkViewBtn.addEventListener('click', () => setWalkView(!rig.chasing));
  uiRoot.insertAdjacentHTML('beforeend', `<div class="view-chip glass-card" id="view-chip" hidden>
    <span class="vc-ico">${PERSON}</span>
    <div class="vc-text"><b>Walk view</b><span><kbd>W</kbd><kbd>S</kbd> walk · <kbd>A</kbd><kbd>D</kbd> turn · drag to look · scroll to zoom</span></div>
    <button class="btn btn-ghost" id="vc-city">City view <kbd>V</kbd></button>
  </div>`);
  const viewChip = document.getElementById('view-chip')!;
  document.getElementById('vc-city')!.addEventListener('click', () => setWalkView(false));
  window.addEventListener('keydown', (e) => {
    if (ride.current() || cableRide.busy() || creator.open || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '')) return;
    if (inside) return;
    if (e.code === 'KeyV' && !e.repeat) setWalkView(!rig.chasing);
    if (e.key === 'Escape' && rig.chasing && !document.body.classList.contains('media-open')) setWalkView(false);
  });
  let wasChasing = false;
  function syncViewClass() {
    const ch = rig.chasing;
    const walkV = ch && !ride.current() && !cableRide.busy() && !rig.interior;
    if (ch === wasChasing && viewChip.hidden === !walkV) return;
    wasChasing = ch;
    document.body.classList.toggle('chase', ch);
    viewChip.hidden = !walkV;
    walkViewBtn.setAttribute('aria-pressed', String(walkV));
  }

  /** Members without a payout record live in the Houses district. */
  let myHouseMine = false;
  function syncMyHouse() {
    const p = player.profile;
    const mp = profiles.mine();
    // members live here until their first verified payout builds a tower
    const isMember = p?.status === 'member' && !(mp && verifiedTotal(mp) > 0);
    let r = residents.find((x) => x.id === MY_HOUSE);
    const houseName = mp?.towerName ?? p?.name ?? 'Member';
    if (isMember && p) {
      if (!r) { r = { id: MY_HOUSE, name: houseName, country: mp?.country || 'FUNDEDCITY member', joined: 'Oct 2026', sector: mp?.sector ?? 'multi', mine: true }; residents.push(r); }
      r.name = houseName;
      if (mp) { r.country = mp.country || r.country; r.sector = mp.sector; }
      r.mine = true;
    } else if (r?.mine) {
      residents.splice(residents.indexOf(r), 1);
      r = undefined;
    }
    const wantMine = !!r?.mine;
    if (myHouseMine !== wantMine) {
      myHouseMine = wantMine;
      const nb = city.rebuildHouse(MY_HOUSE, wantMine);
      nb.name = wantMine && p ? houseName : 'Available house';
      interactions.tag(nb);
      renderer.shadowMap.needsUpdate = true;
    }
    const homePlace = places.find((pl) => pl.id === MY_HOUSE);
    if (wantMine && !homePlace) {
      const hb = city.buildings.get(MY_HOUSE)!;
      const f = Math.abs(hb.body.rotation.y) < 0.1 ? 1 : -1;
      places.push({ id: MY_HOUSE, name: 'Your house', kind: 'landmark', x: hb.root.position.x, z: hb.root.position.z + f * (HOUSE_PLOT.d / 2 + 1.4), r: 0.01 });
    } else if (!wantMine && homePlace) places.splice(places.indexOf(homePlace), 1);
    const hb = city.buildings.get(MY_HOUSE);
    if (hb && wantMine) hb.name = houseName;
  }

  function refreshPlayerUI() {
    syncMyHouse();
    const p = player.profile;
    ui.setPlayer(p ? { name: p.name, status: p.status, skin: p.config.skin, hair: p.config.hairColor, outfit: p.config.outfitColor } : null);
    ui.setDiscovery(player.discovered.size, places.length);
    ui.setPlaces(places.map((pl) => ({ id: pl.id, name: pl.name, group: pl.id === MY_HOUSE ? 'Home' : GROUP_LABEL[pl.kind], found: pl.id !== MY_HOUSE && player.discovered.has(pl.id) })));
    ui.setDiscovery(player.discovered.size, places.filter((pl) => pl.id !== MY_HOUSE).length);
    const pb = document.getElementById('ph-profile');
    if (pb) {
      const mp = profiles.mine();
      pb.hidden = !p;
      pb.textContent = !mp ? 'Build my tower · free' : verifiedTotal(mp) > 0 ? `My tower · ${towerTitle(verifiedTotal(mp)).split(' · ')[0]}` : 'My house · upload payouts';
    }
    const hint = document.getElementById('hint');
    if (hint) hint.textContent = p
      ? 'Click the ground or a building to walk · WASD to move · Drag to orbit'
      : 'Drag to orbit 360° · Right-drag or Shift+drag to pan · Scroll to zoom';
  }

  function saveProfile() {
    const p = player.profile;
    if (!p) return;
    const data = JSON.stringify({ ...p, discovered: [...player.discovered] });
    try {
      // members keep their character in this browser; guests only for this tab session
      if (p.status === 'member') { localStorage.setItem(PROFILE_KEY, data); sessionStorage.removeItem(PROFILE_KEY); }
      else sessionStorage.setItem(PROFILE_KEY, data);
    } catch { /* storage unavailable */ }
  }

  function loadProfile(): (PlayerProfile & { discovered: string[] }) | null {
    for (const store of ['localStorage', 'sessionStorage'] as const) {
      try {
        const raw = window[store].getItem(PROFILE_KEY);
        if (!raw) continue;
        const v = JSON.parse(raw);
        if (v && typeof v.name === 'string' && (v.status === 'guest' || v.status === 'member') && isValidConfig(v.config)) {
          return { name: v.name.slice(0, 20), status: v.status, email: typeof v.email === 'string' ? v.email : undefined, config: v.config, discovered: Array.isArray(v.discovered) ? v.discovered.filter((x: unknown) => typeof x === 'string') : [] };
        }
      } catch { /* ignore */ }
    }
    return null;
  }

  async function openCreator(mode: 'create' | 'edit' | 'signup') {
    if (creator.open) return;
    player.stop();
    const result = await creator.show({ mode, profile: player.profile });
    if (!result) return;
    if (player.active) {
      player.setProfile(result);
      if (result.status === 'member' && mode !== 'edit') {
        ui.pushActivity({ text: `<b>${escapeHtml(result.name)}</b> joined FUNDEDCITY as a member`, kind: 'join', ago: 'now' });
      }
    } else {
      player.spawn(result);
      ui.pushActivity({ text: `<b>${escapeHtml(result.name)}</b> arrived in <b>Capital Square</b>`, kind: 'join', ago: 'now' });
    }
    saveProfile();
    refreshPlayerUI();
    // new members go straight on to their trader profile (free): tower or house comes next
    if (result.status === 'member' && mode !== 'edit' && !profiles.mine()) profilePanel.open('profile', true);
  }

  function placeById(id: string) {
    return places.find((p) => p.id === id) ?? null;
  }

  function walkTo(id: string) {
    // on the cable car (or up at the summit): ride back down first, then go
    if (cableRide.busy()) {
      if (id === 'founders-summit') return;
      cableRide.then(() => walkTo(id));
      if (inside) leave();
      return;
    }
    // choosing a place while you're inside somewhere: step back out first, then go
    if (inside) leave();
    let place = placeById(id);
    if (!place && city.buildings.has(id)) {
      // houses aren't discovery places, but you can still walk to them
      const b = city.buildings.get(id)!;
      const facing = Math.abs(b.body.rotation.y) < 0.1 ? 1 : -1;
      place = { id, name: b.name, kind: 'landmark', x: b.root.position.x, z: b.root.position.z + facing * (HOUSE_PLOT.d / 2 + 1.4), r: 0.01 };
    }
    if (!place) return;
    if (!player.active) { openCreator('create'); return; }
    interactions.select(null);
    player.walkToPlace(place);
  }

  function selectOrVisit(id: string) {
    if (cableRide.busy() && !(cableRide.state() === 'top' && (id === 'founders-summit' || id.startsWith('founder-')))) {
      cableRide.then(() => selectOrVisit(id));
      if (inside) leave();
      return;
    }
    if (inside) leave();
    if (city.buildings.has(id)) return interactions.select(id);
    if (id === MY_HOUSE) return interactions.select(MY_HOUSE);
    const place = placeById(id);
    if (!place) return;
    if (player.active) player.walkToPlace(place);
    else rig.focusOn(new THREE.Vector3(place.x, 1, place.z), { zoom: 2.8, blend: 1, duration: 0.9 });
  }

  /* ---------------- payout demo ---------------- */
  let busy = false;
  /** Grow a tower with the payout sequence (toast, glow, construction, sparkles). */
  function celebrate(t: Trader, amount: number, prev: { level: TowerLevel; crown: Trader['crown'] }, after?: () => void, extra?: { onDataUpdate?: () => void; onLevelUp?: () => void }) {
    const willLevelUp = t.level !== prev.level || t.crown !== prev.crown;
    busy = true;
    ui.setDemoBusy(true);
    runPayout(
      {
        city, scene, trader: t,
        focus: (b) => focusBuilding(b, 2.2),
        makeToast: () => ui.makePayoutToast(amount),
        makeLevelChip: (lvl, crown) => ui.makeLevelUpChip(lvl, crown),
        setPinHeight: (y) => { if (pin.parent === city.buildings.get(t.id)?.root) pin.position.set(0, y + 1.4, 0); },
        upgrade: () => {
          const nb = city.rebuildTower(t);
          interactions.tag(nb);
          renderer.shadowMap.needsUpdate = true;
          if (pinName === t.name) attachPin(nb);
          return nb;
        },
        onDataUpdate: () => extra?.onDataUpdate?.(),
        onLevelUp: () => extra?.onLevelUp?.(),
        onDone: () => { busy = false; ui.setDemoBusy(false); after?.(); },
      },
      willLevelUp,
    );
  }
  function simulatePayout() {
    if (busy) return;
    const k = kareem();
    const prev = { ...k };
    k.payouts += PAYOUT;
    k.payoutCount += 1;
    k.worldRank = Math.max(1, k.worldRank - 16);
    k.level = (levelFor(k.payouts) || 1) as TowerLevel;
    k.crown = crownFor(k.payouts);
    const levelled = k.level !== prev.level || k.crown !== prev.crown;
    verifiedPayouts += PAYOUT;
    ui.pushActivity({ text: `<b>Kareem Capital</b> received a verified <b>${fmtUSD(PAYOUT)}</b> payout.`, kind: 'payout', ago: 'now' });
    interactions.select(KAREEM_ID, false);
    ui.showTrader(prev);
    celebrate(k, PAYOUT, prev, undefined, {
      onDataUpdate: () => {
        // phase 1: money lands (level shown as before until the tower is built)
        ui.updateTrader(levelled ? { ...k, level: prev.level, crown: prev.crown } : k, true);
        ui.renderLeaderboard(traders, KAREEM_ID);
        ui.setVerifiedPayouts(verifiedPayouts, true);
      },
      onLevelUp: () => {
        ui.updateTrader(k, true);
        const idx = searchIndex.find((s) => s.id === KAREEM_ID);
        if (idx) idx.kind = `Trader · ${towerTitle(k.payouts)}`;
      },
    });
  }

  function resetDemo() {
    clearPayoutEffects(scene);
    busy = false;
    ui.setDemoBusy(false);
    traders = traders.map((t) => (t.id === KAREEM_ID ? { ...createTraders().find((s) => s.id === KAREEM_ID)!, plot: { ...t.plot } } : t));
    const b = city.rebuildTower(kareem());
    renderer.shadowMap.needsUpdate = true;
    interactions.tag(b);
    if (pinName === b.name) attachPin(b);
    verifiedPayouts = CITY_STATS.verifiedPayouts;
    ui.setVerifiedPayouts(verifiedPayouts, false);
    ui.resetActivity();
    rankTraders();
    ui.renderLeaderboard(traders);
    const idx = searchIndex.find((s) => s.id === KAREEM_ID);
    if (idx) idx.kind = `Trader · ${towerTitle(kareem().payouts)}`;
    if (ui.currentCardId() === KAREEM_ID) ui.showTrader(kareem());
  }

  /* ---------------- registered traders: towers and houses ---------------- */
  const initialsOf = (n: string) => {
    const w = n.trim().split(/\s+/).filter(Boolean);
    return (w.length > 1 ? w[0][0] + w[1][0] : n.replace(/[^A-Za-z0-9]/g, '').slice(0, 2)).toUpperCase() || 'FC';
  };
  /** city rank and country rank follow verified payouts */
  function rankTraders() {
    const sorted = [...traders].sort((a, b) => b.payouts - a.payouts);
    const byCountry = new Map<string, number>();
    sorted.forEach((t, i) => {
      if (!t.demo) {
        t.worldRank = i + 1;
        const c = (byCountry.get(t.country) ?? 0) + 1;
        byCountry.set(t.country, c);
        t.countryRank = c;
      }
    });
  }
  const houseOf = new Map<string, string>(); // uid → house id (other registered traders without payouts)
  const sampleResidents = new Map(residents.map((r) => [r.id, { ...r }]));
  let firstSync = true;
  function setHouse(id: string, r: Resident | null) {
    const i = residents.findIndex((x) => x.id === id);
    if (i >= 0) residents.splice(i, 1);
    if (r) residents.push(r);
    const b = city.buildings.get(id);
    if (b) b.name = r?.name ?? 'Available house';
  }
  function syncRegistered(list: TraderProfilePublic[]) {
    const seen = new Set<string>();
    let changed = false;
    for (const p of list) {
      const id = 'u-' + p.uid;
      seen.add(id);
      const total = verifiedTotal(p);
      const mine = p.uid === profiles.uid;
      const existing = traders.find((t) => t.id === id);
      if (total > 0) {
        const t: Trader = existing ?? {
          id, name: p.towerName, initials: '', country: '', verified: true, payouts: 0, payoutCount: 0, highestAllocation: 0, worldRank: 0, countryRank: 0,
          level: 1, crown: null, sector: p.sector, plot: { x: 0, z: 0 },
        };
        const prev = { level: t.level, crown: t.crown, name: t.name, sector: t.sector, payouts: t.payouts };
        Object.assign(t, {
          name: p.towerName, initials: initialsOf(p.towerName), country: p.country || '—', verified: true, payouts: total,
          payoutCount: p.payouts.filter((r) => r.status === 'verified').length, highestAllocation: p.allocation,
          level: (levelFor(total) || 1) as TowerLevel, crown: crownFor(total), sector: p.sector, profile: p, mine, demo: false,
        });
        const hadTower = !!existing && city.buildings.has(id);
        const needsBuild = !hadTower || prev.sector !== t.sector || prev.name !== t.name;
        const levelled = hadTower && (prev.level !== t.level || prev.crown !== t.crown);
        if (needsBuild) {
          const res = city.placeTrader(t, (oid) => !!traders.find((x) => x.id === oid)?.demo && oid !== KAREEM_ID);
          if (!res) continue; // sector full of registered traders
          if (res.evicted) {
            traders = traders.filter((x) => x.id !== res.evicted);
            const pi = places.findIndex((x) => x.id === res.evicted);
            if (pi >= 0) places.splice(pi, 1);
            const si = searchIndex.findIndex((x) => x.id === res.evicted);
            if (si >= 0) searchIndex.splice(si, 1);
            if (ui.currentCardId() === res.evicted) interactions.select(null);
          }
          interactions.tag(res.building);
          if (!existing) traders.push(t);
          const b = res.building;
          const pl = places.find((x) => x.id === id);
          if (pl) { pl.x = b.root.position.x; pl.z = b.root.position.z; pl.name = t.name; }
          else places.push({ id, name: t.name, kind: 'trader', x: b.root.position.x, z: b.root.position.z, r: b.radius + 2.2 });
          if (mine && !firstSync && prev.payouts < total) {
            ui.pushActivity({ text: `<b>${escapeHtml(t.name)}</b> moved into a <b>${escapeHtml(towerTitle(total))}</b> tower`, kind: 'achievement', ago: 'now' });
            celebrate(t, total - prev.payouts, { level: t.level, crown: t.crown });
          } else if (!mine && !firstSync && !existing) {
            ui.pushActivity({ text: `<b>${escapeHtml(t.name)}</b> built a <b>${escapeHtml(towerTitle(total))}</b> in the ${SECTOR_LABEL[t.sector]} Sector`, kind: 'payout', ago: 'now' });
          }
        } else if (levelled) {
          if (!firstSync && !busy) {
            ui.pushActivity({ text: `<b>${escapeHtml(t.name)}</b> reached <b>${escapeHtml(towerTitle(total))}</b>`, kind: 'payout', ago: 'now' });
            celebrate(t, Math.max(0, total - prev.payouts), { level: prev.level, crown: prev.crown });
          } else {
            const nb = city.rebuildTower(t);
            interactions.tag(nb);
          }
        }
        // a tower replaces the house
        const hid = houseOf.get(p.uid);
        if (hid) { setHouse(hid, sampleResidents.get(hid) ?? null); houseOf.delete(p.uid); }
        changed = true;
      } else {
        if (existing) {
          city.removeTrader(id);
          traders = traders.filter((x) => x !== existing);
          const pi = places.findIndex((x) => x.id === id);
          if (pi >= 0) places.splice(pi, 1);
          changed = true;
        }
        if (!mine && !houseOf.has(p.uid)) {
          // take over a sample house (nearest the bridge first)
          const taken = new Set(houseOf.values());
          const free = city.houseSlots.find((h) => h.id !== MY_HOUSE && !taken.has(h.id) && !residents.find((r) => r.id === h.id)?.uid);
          if (free) {
            houseOf.set(p.uid, free.id);
            setHouse(free.id, { id: free.id, name: p.towerName, country: p.country || '—', joined: new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(p.joined || Date.now()), sector: p.sector, uid: p.uid });
            changed = true;
          }
        } else if (!mine) {
          const r = residents.find((x) => x.id === houseOf.get(p.uid));
          if (r) { r.name = p.towerName; r.country = p.country || r.country; r.sector = p.sector; const b = city.buildings.get(r.id); if (b) b.name = r.name; }
        }
      }
      // search
      const si = searchIndex.find((x) => x.id === id);
      if (total > 0) {
        if (si) { si.name = p.towerName; si.kind = `Trader · ${towerTitle(total)}`; }
        else searchIndex.push({ id, name: p.towerName, kind: `Trader · ${towerTitle(total)}` });
      } else if (si) searchIndex.splice(searchIndex.indexOf(si), 1);
    }
    // profiles that were deleted
    for (const t of [...traders]) if (t.id.startsWith('u-') && !seen.has(t.id)) { city.removeTrader(t.id); traders = traders.filter((x) => x !== t); changed = true; }
    for (const [uid, hid] of [...houseOf]) if (!seen.has('u-' + uid)) { setHouse(hid, sampleResidents.get(hid) ?? null); houseOf.delete(uid); }
    rankTraders();
    ui.renderLeaderboard(traders);
    const mineT = traders.find((t) => t.mine);
    const pinB = city.buildings.get(mineT?.id ?? KAREEM_ID);
    if (pinB && (!busy || mineT)) attachPin(pinB);
    refreshPlayerUI();
    if (changed) renderer.shadowMap.needsUpdate = true;
    const cardId = ui.currentCardId();
    const ct = cardId && traders.find((t) => t.id === cardId);
    if (ct && !busy) ui.showTrader(ct);
    firstSync = false;
  }
  function openMyProfile(tab: 'profile' | 'payouts' | 'tower' = 'profile') {
    if (!player.active) { openCreator('create'); return; }
    if (player.profile?.status !== 'member') { profilePanel.open('profile'); return; }
    profilePanel.open(profiles.mine() ? tab : 'profile', !profiles.mine());
  }
  const profilePanel = createProfilePanel(uiRoot, {
    store: profiles,
    isMember: () => player.profile?.status === 'member',
    characterName: () => player.profile?.name ?? null,
    onSignup: () => openCreator('signup'),
    openRules: () => bankPanel.open('rules'),
    walkHome: () => {
      const mineT = traders.find((t) => t.mine);
      if (mineT) walkTo(mineT.id);
      else walkTo(MY_HOUSE);
    },
    onSaved: () => syncRegistered(profiles.all()),
  });
  document.getElementById('ph-profile')!.addEventListener('click', () => openMyProfile(profiles.mine() ? 'tower' : 'profile'));
  profiles.onChange((list) => syncRegistered(list));
  void profiles.ready.then(() => syncRegistered(profiles.all()));

  /* ---------------- day / night / live ---------------- */
  const lighting = createLighting({
    scene, hemi, sun, city, renderer,
    onLiveTick: (t, n) => ui.setNycTime(t.label, n),
  });
  const MODE_KEY = 'fundedcity-light-mode';
  let saved: LightMode = 'live';
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === 'day' || v === 'night' || v === 'live') saved = v;
  } catch { /* storage unavailable: default to live */ }
  function setMode(m: LightMode, instant = false) {
    lighting.setMode(m, instant);
    ui.setMode(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* ignore */ }
  }
  // always show NYC time in the header, whatever the mode
  ui.setNycTime(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date()), 0);
  setMode(saved, true);
  setInterval(() => {
    if (lighting.mode !== 'live') ui.setNycTime(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date()), 0);
  }, 20_000);

  /* ---------------- NYC weather ---------------- */
  const weatherFx = createWeatherFx(scene);
  let wxChoice: WeatherChoice = 'live';
  let wxLive: WeatherState | null = null;
  let wxNote = '';
  let snowTarget = 0;
  let snowLevel = 0;
  const WX_KEY = 'fundedcity-weather';
  try {
    const v = localStorage.getItem(WX_KEY);
    if (v && ['live', 'clear', 'cloudy', 'rain', 'snow', 'storm', 'fog'].includes(v)) wxChoice = v as WeatherChoice;
  } catch { /* ignore */ }
  const wxTime = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const currentWeather = (): WeatherState => {
    if (wxChoice !== 'live') {
      const base = wxLive ?? WEATHER_SNAPSHOT;
      const tempC = wxChoice === 'snow' ? Math.min(base.tempC ?? 0, -1) : base.tempC;
      return { ...base, kind: wxChoice as WeatherKind, text: { clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', snow: 'Snow', storm: 'Thunderstorm', fog: 'Fog', partly: 'Partly cloudy', drizzle: 'Drizzle' }[wxChoice as WeatherKind], tempC, source: 'manual' };
    }
    return wxLive ?? WEATHER_SNAPSHOT;
  };
  const wxUi = createWeatherUi(uiRoot.querySelector('.topbar-right')!, (c) => {
    wxChoice = c;
    try { localStorage.setItem(WX_KEY, c); } catch { /* ignore */ }
    applyWeather(false);
  });
  function applyWeather(instant: boolean) {
    const w = currentWeather();
    lighting.setWeather(w.kind, instant);
    weatherFx.set(w.kind);
    snowTarget = w.kind === 'snow' ? 1 : 0;
    if (instant) { snowLevel = snowTarget; city.setSnow(snowLevel); }
    wxNote = wxLive ? `Live from Open-Meteo · ${wxTime.format(wxLive.updated)} ET` : `Snapshot ${wxTime.format(WEATHER_SNAPSHOT.updated)} ET · live weather loads when the page can reach Open-Meteo`;
    wxUi.render(w, sunTimes(), wxNote);
  }
  async function refreshWeather() {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 6000);
    const w = await fetchNycWeather(ctl.signal);
    clearTimeout(to);
    if (w) wxLive = w;
    applyWeather(false);
  }
  applyWeather(true);
  void refreshWeather();
  setInterval(refreshWeather, 10 * 60_000);
  setInterval(() => wxUi.render(currentWeather(), sunTimes(), wxNote), 60_000);

  /* ---------------- sun-following shadows ---------------- */
  const shadowCenter = new THREE.Vector3(1e9, 0, 0);
  const lastSunDir = new THREE.Vector3();
  let shadowExt = 0;
  function updateSunShadow() {
    const t = inside ? inside.cam.pos : rig.controls.target;
    const snap = 8;
    const cx = Math.round(t.x / snap) * snap;
    const cz = Math.round(t.z / snap) * snap;
    const ext = rig.chasing ? 120 : THREE.MathUtils.clamp(Math.round(200 / rig.camera.zoom / 10) * 10, 60, 250);
    const moved = cx !== shadowCenter.x || cz !== shadowCenter.z || ext !== shadowExt || lastSunDir.distanceToSquared(lighting.sunDir) > 1e-5;
    if (!moved) return;
    shadowCenter.set(cx, 0, cz);
    shadowExt = ext;
    lastSunDir.copy(lighting.sunDir);
    sun.position.copy(shadowCenter).addScaledVector(lighting.sunDir, 330);
    sun.target.position.copy(shadowCenter);
    sun.target.updateMatrixWorld();
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
    sc.near = 60; sc.far = 760;
    sc.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate = true;
  }

  /* ---------------- resize + loop ---------------- */
  const resize = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    rig.resize(w, h);
  };
  window.addEventListener('resize', resize);
  resize();

  let last = performance.now();
  let elapsed = 0;
  let frame = 0;
  const loop = (now: number) => {
    const dt = Math.max(0, Math.min(MAX_DT, (now - last) / 1000));
    last = now;
    elapsed += dt;
    frame++;
    if (busy || frame % 8 === 0) renderer.shadowMap.needsUpdate = true;
    updateTweens(dt);
    lighting.update(dt);
    rig.update();
    updateSunShadow();
    city.update(dt, elapsed);
    ride.update(dt, elapsed);
    cableRide.update(dt);
    city.stadium.update(dt, elapsed, tourList);
    inside?.update(dt, elapsed);
    guards.update(dt, elapsed, lighting.state().current);
    updateGuardPrompt(dt);
    updateGolfTags(dt);
    enforceGolfGate(dt);
    syncViewClass();
    weatherFx.update(dt, elapsed, inside?.indoor ? FAR : inside ? inside.cam.pos : rig.chasing ? player.position : rig.controls.target, rig.chasing ? 70 : (VIEW_H / rig.camera.zoom) * 1.6);
    lighting.setFlash(weatherFx.flash());
    if (Math.abs(snowTarget - snowLevel) > 0.002) {
      snowLevel += (snowTarget - snowLevel) * Math.min(1, dt * 0.6);
      city.setSnow(snowLevel);
    }
    player.update(dt, elapsed);
    interactions.update(dt, elapsed);
    // district labels fade out when zoomed in close
    const z = rig.camera.zoom;
    const op = rig.chasing ? 0 : THREE.MathUtils.clamp((3.2 - z) / 0.8, 0, 1);
    for (const el of districtLabels) el.style.opacity = String(op);
    renderer.render(scene, rig.view);
    labelRenderer.render(scene, rig.view);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  document.body.classList.add('ready');

  // first visit: open the character page; returning members (or a guest in the same tab) walk straight in
  const savedProfile = loadProfile();
  if (savedProfile) {
    player.setDiscovered(savedProfile.discovered.filter((id) => places.some((p) => p.id === id)));
    player.spawn(savedProfile);
    refreshPlayerUI();
    ui.pushActivity({ text: `Welcome back, <b>${escapeHtml(savedProfile.name)}</b>`, kind: 'join', ago: 'now' });
  } else {
    refreshPlayerUI();
    openCreator('create');
  }

  // handy for debugging / automated checks
  (window as unknown as Record<string, unknown>).__city = { radio, cableRide, walkTo, selectOrVisit, runAction, city, rig, media, ride, vehicles, enter, leave, inside: () => inside, labPanel, resetPanel, plazaPanel, floorPanel, hallPanel, foundersPanel, tournaments, golfPanel, guardPanel, guards, setWalkView, applyWeather, setWeather: (c: WeatherChoice) => { wxChoice = c; applyWeather(true); }, lighting, interactions, simulatePayout, resetDemo, traders: () => traders, renderer, setMode, player, nav, openCreator, places };
}

boot();
