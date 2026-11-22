// Khuntau · Sohrai Day: a small village story wrapped around the ring game.
// Walk the village, go into the mud house, drink handi, paint the wall, dress the animal,
// beat the tamak so the village dances, then face the animal at the khunt.
// Everything here is built in code on top of the main game's scene; the main file hands over what it needs as C.
export function initStory(C) {
  const { THREE, scene, camera, game, input, $, Mat, rand, lerp, clamp } = C;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const UP = V(0, 1, 0), t1 = V(), t2 = V(), t3 = V(), t4 = V(), ZERO = V();
  const now = () => performance.now() / 1000;

  /* ---------- saved progress ---------- */
  const KEY = 'khuntau-story';
  const save = { ch: 0, painted: [0, 0, 0], chosen: 0, oiled: 0, garland: 0, done: 0, day: '', td: null };
  try { Object.assign(save, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} };

  // the daily round: four village activities, each worth XP once a day, so there is a reason to walk in again tomorrow
  function today() { const d = new Date(), k = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); if (save.day !== k || !save.td) { save.day = k; save.td = { drum: 0, arch: 0, fish: 0, jale: 0, jv: [0, 0, 0] }; persist(); } return save.td; }
  const doneToday = () => { const t = today(); return t.drum + t.arch + t.fish + t.jale; };
  function daily(k, note) { const t = today(); if (t[k]) return; t[k] = 1; persist(); if (C.track) C.track('daily.' + k); C.addXp(15, note); C.markPlayedToday(); S.objKey = ''; setTimeout(() => pop('+15 XP', note), 1700); }

  /* ---------- words (one table, ready to translate) ---------- */
  const T_EN = {
    wake: [['Gogo', 'Johar! Wake up, the sun is already over the sal trees. Today is Khuntau, the big day of Sohrai.'], ['Gogo', 'First a sip of handi for strength. The pot is by the back wall.']],
    drank: [['Gogo', 'Good. Now go out and finish the wall. A house without its Sohrai painting is not ready for the festival.']],
    gogoIdle: [['Gogo', 'Eat a pitha if you are hungry. And do not let that animal horn you today.']],
    painted: [['Gogo', 'Now that is a Sohrai wall. Go to the cattle shed, the Majhi is waiting for you.']],
    majhi1: [['Majhi', 'Johar! The cattle ploughed for us all year. Today we thank them.'], ['Majhi', 'Choose which one we tie to the khunt.']],
    majhi2: [['Majhi', 'Now oil the horns and put the garland on. Gently.']],
    majhi3: [['Majhi', 'A fine animal. I will walk it to the khunt.'], ['Majhi', 'You wake the village. The tamak is waiting at the akhra.']],
    majhiIdle: [['Majhi', 'When the tamak speaks, nobody in this village can stand still.']],
    drumHow: [['Majhi', 'Hit when the note lands on the drum. Tamak on the left, tumdak on the right.']],
    drumWin: [['Majhi', 'Listen to that! The whole village is dancing.'], ['Majhi', 'Now the khunt. Snatch three pitha, and mind the horns.']],
    ringLose: [['Majhi', 'It got you this time. Dust yourself off and go again.']],
    ringWin: [['Gogo', 'Three pitha! And you can still walk. I am proud of you.'], ['Majhi', 'Sohrai is blessed this year. Johar!']],
    obj: ['Drink the handi', 'Paint the house wall', 'Go to the cattle shed', 'Beat the tamak', 'Go to the khunt', 'Sohrai Day done. Roam freely'],
  };
  const T_HI = {
    wake: [['गोगो', 'जोहार! उठो, सूरज साल के पेड़ों के ऊपर आ गया है। आज खुंटाउ है, सोहराय का बड़ा दिन।'], ['गोगो', 'पहले ताक़त के लिए हँड़िया का एक घूँट। घड़ा पीछे की दीवार के पास है।']],
    drank: [['गोगो', 'शाबाश। अब बाहर जाकर दीवार पूरी करो। सोहराय की चित्रकारी के बिना घर त्योहार के लिए तैयार नहीं होता।']],
    gogoIdle: [['गोगो', 'भूख लगे तो पीठा खा लेना। और आज उस जानवर के सींग से बचकर रहना।']],
    painted: [['गोगो', 'अब हुई न सोहराय की दीवार। गोहाल जाओ, माझी तुम्हारा इंतज़ार कर रहे हैं।']],
    majhi1: [['माझी', 'जोहार! मवेशियों ने साल भर हमारे लिए हल जोता। आज हम उनका धन्यवाद करते हैं।'], ['माझी', 'चुनो, खूँटे से किसे बाँधें।']],
    majhi2: [['माझी', 'अब सींगों पर तेल लगाओ और माला पहनाओ। आराम से।']],
    majhi3: [['माझी', 'बढ़िया जानवर है। मैं इसे खूँटे तक ले जाता हूँ।'], ['माझी', 'तुम गाँव को जगाओ। अखड़ा में तामाक तुम्हारा इंतज़ार कर रहा है।']],
    majhiIdle: [['माझी', 'जब तामाक बोलता है, तो इस गाँव में कोई चुप नहीं बैठ सकता।']],
    drumHow: [['माझी', 'जब गोला ढोल पर पहुँचे, तभी मारो। बाएँ तामाक, दाएँ तुमदाक।']],
    drumWin: [['माझी', 'सुनो! पूरा गाँव नाच रहा है।'], ['माझी', 'अब खूँटा। तीन पीठा छीनो, और सींगों से बचना।']],
    ringLose: [['माझी', 'इस बार उसने तुम्हें पकड़ लिया। धूल झाड़ो और फिर जाओ।']],
    ringWin: [['गोगो', 'तीन पीठा! और तुम अब भी चल पा रहे हो। मुझे तुम पर गर्व है।'], ['माझी', 'इस साल सोहराय शुभ है। जोहार!']],
    obj: ['हँड़िया पियो', 'घर की दीवार रंगो', 'गोहाल जाओ', 'तामाक बजाओ', 'खूँटे पर जाओ', 'सोहराय का दिन पूरा। घूमो'],
  };
  // every other on-screen line, English → Hindi. # stands for a number.
  const HI = {
    'ENTER': 'अंदर', 'DRINK': 'पियो', 'EAT': 'खाओ', 'REST': 'आराम', 'TALK': 'बात', 'GO OUT': 'बाहर', 'RING': 'खेलो', 'Play a round at the khunt': 'खूँटे पर एक दौर खेलो', 'PAINT': 'रंगो', 'CHOOSE': 'चुनो', 'OIL': 'तेल', 'GARLAND': 'माला', 'BEAT': 'बजाओ', 'START': 'शुरू', 'SHOOT': 'तीर', 'FISH': 'मछली', 'SING': 'गाओ',
    'Go into the house': 'घर के अंदर जाओ', 'Drink the handi': 'हँड़िया पियो', 'Eat a pitha': 'पीठा खाओ', 'Rest on the khatia': 'खटिया पर आराम करो', 'Talk to Gogo': 'गोगो से बात करो', 'Go outside': 'बाहर जाओ', 'Paint the wall': 'दीवार रंगो', 'Talk to the Majhi': 'माझी से बात करो',
    'Choose the animal': 'जानवर चुनो', 'Oil the horns': 'सींगों पर तेल लगाओ', 'Put on the garland': 'माला पहनाओ', 'Beat the tamak': 'तामाक बजाओ', 'Drum freely': 'मन से बजाओ', 'Start the Khuntau': 'खुंटाउ शुरू करो',
    'Shoot at the target': 'निशाने पर तीर चलाओ', 'Fish in the pond': 'तालाब में मछली पकड़ो', 'Sing at this house': 'इस घर पर गाओ',
    'Handi!': 'हँड़िया!', 'You feel strong': 'ताक़त आ गई', 'The plate is empty. Gogo will make more tomorrow.': 'थाली खाली है। गोगो कल और बनाएगी।', 'Pitha!': 'पीठा!', 'Sweet rice cake': 'चावल की मीठी रोटी', 'You rest a while': 'थोड़ा आराम किया',
    'One more to paint': 'एक और रंगना है', '# more to paint': '# और रंगने हैं', 'Oiled': 'तेल लग गया', 'The horns shine': 'सींग चमक रहे हैं', 'Garlanded': 'माला पहना दी', 'Marigolds for the day': 'आज के लिए गेंदे के फूल',
    'Play anything. The village follows your hands.': 'कुछ भी बजाओ। गाँव तुम्हारे हाथों के पीछे चलता है।', 'The village is dancing!': 'गाँव नाच रहा है!', 'The beat is yours': 'ताल तुम्हारी है', 'Need #. Try again': '# चाहिए। फिर कोशिश करो',
    'Sohrai Day complete': 'सोहराय का दिन पूरा', 'Johar!': 'जोहार!', 'Three more pitha': 'तीन और पीठा', 'Perfect': 'वाह', 'Good': 'ठीक', 'Early': 'जल्दी', 'Miss': 'चूक', 'Again': 'फिर से',
    'Tap on the green': 'हरे पर दबाओ', 'Drag to aim, let go to shoot': 'खींचकर निशाना लगाओ, छोड़कर तीर चलाओ', 'Drag to aim, let go to shoot. Or arrow keys and Space': 'खींचकर निशाना लगाओ, छोड़कर तीर चलाओ। या तीर वाली कुंजियाँ और Space', 'Hit!': 'लगा!', 'Bullseye!': 'बीचोंबीच!', 'Missed': 'चूक गया', 'Sharp eye': 'पक्की नज़र', 'Archery contest': 'तीरंदाज़ी',
    'Tap to cast': 'काँटा डालने के लिए दबाओ', 'Wait for the bite…': 'मछली का इंतज़ार…', 'PULL!': 'खींचो!', 'Too early': 'बहुत जल्दी', 'It got away': 'निकल गई', 'Got one!': 'पकड़ ली!', '# fish': '# मछली', 'A good catch': 'अच्छा शिकार', 'Fishing': 'मछली पकड़ना',
    'Listen…': 'सुनो…', 'Your turn': 'अब तुम', 'They give you pitha': 'उन्होंने पीठा दिया', 'They give you rice': 'उन्होंने चावल दिया', 'They give you handi': 'उन्होंने हँड़िया दी', 'Three houses sung': 'तीन घरों पर गा लिया', 'Tamak played': 'तामाक बजा लिया',
    'Today: archery contest': 'आज: तीरंदाज़ी', 'Today: catch fish at the pond': 'आज: तालाब में मछली पकड़ो', 'Today: sing at three houses (#/#)': 'आज: तीन घरों पर गाओ (#/#)', 'Today: beat the tamak': 'आज: तामाक बजाओ', 'All done today. Come back tomorrow': 'आज का सब पूरा। कल फिर आना',
    'Tie this one to the khunt': 'इसे खूँटे से बाँधो', 'Bringing…': 'ला रहे हैं…', 'Done': 'हो गया', 'Leave': 'छोड़ो', 'TAMAK': 'तामाक', 'TUMDAK': 'तुमदाक', 'Tap to go on': 'आगे के लिए दबाओ', 'Tap to close': 'बंद करने के लिए दबाओ', 'Enter to go on': 'Enter: आगे', 'Enter to close': 'Enter: बंद',
    // the ring finale (lines that live in index.html, translated while the story's ring runs)
    'Bonk!': 'धड़ाम!', 'Ouch!': 'आह!', 'Horned!': 'सींग लग गया!', 'Snatched!': 'झपट लिया!', 'Hoy!': 'होय!', 'Got it!': 'मिल गया!',
    '×# combo · Hoy!': '×# कॉम्बो · होय!', '×# combo · Johar!': '×# कॉम्बो · जोहार!', '×# combo · Got it!': '×# कॉम्बो · मिल गया!', '×# combo · Snatched!': '×# कॉम्बो · झपट लिया!',
    'Golden pitha! +#': 'सुनहरा पीठा! +#', 'Golden pitha!': 'सुनहरा पीठा!', 'Golden pitha! Worth # extra points.': 'सुनहरा पीठा! # अंक ज़्यादा।', 'Combo lost': 'कॉम्बो टूट गया',
    'Handi! +# life': 'हँड़िया! +# जान', 'Handi! Full of life +#': 'हँड़िया! जान पूरी, +#', 'Handi! Run over it for an extra life.': 'हँड़िया! एक और जान के लिए उस पर से दौड़ो।',
    'Get inside the dotted ring at the post first.': 'पहले खूँटे के पास बिंदुओं वाले घेरे में आओ।', 'Grab again without getting hit for a combo': 'बिना चोट खाए फिर झपटो, कॉम्बो बनेगा',
    'He saw the hide! Get ready to roll.': 'उसने खाल देख ली! लुढ़कने को तैयार रहो।', 'He is catching his breath. Grab now!': 'वह साँस ले रहा है। अभी झपटो!',
    'He is charging. Hit ROLL!': 'वह दौड़ा! लुढ़को दबाओ!', 'He is charging. Press Space to roll!': 'वह दौड़ा! Space दबाकर लुढ़को!',
    'HIDE to bait, ROLL to dodge, GRAB at the post': 'खाल से उकसाओ, लुढ़ककर बचो, खूँटे पर झपटो', 'Q bait · Space roll · E grab': 'Q उकसाओ · Space लुढ़को · E झपटो',
    'Drag the left side of the screen to move': 'चलने के लिए स्क्रीन का बायाँ हिस्सा खींचो', 'Tap HIDE to make him charge, then ROLL aside': 'खाल दबाओ ताकि वह दौड़े, फिर लुढ़ककर हटो',
    'Stun him on the post, then GRAB the pitha': 'उसे खूँटे से टकराओ, फिर पीठा झपटो', 'Move with WASD or the arrow keys': 'WASD या तीर वाली कुंजियों से चलो',
    'Press Q to wave the hide, then Space to roll aside': 'खाल हिलाने को Q, लुढ़कने को Space', 'Stun him on the post, then press E to grab': 'उसे खूँटे से टकराओ, फिर झपटने को E',
    'The bull is angry!': 'बैल गुस्से में है!', 'The bull is furious!': 'बैल आग-बबूला है!', 'The bull is raging!': 'बैल बेकाबू है!', 'Daring dodge!': 'जांबाज़ बचाव!', 'Close call!': 'बाल-बाल बचे!',
    'Snatch # pitha!': '# पीठा झपटो!', '# pitha! The village roars': '# पीठा! गाँव झूम उठा', 'New personal best! Keep going': 'नया सबसे अच्छा! चलते रहो',
    'HIDE': 'खाल', 'ROLL': 'लुढ़को', 'GRAB': 'झपटो',
    'Brown bull': 'भूरा बैल', 'White bull': 'सफ़ेद बैल', 'Black bull': 'काला बैल', 'Red cow': 'लाल गाय', 'White cow': 'सफ़ेद गाय', '# of #': '# / #',
  };
  // Santali (Ol Chiki): empty until a Santali speaker fills design/santali-strings.csv; `node tools/santali-import.mjs`
  // writes it in here. The language button offers Santali only once there is text. Never machine-translate this.
  /* SANTALI:BEGIN */
  const T_SAT = {};
  const SAT = {};
  /* SANTALI:END */
  const LANGS = ['en', 'hi', ...(Object.keys(SAT).length ? ['sat'] : [])];
  let LANG = 'en'; try { const l = localStorage.getItem('khuntau-lang'); if (LANGS.includes(l)) LANG = l; } catch (e) {}
  const T = new Proxy({}, { get: (_, k) => (LANG === 'hi' && T_HI[k]) || (LANG === 'sat' && T_SAT[k]) || T_EN[k] });
  function tr(s) {
    const table = LANG === 'hi' ? HI : LANG === 'sat' ? SAT : null;
    if (!table || s == null) return s; s = String(s); if (table[s]) return table[s];
    const nums = []; const key = s.replace(/\d+/g, m => { nums.push(m); return '#'; }); let i = 0;
    return table[key] ? table[key].replace(/#/g, () => nums[i++]) : s;
  }
  const langName = (l) => ({ en: 'English', hi: 'हिन्दी', sat: SAT['Santali'] || 'Santali' })[l];
  const toast = (a, ms) => C.toast(tr(a), ms), pop = (a, b) => C.pop(tr(a), tr(b)), hint = (a, ms) => C.hint(tr(a), ms);
  function applyLang() {
    $('pickOk').textContent = tr('Tie this one to the khunt'); $('padDone').textContent = tr('Done'); $('tapQuit').textContent = tr('Leave');
    $('padT').firstElementChild.firstChild.nodeValue = tr('TAMAK'); $('padU').firstElementChild.firstChild.nodeValue = tr('TUMDAK');
    $('langBtn').textContent = langName(LANGS[(LANGS.indexOf(LANG) + 1) % LANGS.length]); document.documentElement.classList.toggle('lang-sat', LANG === 'sat'); S.objKey = ''; S.label = '\u0000';
  }
  $('langBtn').addEventListener('click', () => { LANG = LANGS[(LANGS.indexOf(LANG) + 1) % LANGS.length]; try { localStorage.setItem('khuntau-lang', LANG); } catch (e) {} applyLang(); });

  /* ---------- places ---------- */
  const H = C.houses[0], hc = Math.cos(H.rot), hs = Math.sin(H.rot);
  const homeW = (lx, lz, out = V()) => out.set(H.x + lx * hc + lz * hs, 0, H.z - lx * hs + lz * hc);
  const polar = (a, r, out = V()) => out.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  const faceCentre = (p) => Math.atan2(-p.x, -p.z);
  const IN = V(0, -40, 0), ROOM = { W: 7, D: 5.6, H: 2.7 };
  const inW = (x, z, out = V()) => out.set(IN.x + x, IN.y, IN.z + z);
  const DOOR_OUT = homeW(0, H.d / 2 + 1.0), STEP_OUT = homeW(0, H.d / 2 + 2.6), YARD = homeW(0, H.d / 2 + 4.4);
  // the shed and the drum ground sit in the gaps between houses, between the ring and the house row
  const GA = 0.35 + (2 * Math.PI / 9) * 3.5, AA = 0.35 + (2 * Math.PI / 9) * 6.5;
  const GOHAL = polar(GA, 19), AKHRA = polar(AA, 19.4);
  const FACE_Y = 1.45;
  const gap = (i) => 0.35 + (2 * Math.PI / 9) * i;
  const ARCH = polar(gap(1.5), 18.5), TARGET = polar(gap(1.5), 25.5), POND = polar(gap(4.5), 24.6), FSTAND = polar(gap(4.5), 20.7);
  const JALE = [2, 5, 7].map(i => { const h = C.houses[i], f = h.d / 2 + 1.1; return { stand: V(h.x + Math.sin(h.rot) * f, 0, h.z + Math.cos(h.rot) * f), yaw: h.rot + Math.PI }; });
  const RING_SPOT = V(0, 0, -3.5);
  const VILLAGE_R = 30.5;

  /* ---------- state ---------- */
  const S = { on: false, built: false, tap: false, mode: 'walk', inside: false, camYaw: 0, lookT: -9, lock: 0, dlg: null, near: null, act: false, tipsy: 0, boost: 0, focus: null, label: '', objKey: '', bullReact: 0, sat: 0 };
  const dance = { energy: 0, phase: 0, target: 0, hop: 0 };
  const W = {}; // world objects built on first start
  let mother = null, majhi = null, dancers = [];

  /* ---------- small builders ---------- */
  const vcol = (g, hex) => { const k = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([k.r, k.g, k.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }; // for one-draw vertex-coloured props
  const mesh = (geo, mat, x = 0, y = 0, z = 0, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (parent) parent.add(m); return m; };
  function motifTex(kind) {
    return C.canvasTex(256, 256, (c, w) => {
      const paste = '#f6eedd', ochre = '#b5462a', black = '#2b2925';
      c.lineCap = c.lineJoin = 'round'; c.translate(w / 2, w / 2);
      const dots = (r, n, col, s) => { c.fillStyle = col; for (let i = 0; i < n; i++) { const a = i / n * 6.283; c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r, s, 0, 7); c.fill(); } };
      if (kind === 0) { // sun flower
        for (let i = 0; i < 12; i++) { c.save(); c.rotate(i / 12 * 6.283); c.fillStyle = i % 2 ? ochre : paste; c.beginPath(); c.ellipse(62, 0, 34, 13, 0, 0, 7); c.fill(); c.restore(); }
        c.fillStyle = black; c.beginPath(); c.arc(0, 0, 30, 0, 7); c.fill(); c.fillStyle = paste; c.beginPath(); c.arc(0, 0, 18, 0, 7); c.fill();
        dots(108, 22, paste, 5);
      } else if (kind === 1) { // the bull
        c.fillStyle = ochre; c.strokeStyle = paste; c.lineWidth = 8;
        c.beginPath(); c.roundRect(-78, -34, 140, 70, 26); c.fill(); c.stroke();
        c.beginPath(); c.arc(-52, -40, 22, Math.PI, 0); c.fill(); c.stroke(); // hump
        c.beginPath(); c.roundRect(52, -52, 46, 44, 14); c.fill(); c.stroke(); // head
        c.lineWidth = 9; c.beginPath(); c.moveTo(62, -52); c.quadraticCurveTo(50, -92, 80, -100); c.moveTo(90, -52); c.quadraticCurveTo(110, -86, 86, -104); c.stroke(); // horns
        c.lineWidth = 11; for (const x of [-60, -30, 20, 46]) { c.beginPath(); c.moveTo(x, 36); c.lineTo(x, 84); c.stroke(); }
        c.lineWidth = 6; c.beginPath(); c.moveTo(-78, -20); c.quadraticCurveTo(-108, 0, -98, 40); c.stroke();
        c.fillStyle = paste; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(-50 + i * 24, 2 + (i % 2) * 10, 6, 0, 7); c.fill(); }
        c.fillStyle = black; c.beginPath(); c.arc(82, -34, 5, 0, 7); c.fill();
      } else { // plant with a bird
        c.strokeStyle = paste; c.lineWidth = 8; c.beginPath(); c.moveTo(0, 104); c.lineTo(0, -60); c.stroke();
        for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { c.save(); c.translate(0, 84 - i * 32); c.rotate(s * -0.7); c.fillStyle = i % 2 ? ochre : paste; c.beginPath(); c.ellipse(s * 34, 0, 30, 11, 0, 0, 7); c.fill(); c.restore(); }
        c.fillStyle = ochre; c.strokeStyle = paste; c.lineWidth = 6; c.beginPath(); c.ellipse(4, -82, 30, 18, -0.3, 0, 7); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(30, -90); c.lineTo(54, -96); c.lineTo(32, -80); c.fill(); c.stroke();
        c.fillStyle = black; c.beginPath(); c.arc(16, -88, 4, 0, 7); c.fill();
        c.beginPath(); c.moveTo(-22, -76); c.lineTo(-58, -66); c.lineTo(-52, -92); c.closePath(); c.fillStyle = paste; c.fill();
      }
    });
  }
  const outlineTex = C.canvasTex(128, 128, (c, w) => {
    c.strokeStyle = 'rgba(246,238,221,.9)'; c.lineWidth = 5; c.setLineDash([10, 9]); c.strokeRect(10, 10, w - 20, w - 20);
    c.setLineDash([]); c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(44, 88); c.lineTo(80, 44); c.stroke(); c.beginPath(); c.arc(86, 38, 9, 0, 7); c.fillStyle = 'rgba(246,238,221,.9)'; c.fill();
  });

  function build() {
    if (S.built) return; S.built = true;
    const clay = Mat({ color: 0xa4552c, roughness: 0.85 }), wood = Mat({ color: 0x6a5541, roughness: 0.9 }), straw = Mat({ color: 0xcaa858, roughness: 1 });
    const dark = Mat({ color: 0x2a1a12, roughness: 1 }), leaf = Mat({ color: 0x4f7d35, roughness: 0.8, side: THREE.DoubleSide });
    const potGeo = C.handi.children[0].geometry, cakeGeo = C.pitha.userData.disc.geometry, cakeMat = C.pitha.userData.disc.material;

    /* --- the wall to paint: two motifs by the door, one on the side wall --- */
    W.spots = [];
    const hg = new THREE.Group(); hg.position.set(H.x, 0, H.z); hg.rotation.y = H.rot; scene.add(hg);
    const defs = [[-(H.w / 2 - 1.05), H.d / 2 + 0.03, 0], [H.w / 2 - 1.05, H.d / 2 + 0.03, 0], [H.w / 2 + 0.03, 0, Math.PI / 2]];
    defs.forEach(([lx, lz, ry], i) => {
      const geo = new THREE.PlaneGeometry(1.25, 1.25);
      const mk = (map, op) => { const m = mesh(geo, new THREE.MeshBasicMaterial({ map, transparent: true, opacity: op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }), lx, 1.32, lz, hg); m.rotation.y = ry; return m; };
      const outline = mk(outlineTex, 0.75), art = mk(motifTex(i), 0); art.visible = false; art.renderOrder = 1;
      const stand = ry ? homeW(lx + 0.95, 0) : homeW(lx, lz + 0.95), look = ry ? homeW(lx, 0) : homeW(lx, lz);
      W.spots.push({ outline, art, stand, look, k: 0 });
    });

    /* --- inside the mud house (kept under the ground, shown only when you are in it) --- */
    const g = new THREE.Group(); g.position.copy(IN); g.visible = false; scene.add(g); W.room = g;
    const { W: RW, D: RD, H: RH } = ROOM;
    const floorTex = C.canvasTex(256, 256, (c, w) => { // cow-dung washed floor with the sweeping arcs left by the hand
      c.fillStyle = '#7d6247'; c.fillRect(0, 0, w, w); c.strokeStyle = 'rgba(60,44,30,.35)'; c.lineWidth = 3;
      for (let y = 0; y < w + 40; y += 26) for (let x = -20; x < w + 40; x += 52) { c.beginPath(); c.arc(x + (y / 26 % 2) * 26, y, 24, Math.PI, 0); c.stroke(); }
    }, 3);
    mesh(new THREE.PlaneGeometry(RW, RD).rotateX(-Math.PI / 2), Mat({ map: floorTex, roughness: 1 }), 0, 0, 0, g);
    const wt = C.wallTex.clone(); wt.needsUpdate = true; wt.wrapS = THREE.RepeatWrapping; wt.repeat.set(3, 1);
    const wallM = Mat({ map: wt, roughness: 0.95 });
    mesh(new THREE.PlaneGeometry(RW, RH), wallM, 0, RH / 2, -RD / 2, g);
    mesh(new THREE.PlaneGeometry(RD, RH).rotateY(Math.PI / 2), wallM, -RW / 2, RH / 2, 0, g);
    mesh(new THREE.PlaneGeometry(RD, RH).rotateY(-Math.PI / 2), wallM, RW / 2, RH / 2, 0, g);
    mesh(new THREE.BoxGeometry(60, 30, 60), new THREE.MeshBasicMaterial({ color: 0x100905, side: THREE.BackSide, fog: false }), 0, 8, 0, g);
    // doorway of light on the right wall
    const dz = 1.15;
    mesh(new THREE.PlaneGeometry(1.0, 1.9).rotateY(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff1cf, fog: false }), RW / 2 - 0.02, 0.95, dz, g);
    const dglow = new THREE.Sprite(new THREE.SpriteMaterial({ map: C.glowTex, color: 0xffe2a8, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); dglow.scale.set(3.2, 3.6, 1); dglow.position.set(RW / 2 - 0.3, 1.0, dz); g.add(dglow);
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.1, 2.0, 0.12), wood, RW / 2 - 0.04, 1.0, dz + s * 0.56, g);
    mesh(new THREE.BoxGeometry(0.1, 0.12, 1.24), wood, RW / 2 - 0.04, 2.0, dz, g);
    // painting on the back wall and a lamp in its niche
    const art = mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: motifTex(1), transparent: true, depthWrite: false }), -0.4, 1.55, -RD / 2 + 0.02, g); art.renderOrder = 1;
    mesh(new THREE.CylinderGeometry(0.1, 0.06, 0.06, 10), clay, 2.9, 1.42, -RD / 2 + 0.14, g);
    mesh(new THREE.BoxGeometry(0.5, 0.05, 0.2), wood, 2.9, 1.36, -RD / 2 + 0.12, g);
    W.lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: C.glowTex, color: 0xffb04a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); W.lamp.position.set(2.9, 1.56, -RD / 2 + 0.16); g.add(W.lamp);
    // khatia (rope bed)
    const kx = -2.1, kz = -1.75;
    const weave = C.canvasTex(64, 64, (c, w) => { c.fillStyle = '#d9c79a'; c.fillRect(0, 0, w, w); c.strokeStyle = '#8f7a4c'; c.lineWidth = 3; for (let i = -64; i < 128; i += 10) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 64, 64); c.moveTo(i + 64, 0); c.lineTo(i, 64); c.stroke(); } }, 3);
    mesh(new THREE.BoxGeometry(2.0, 0.07, 1.0), wood, kx, 0.46, kz, g);
    mesh(new THREE.PlaneGeometry(1.86, 0.86).rotateX(-Math.PI / 2), Mat({ map: weave, roughness: 1 }), kx, 0.5, kz, g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.5, 6), wood, kx + sx * 0.93, 0.25, kz + sz * 0.43, g);
    mesh(new THREE.BoxGeometry(0.5, 0.12, 0.7), Mat({ color: 0xb8302a, roughness: 0.9 }), kx - 0.66, 0.57, kz, g);
    // chulha (clay stove) with a pot on it
    const cx = 2.35, cz = -2.1;
    mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.34, 14), Mat({ color: 0x7a4a2c, roughness: 1 }), cx, 0.17, cz, g);
    mesh(new THREE.CircleGeometry(0.3, 14).rotateX(-Math.PI / 2), dark, cx, 0.345, cz, g);
    const cook = mesh(potGeo, Mat({ color: 0x3a2a22, roughness: 0.9 }), cx, 0.33, cz, g); cook.scale.setScalar(1.25);
    W.ember = new THREE.Sprite(new THREE.SpriteMaterial({ map: C.glowTex, color: 0xff7a2a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); W.ember.position.set(cx, 0.3, cz + 0.42); g.add(W.ember);
    // the handi, on its straw ring
    const hx = -0.25, hz = -2.2;
    W.hpot = mesh(potGeo, clay, hx, 0.06, hz, g); W.hpot.scale.setScalar(1.7);
    const ringS = mesh(new THREE.TorusGeometry(0.26, 0.06, 6, 16), straw, hx, 0.05, hz, g); ringS.rotation.x = Math.PI / 2;
    const band = mesh(new THREE.TorusGeometry(0.388, 0.022, 6, 20), Mat({ color: 0xf2e8d0, roughness: 0.6 }), hx, 0.385, hz, g); band.rotation.x = Math.PI / 2;
    const lf = mesh(new THREE.CircleGeometry(0.24, 8).rotateX(-Math.PI / 2), leaf, hx, 0.8, hz, g); // sal-leaf lid
    W.hlid = lf;
    const small = mesh(potGeo, clay, hx - 0.75, 0, hz + 0.1, g); small.scale.setScalar(1.05);
    // pitha on a leaf plate, on a low stool
    const px = 0.95, pz = -2.2;
    mesh(new THREE.BoxGeometry(0.62, 0.06, 0.46), wood, px, 0.22, pz, g);
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.06, 0.2, 0.42), wood, px + sx * 0.25, 0.1, pz, g);
    mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.015, 12), leaf, px, 0.262, pz, g);
    W.cakes = [[-0.08, 0], [0.1, 0.05], [0, -0.1]].map(([ox, oz], i) => { const m = mesh(cakeGeo, cakeMat, px + ox, 0.3 + i * 0.012, pz + oz, g); m.scale.setScalar(0.62); return m; });
    // bandi (grain store wound from straw rope)
    const bx = -2.85, bz = 0.75;
    const bandi = mesh(new THREE.SphereGeometry(0.62, 12, 10), straw, bx, 0.7, bz, g); bandi.scale.set(1, 1.15, 1);
    for (let i = 0; i < 6; i++) { const r = mesh(new THREE.TorusGeometry(Math.sqrt(Math.max(0.02, 0.385 - Math.pow((i - 2.5) * 0.2, 2))) * 1.0, 0.03, 5, 16), Mat({ color: 0xa88a44, roughness: 1 }), bx, 0.7 + (i - 2.5) * 0.23, bz, g); r.rotation.x = Math.PI / 2; }
    W.inside = {
      box: { x: kx, z: kz, hx: 1.05, hz: 0.6 },
      circles: [[cx, cz, 0.62], [hx, hz, 0.5], [hx - 0.75, hz + 0.1, 0.36], [px, pz, 0.42], [bx, bz, 0.72]],
      restAt: inW(kx + 0.84, kz), // lying on the khatia: feet at this end, head on the red pillow
      handi: inW(hx, hz), pitha: inW(px, pz), bed: inW(kx, kz), door: inW(RW / 2 - 0.45, dz), spawn: inW(RW / 2 - 1.2, dz), mother: inW(1.75, -1.2), bedSide: inW(kx + 0.2, kz + 1.05),
    };

    /* --- gohal: the cattle shed --- */
    const sg = new THREE.Group(); sg.position.copy(GOHAL); sg.rotation.y = faceCentre(GOHAL); scene.add(sg);
    // floor: straw bedding, trampled to mud where the animal stands, hoof marks, loose straws
    const shedFloor = C.canvasTex(256, 256, (c, w) => { const m = w / 5.4;
      c.fillStyle = '#c3a55e'; c.fillRect(0, 0, w, w);
      const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, 1.5 * m); g.addColorStop(0, 'rgba(110,84,52,.75)'); g.addColorStop(1, 'rgba(110,84,52,0)'); c.fillStyle = g; c.fillRect(0, 0, w, w);
      for (let i = 0; i < 40; i++) { const x = w / 2 + rand(-1, 1) * 0.5 * m, y = w / 2 + rand(-1.2, 1.2) * m; c.fillStyle = 'rgba(70,52,34,.28)'; c.beginPath(); c.ellipse(x, y, 2.5, 3.8, rand(0, 3), 0, 6.28); c.fill(); }
      c.lineWidth = 1.3; for (let i = 0; i < 700; i++) { const x = rand(0, w), y = rand(0, w), a = rand(0, 6.28), l = rand(5, 14), d = Math.hypot(x - w / 2, y - w / 2) / (w / 2);
        if (d < 0.45 && Math.random() < 0.7) continue; c.strokeStyle = ['#e2c779', '#a88a45', '#d6b765', '#8e7238'][i % 4]; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
      const e = c.createRadialGradient(w / 2, w / 2, w * 0.4, w / 2, w / 2, w * 0.5); e.addColorStop(0, 'rgba(0,0,0,1)'); e.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalCompositeOperation = 'destination-in'; c.fillStyle = e; c.fillRect(0, 0, w, w); c.globalCompositeOperation = 'source-over'; });
    mesh(new THREE.CircleGeometry(2.7, 24).rotateX(-Math.PI / 2), Mat({ map: shedFloor, roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 0, 0.02, 0, sg);
    const roof = mesh(new THREE.ConeGeometry(1, 1.3, 4, 1, true), Mat({ map: C.thatchTex, roughness: 1, side: THREE.DoubleSide, transparent: true }), 0, 3.0, 0, sg); W.shedRoof = roof; roof.rotation.y = Math.PI / 4; roof.scale.set(4.1, 1, 3.5); roof.castShadow = true;
    { // everything else in the shed is one vertex-coloured draw (it was two): frame, wattle, trough, basin, hay, tools
      const parts = [], put = (g, hex, x, y, z, ry = 0) => { const o = new THREE.Mesh(vcol(g, hex)); o.position.set(x, y, z); o.rotation.y = ry; sg.add(o); parts.push(o); return o; };
      const WOOD = 0x6a5541, DARK = 0x4e3c2c, BAMBOO = 0xb89a5a, STRAW = 0xcaa858, ROPE = 0xc9b07a;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(new THREE.CylinderGeometry(0.09, 0.11, 2.4, 7), WOOD, sx * 2.1, 1.2, sz * 1.7);
      // no beams or rafters: the roof fades out whenever you are close, so anything under it only ever showed as bars
      // across the view at eye level
      // the old rails, and a woven bamboo wattle wall behind them at the back
      for (let i = 0; i < 2; i++) { put(new THREE.CylinderGeometry(0.035, 0.035, 4.2, 5).rotateZ(Math.PI / 2), STRAW, 0, 0.55 + i * 0.5, -1.7); put(new THREE.CylinderGeometry(0.035, 0.035, 3.4, 5).rotateX(Math.PI / 2), STRAW, -2.1, 0.55 + i * 0.5, 0); }
      for (let k = 0; k < 30; k++) put(new THREE.BoxGeometry(0.07, rand(1.15, 1.3), 0.025), k % 2 ? BAMBOO : 0xa48848, -1.95 + k * 0.135, 0.62, -1.78);
      for (let i = 0; i < 4; i++) put(new THREE.BoxGeometry(4.0, 0.045, 0.03), 0x9c7f45, 0, 0.2 + i * 0.3, -1.78 + (i % 2 ? 0.02 : -0.02));
      // feed trough: a hollowed log with fodder in it
      put(new THREE.CylinderGeometry(0.27, 0.27, 1.5, 9, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2), DARK, -1.0, 0.3, 1.2);
      put(new THREE.BoxGeometry(1.3, 0.05, 0.3), 0x8a9a4a, -1.0, 0.27, 1.2); for (let k = 0; k < 9; k++) put(new THREE.BoxGeometry(rand(0.2, 0.4), 0.02, 0.025), k % 2 ? 0x9caa52 : STRAW, -1.0 + rand(-0.55, 0.55), 0.3, 1.2 + rand(-0.1, 0.1), rand(0, 3));
      for (const s of [-0.6, 0.6]) put(new THREE.BoxGeometry(0.1, 0.18, 0.5), WOOD, -1.0 + s, 0.09, 1.2);
      // clay water basin
      put(new THREE.CylinderGeometry(0.36, 0.26, 0.24, 12), 0x9a4c2a, 1.05, 0.12, 1.25); put(new THREE.CylinderGeometry(0.31, 0.31, 0.02, 12), 0x5d7a86, 1.05, 0.22, 1.25);
      // hay heaped in the back corner: a mound of loose straws at every angle (spheres read as boulders)
      for (let k = 0; k < 90; k++) { const a = rand(0, 6.28), r = Math.sqrt(rand(0, 1)), h = (1 - r * r) * 0.75 * rand(0.6, 1), o = put(new THREE.BoxGeometry(rand(0.35, 0.6), 0.03, 0.035), [0xd2b264, 0xc4a356, 0xdcbd6e, 0xb89a4e][k % 4], 1.3 + Math.cos(a) * r * 0.75, 0.04 + h, -1.0 + Math.sin(a) * r * 0.6); o.rotation.set(rand(-0.5, 0.5), rand(0, 3.14), rand(-0.6, 0.6)); }
      put(new THREE.SphereGeometry(0.62, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.95, 0.78), 0xbe9f50, 1.3, 0.0, -1.0); // the heap's body under the loose straws
      // tether peg with the rope coiled at its foot; a rake leaning on the back post (a coil hung on a post sat right
      // behind the bull's rump from both camera angles and read as something stuck to him)
      put(new THREE.CylinderGeometry(0.05, 0.06, 0.4, 6), DARK, 0.25, 0.2, 1.55);
      for (let i = 0; i < 3; i++) put(new THREE.TorusGeometry(0.16 + i * 0.03, 0.025, 4, 12).rotateX(Math.PI / 2), ROPE, 0.25 + i * 0.02, 0.03 + i * 0.03, 1.55);
      { const r = put(new THREE.CylinderGeometry(0.025, 0.03, 1.7, 5), WOOD, 2.0, 0.82, -1.45); r.rotation.set(0.12, 0, -0.18);
        const h = put(new THREE.BoxGeometry(0.42, 0.05, 0.05), DARK, 2.15, 0.06, -1.55); for (let k = 0; k < 5; k++) put(new THREE.BoxGeometry(0.02, 0.12, 0.02), DARK, 1.97 + k * 0.09, 0.05, -1.52); }
      sg.updateMatrixWorld(true); const merged = C.bakeStatic(parts, Mat({ vertexColors: true, flatShading: true, roughness: 0.95 })); if (merged) merged.castShadow = true;
    }
    const oil = mesh(potGeo, clay, 1.5, 0, 1.5, sg); oil.scale.setScalar(0.8); // the oil pot
    W.gohalYaw = sg.rotation.y;
    W.gF = V(Math.sin(W.gohalYaw), 0, Math.cos(W.gohalYaw)); W.gR = V(Math.cos(W.gohalYaw), 0, -Math.sin(W.gohalYaw));
    W.gStand = GOHAL.clone().addScaledVector(W.gF, 2.3);
    W.majhiPos = GOHAL.clone().addScaledVector(W.gF, 2.6).addScaledVector(W.gR, 2.4);

    /* --- akhra: the drum ground --- */
    W.aIn = V(-AKHRA.x, 0, -AKHRA.z).normalize(); W.aR = V(W.aIn.z, 0, -W.aIn.x);
    W.drumStand = AKHRA.clone().addScaledVector(W.aIn, -0.85).addScaledVector(W.aR, 0.35);
    { // the swept dance floor remembers its use: broom strokes, a worn band where the dancers' line shuffles, a trodden
      // patch where the drummer stands. Painted from the real positions (dancers stand on r = 15.4, see placeCrowd).
      const AC = AKHRA.clone().addScaledVector(W.aIn, 1.6), AR = 4.2;
      const floorTex = C.canvasTex(512, 512, (c, w) => {
        const px = (x, z) => [(0.5 + (x - AC.x) / (2 * AR)) * w, (0.5 + (z - AC.z) / (2 * AR)) * w], m = w / (2 * AR);
        c.fillStyle = '#a58a66'; c.fillRect(0, 0, w, w);
        for (let i = 0; i < 40; i++) { const x = rand(0, w), y = rand(0, w), r = rand(20, 70), g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, i % 2 ? 'rgba(130,104,74,.35)' : 'rgba(190,168,132,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
        // broom strokes: fans of short curved lines
        c.lineWidth = 1.2; for (let f = 0; f < 34; f++) { const x = rand(0, w), y = rand(0, w), a0 = rand(0, 6.28); for (let k = 0; k < 7; k++) { c.strokeStyle = k % 2 ? 'rgba(120,96,68,.35)' : 'rgba(200,180,146,.4)'; c.beginPath(); c.arc(x, y, 18 + k * 3, a0, a0 + rand(0.5, 0.9)); c.stroke(); } }
        // the dancers' line: a darker trodden band with footprints, along the arc they sway on
        const R0 = 15.4, half = 6.2 / R0; c.lineCap = 'round';
        for (const [lw, col] of [[1.5, 'rgba(98,76,52,.28)'], [0.8, 'rgba(84,64,44,.3)']]) { c.lineWidth = lw * m; c.strokeStyle = col; c.beginPath(); for (let k = 0; k <= 40; k++) { const a = AA - half + 2 * half * k / 40, [x, y] = px(Math.cos(a) * R0, Math.sin(a) * R0); k ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
        for (let i = 0; i < 260; i++) { const a = AA + rand(-half, half), r = R0 + rand(-0.45, 0.45), [x, y] = px(Math.cos(a) * r, Math.sin(a) * r); c.fillStyle = i % 3 ? 'rgba(70,52,36,.3)' : 'rgba(205,186,150,.3)'; c.beginPath(); c.ellipse(x, y, 0.05 * m, 0.11 * m, a + rand(-0.4, 0.4), 0, 6.28); c.fill(); }
        { const [x, y] = px(W.drumStand.x, W.drumStand.z), g = c.createRadialGradient(x, y, 0, x, y, 0.75 * m); g.addColorStop(0, 'rgba(92,72,50,.45)'); g.addColorStop(1, 'rgba(92,72,50,0)'); c.fillStyle = g; c.fillRect(x - m, y - m, 2 * m, 2 * m); }
        // soft edge into the grass
        const e = c.createRadialGradient(w / 2, w / 2, w * 0.38, w / 2, w / 2, w * 0.5); e.addColorStop(0, 'rgba(0,0,0,1)'); e.addColorStop(1, 'rgba(0,0,0,0)');
        c.globalCompositeOperation = 'destination-in'; c.fillStyle = e; c.fillRect(0, 0, w, w); c.globalCompositeOperation = 'source-over';
      });
      mesh(new THREE.CircleGeometry(AR, 32).rotateX(-Math.PI / 2), Mat({ map: floorTex, roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), AC.x, 0.015, AC.z, scene);
      // things at the edge of the akhra, in one vertex-coloured draw: the tumdak's cradle, the drummers' water pot and
      // brass lota, spare sticks, an elders' log bench and a rope cot at the sides, a big shade tree beside it
      const props = [], at = (s, i) => AKHRA.clone().addScaledVector(W.aR, s).addScaledVector(W.aIn, i), yawIn = Math.atan2(W.aIn.x, W.aIn.z);
      const put = (g, hex, p, y, yaw = 0) => { const o = new THREE.Mesh(vcol(g, hex)); o.position.set(p.x, y, p.z); o.rotation.y = yaw; props.push(o); return o; };
      put(new THREE.BoxGeometry(0.5, 0.2, 0.3), 0x6b5137, at(0.95, 0), 0.1, Math.atan2(W.aR.x, W.aR.z));
      put(new THREE.SphereGeometry(0.22, 10, 8).scale(1, 0.92, 1), 0x8e4426, at(-0.95, 0.15), 0.23); put(new THREE.CylinderGeometry(0.085, 0.12, 0.09, 10), 0x7c3a20, at(-0.95, 0.15), 0.46);
      put(new THREE.TorusGeometry(0.12, 0.035, 5, 10).rotateX(Math.PI / 2), 0xc9b07a, at(-0.95, 0.15), 0.035);
      put(new THREE.SphereGeometry(0.075, 8, 6), 0xc9a03a, at(-0.66, 0.38), 0.075); put(new THREE.CylinderGeometry(0.035, 0.045, 0.07, 8), 0xb88f2e, at(-0.66, 0.38), 0.16);
      for (const [s, i, y] of [[1.45, -0.25, 0.3], [1.5, -0.4, -0.25]]) put(new THREE.CylinderGeometry(0.016, 0.022, 0.55, 5).rotateZ(Math.PI / 2), 0x7a5a3a, at(s, i), 0.022, yawIn + y);
      const bench = AC.clone().addScaledVector(W.aR, 3.2).addScaledVector(W.aIn, -0.6);
      put(new THREE.CylinderGeometry(0.17, 0.19, 2.0, 8).rotateX(Math.PI / 2), 0x6e5238, bench, 0.38, yawIn);
      for (const s of [-0.7, 0.7]) put(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 6), 0x55412c, bench.clone().addScaledVector(W.aIn, s), 0.15);
      const cot = AC.clone().addScaledVector(W.aR, -3.3).addScaledVector(W.aIn, -0.4);
      put(new THREE.BoxGeometry(0.82, 0.04, 1.75), 0xc9b07a, cot, 0.4, yawIn);
      for (const sx of [-1, 1]) { put(new THREE.BoxGeometry(0.06, 0.07, 1.85), 0x5e4630, cot.clone().addScaledVector(W.aR, sx * 0.44), 0.4, yawIn); put(new THREE.BoxGeometry(0.94, 0.07, 0.06), 0x5e4630, cot.clone().addScaledVector(W.aIn, sx * 0.9), 0.4, yawIn);
        for (const sz of [-1, 1]) put(new THREE.CylinderGeometry(0.04, 0.035, 0.4, 5), 0x5e4630, cot.clone().addScaledVector(W.aR, sx * 0.44).addScaledVector(W.aIn, sz * 0.9), 0.2); }
      // the shade tree takes the spot furthest from every path to a door (the houses are placed a little differently on
      // every load, so a fixed spot overhung a path on some layouts)
      const pathGap = (q) => Math.min(...C.houses.map(h => { const dx = h.x + Math.sin(h.rot) * (h.d / 2 + 0.8), dz = h.z + Math.cos(h.rot) * (h.d / 2 + 0.8), L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, al = q.x * ux + q.z * uz;
        return al < 12.5 ? Math.hypot(q.x - ux * 12.5, q.z - uz * 12.5) : al > L ? Math.hypot(q.x - dx, q.z - dz) : Math.abs(q.x * uz - q.z * ux); }));
      const tree = [[3.9, -1.2], [3.4, -1.7], [4.4, -0.8], [3.0, -2.2], [-4.4, -1.8], [-3.8, -2.4]].map(([a, b]) => AC.clone().addScaledVector(W.aR, a).addScaledVector(W.aIn, b)).reduce((best, q) => pathGap(q) > pathGap(best) + 0.01 ? q : best);
      put(new THREE.CylinderGeometry(0.3, 0.5, 5.6, 8), 0x4a3f33, tree, 2.8);
      for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28, o = tree.clone().add(V(Math.cos(a) * rand(0.6, 1.5), 0, Math.sin(a) * rand(0.6, 1.5))); put(new THREE.SphereGeometry(rand(1.4, 2.1), 7, 5), [0x3e6b2c, 0x4f7d35, 0x355a26][k % 3], o, 5.9 + rand(-0.3, 1.1)); }
      for (const o of props) scene.add(o);
      scene.updateMatrixWorld(true); C.bakeStatic(props, Mat({ vertexColors: true, flatShading: true, roughness: 0.95 }));
      // what you can bump into
      if (C.props) C.props.push({ x: bench.x + W.aIn.x * 0.6, z: bench.z + W.aIn.z * 0.6, r: 0.4 }, { x: bench.x - W.aIn.x * 0.6, z: bench.z - W.aIn.z * 0.6, r: 0.4 }, { x: cot.x, z: cot.z, r: 0.9 }, { x: tree.x, z: tree.z, r: 0.55, top: 9, cr: 2.4, cy: 4.2 });
      W.akhraProps = { bench, cot, tree };
    }
    W.tamak = C.dhamsaMesh(); W.tamak.scale.setScalar(1.35); W.tamak.position.copy(AKHRA); scene.add(W.tamak);
    W.tumdak = C.madalMesh(); W.tumdak.children.filter(o => o.material && o.material.isMeshBasicMaterial).forEach(o => W.tumdak.remove(o)); W.tumdak.scale.setScalar(1.25); W.tumdak.position.copy(AKHRA).addScaledVector(W.aR, 0.95); W.tumdak.position.y = 0.42; W.tumdak.rotation.set(0, Math.atan2(W.aR.x, W.aR.z), Math.PI / 2); scene.add(W.tumdak);

    /* --- archery ground: a shooting line, and a banana-trunk target out past the houses --- */
    const paste = Mat({ color: 0xf6eedd, roughness: 0.9 }), red = Mat({ color: 0xc0281e, roughness: 0.6 });
    const aDir = t1.copy(TARGET).sub(ARCH).setY(0).normalize().clone(); W.aDir = aDir; W.aSide = V(aDir.z, 0, -aDir.x);
    const line = mesh(new THREE.BoxGeometry(2.6, 0.02, 0.1), paste, ARCH.x + aDir.x * 0.6, 0.02, ARCH.z + aDir.z * 0.6, scene); line.rotation.y = Math.atan2(aDir.x, aDir.z);
    const flag = (pos, col) => { const g2 = new THREE.Group(); g2.position.copy(pos); mesh(new THREE.CylinderGeometry(0.03, 0.04, 3.2, 6), wood, 0, 1.6, 0, g2); const f = mesh(new THREE.PlaneGeometry(0.9, 0.5), Mat({ color: col, roughness: 0.8, side: THREE.DoubleSide }), 0.48, 2.9, 0, g2); f.name = 'cloth'; scene.add(g2); return g2; };
    W.flags = [flag(ARCH.clone().addScaledVector(W.aSide, -2.4).addScaledVector(W.aDir, -0.6), 0xffb347), flag(FSTAND.clone().addScaledVector(V(-FSTAND.z, 0, FSTAND.x).normalize(), 1.6), 0x3f8fb8)];
    { // the lane is worn into the grass: a trodden patch at the line, a path to the target, scuffs where arrows were fetched
      const L = ARCH.distanceTo(TARGET) + 1.6, laneTex = C.canvasTex(128, 512, (c, w, h) => {
        const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(120,96,64,0)'); g.addColorStop(0.5, 'rgba(120,96,64,.42)'); g.addColorStop(1, 'rgba(120,96,64,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
        for (const [y, r] of [[h * 0.93, 70], [h * 0.06, 50]]) { const rg = c.createRadialGradient(w / 2, y, 0, w / 2, y, r); rg.addColorStop(0, 'rgba(104,82,54,.6)'); rg.addColorStop(1, 'rgba(104,82,54,0)'); c.fillStyle = rg; c.fillRect(0, 0, w, h); }
        for (let i = 0; i < 160; i++) { const y = rand(0, h), x = w / 2 + rand(-1, 1) * w * 0.25; c.fillStyle = i % 2 ? 'rgba(80,62,40,.3)' : 'rgba(170,150,110,.3)'; c.beginPath(); c.ellipse(x, y, 2.5, 5, rand(-0.3, 0.3), 0, 6.28); c.fill(); }
        const e = c.createLinearGradient(0, 0, 0, h); e.addColorStop(0, 'rgba(0,0,0,0)'); e.addColorStop(0.06, 'rgba(0,0,0,1)'); e.addColorStop(0.94, 'rgba(0,0,0,1)'); e.addColorStop(1, 'rgba(0,0,0,0)');
        c.globalCompositeOperation = 'destination-in'; c.fillStyle = e; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over'; });
      const lane = mesh(new THREE.PlaneGeometry(2.4, L).rotateX(-Math.PI / 2), Mat({ map: laneTex, roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), 0, 0.012, 0, scene);
      lane.position.copy(ARCH).lerp(TARGET, 0.5).setY(0.012); lane.rotation.y = Math.atan2(aDir.x, aDir.z);
      // at the line: spare arrows stuck in the ground, a marker peg at each end of the line
      const parts = [], put = (g, hex, p, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(vcol(g, hex)); o.position.copy(p); o.rotation.set(rx, ry, rz); parts.push(o); scene.add(o); };
      const at = (side, fwd, y = 0) => ARCH.clone().addScaledVector(W.aSide, side).addScaledVector(aDir, fwd).setY(y);
      for (let k = 0; k < 6; k++) { const p = at(-1.05 + rand(-0.08, 0.08), -0.25 + rand(-0.08, 0.08), 0.36); put(new THREE.CylinderGeometry(0.014, 0.014, 0.8, 5), 0x6a5541, p, rand(-0.12, 0.12), 0, rand(-0.12, 0.12));
        put(new THREE.BoxGeometry(0.01, 0.13, 0.08), 0xffc23a, p.clone().setY(0.7), 0, rand(0, 3), 0); }
      for (const sd of [-1.35, 1.35]) put(new THREE.CylinderGeometry(0.03, 0.04, 0.32, 6), 0x5e4630, at(sd, 0.6, 0.16));
      scene.updateMatrixWorld(true); C.bakeStatic(parts, Mat({ vertexColors: true, roughness: 0.8 })); }
    const tg = new THREE.Group(); tg.position.copy(TARGET); scene.add(tg); W.target = tg;
    tg.rotation.y = Math.atan2(-aDir.x, -aDir.z); // local +z faces the shooter
    // the target is one vertex-coloured mesh (it was six): a banana trunk with its sheath stripes, lashed with rope, set in
    // a mound of earth, old arrow holes in the trunk, the painted face (radii match the hit zone), cut sheath stubs
    { const parts = [], tint = (g, hex, shade) => { vcol(g, hex); if (shade) { const c = g.attributes.color, q = g.attributes.position; for (let i = 0; i < c.count; i++) { const k = shade(q.getX(i), q.getY(i), q.getZ(i)); c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k); } } parts.push(g); return g; };
      tint(new THREE.CylinderGeometry(0.3, 0.36, 2.6, 16, 6).translate(0, 1.3, 0), 0xb7c48a, (x, y, z) => 0.82 + 0.18 * Math.sin(Math.atan2(z, x) * 7) + (y < 0.3 ? -0.15 : 0));
      tint(new THREE.CircleGeometry(0.66, 28).translate(0, FACE_Y, 0.37), 0x2b2620); // in front of the tapering trunk: it poked through the paint
      [[0.62, 0xf6eedd], [0.47, 0xc0281e], [0.3, 0xf6eedd], [0.13, 0xc0281e]].forEach(([r, c], i) => tint(new THREE.CircleGeometry(r, 28).translate(0, FACE_Y, 0.375 + i * 0.006), c));
      for (const y of [0.32, 2.3]) for (let k = 0; k < 2; k++) tint(new THREE.TorusGeometry(0.33 - (y > 1 ? 0.04 : 0), 0.025, 4, 16).rotateX(Math.PI / 2).translate(0, y + k * 0.06, 0), 0xc9b07a);
      for (let k = 0; k < 14; k++) { const a = rand(0, Math.PI * 2), y = rand(0.5, 2.1); if (Math.abs(y - FACE_Y) < 0.75 && Math.sin(a) > 0.1) continue; tint(new THREE.CircleGeometry(0.022, 6).rotateY(Math.PI / 2 - a).translate(Math.cos(a) * 0.335, y, Math.sin(a) * 0.335), 0x3a3324); } // old holes, off the painted face (it looks along +z)
      tint(new THREE.CylinderGeometry(0.42, 0.75, 0.2, 14).translate(0, 0.1, 0), 0x6e5a40, (x, y, z) => 0.9 + 0.1 * Math.sin(Math.atan2(z, x) * 5));
      for (let k = 0; k < 4; k++) { const a = k * 1.7 + 0.4; tint(new THREE.CylinderGeometry(0.05, 0.07, 0.22, 5).translate(0, 0.11, 0).rotateZ(0.5).rotateY(a).translate(Math.cos(a) * 0.2, 2.6, -Math.sin(a) * 0.2), 0x9aa86a); }
      const tm = new THREE.Mesh(C.mergeGeometries(parts), Mat({ vertexColors: true, roughness: 0.8 })); tm.castShadow = true; tg.add(tm); }
    // banana leaves: each turns to its side first, then leans out from the top of the trunk (YXZ), lit a little from within;
    // all five in one mesh, each with a torn notch along its edge
    { const bLeaf = Mat({ color: 0x6fa046, emissive: 0x1f3d12, roughness: 0.8, side: THREE.DoubleSide }), lg = [], o = new THREE.Object3D();
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 + 0.3, lean = 0.85 + (i % 2) * 0.15, g = new THREE.PlaneGeometry(0.42, 1.4, 1, 4);
        const q = g.attributes.position; for (let j = 0; j < q.count; j++) { const y = q.getY(j); q.setZ(j, -0.18 * Math.pow((y + 0.7) / 1.4, 2)); if (j % 2 && y > 0) q.setX(j, q.getX(j) * 0.7); } // droops, ragged on one side
        o.position.set(Math.sin(a) * 0.62 * Math.sin(lean), 2.55 + 0.7 * Math.cos(lean), Math.cos(a) * 0.62 * Math.sin(lean)); o.rotation.set(lean, a, 0, 'YXZ'); o.updateMatrix(); lg.push(g.applyMatrix4(o.matrix)); }
      tg.add(new THREE.Mesh(C.mergeGeometries(lg), bLeaf)); }
    // arrows: five to shoot and one on the string, all drawn by one instanced mesh that follows these placeholders
    { const g = [vcol(new THREE.CylinderGeometry(0.028, 0.028, 0.85, 6).rotateX(Math.PI / 2), 0x6a5541), vcol(new THREE.ConeGeometry(0.055, 0.14, 6).rotateX(Math.PI / 2).translate(0, 0, 0.48), 0x2b2620)];
      for (const r of [0, Math.PI / 2]) g.push(vcol(new THREE.PlaneGeometry(0.2, 0.24).rotateY(Math.PI / 2).rotateZ(r).translate(0, 0, -0.34), 0xffc23a));
      W.arrowIM = new THREE.InstancedMesh(C.mergeGeometries(g), Mat({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }), 6); W.arrowIM.frustumCulled = false; scene.add(W.arrowIM);
      W.arrows = []; for (let i = 0; i < 6; i++) { const a = new THREE.Object3D(); a.visible = false; scene.add(a); W.arrows.push(a); } W.nocked = W.arrows[5]; }
    // the bow: a bamboo stave bent toward the target with a cloth grip, and its string (shown only while shooting)
    { const L = 0.9, curve = new THREE.CatmullRomCurve3([V(0, -L, -0.1), V(0, -L / 2, 0.025), V(0, 0, 0.05), V(0, L / 2, 0.025), V(0, L, -0.1)]);
      const sg2 = C.mergeGeometries([vcol(new THREE.TubeGeometry(curve, 20, 0.03, 6), 0xd8b66a), vcol(new THREE.CylinderGeometry(0.042, 0.042, 0.18, 6).translate(0, 0, 0.05), 0x7a2a1e)]);
      W.bow = new THREE.Group(); W.bow.add(new THREE.Mesh(sg2, Mat({ vertexColors: true, roughness: 0.6 }))); W.bowL = L;
      W.bowString = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, L, -0.1), V(0, 0, -0.1), V(0, -L, -0.1)]), new THREE.LineBasicMaterial({ color: 0xf2efe6 })); W.bow.add(W.bowString);
      W.bow.visible = false; scene.add(W.bow); }

    /* --- the pond --- */
    W.fIn = t1.copy(FSTAND).sub(POND).setY(0).normalize().clone();
    { const PR = 3.2, BR = 3.9, fa = Math.atan2(W.fIn.z, W.fIn.x); // fa: the side you fish from (the camera is behind you there)
      const away = (a, w) => Math.abs(Math.atan2(Math.sin(a - fa), Math.cos(a - fa))) > w; // keep tall things off the camera side
      // bank: dark wet mud at the waterline drying out to earth, flecked with grit
      const bankTex = C.canvasTex(256, 256, (c, w) => { const m = w / (2 * BR), cx = w / 2;
        const g = c.createRadialGradient(cx, cx, PR * m * 0.96, cx, cx, BR * m); g.addColorStop(0, '#34281c'); g.addColorStop(0.3, '#55422f'); g.addColorStop(0.75, 'rgba(112,94,66,.7)'); g.addColorStop(1, 'rgba(112,94,66,0)');
        c.fillStyle = g; c.fillRect(0, 0, w, w); for (let i = 0; i < 900; i++) { c.fillStyle = i % 2 ? 'rgba(40,30,20,.35)' : 'rgba(170,150,115,.3)'; c.fillRect(rand(0, w), rand(0, w), 1.5, 1.5); } });
      mesh(new THREE.CircleGeometry(BR, 32).rotateX(-Math.PI / 2), Mat({ map: bankTex, roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), POND.x, 0.015, POND.z, scene);
      // water: deep in the middle, shallow and green at the edge, with a sky sheen; a second layer of wavelets drifts over it
      const waterTex = C.canvasTex(256, 256, (c, w) => { const cx = w / 2, g = c.createRadialGradient(cx, cx, 0, cx, cx, cx);
        g.addColorStop(0, '#24607d'); g.addColorStop(0.6, '#2f7b92'); g.addColorStop(0.9, '#4f8f84'); g.addColorStop(1, '#5e8f6c'); c.fillStyle = g; c.fillRect(0, 0, w, w);
        const s = c.createLinearGradient(0, 0, w, w); s.addColorStop(0, 'rgba(255,255,255,0)'); s.addColorStop(0.45, 'rgba(220,240,255,.16)'); s.addColorStop(0.6, 'rgba(255,255,255,0)'); c.fillStyle = s; c.fillRect(0, 0, w, w); });
      // small depth offsets for bank < water < wavelets: a big one buried the lily pads at low camera angles
      W.water = mesh(new THREE.CircleGeometry(PR, 32).rotateX(-Math.PI / 2), Mat({ map: waterTex, roughness: 0.2, transparent: true, opacity: 0.94, polygonOffset: true, polygonOffsetFactor: -2 }), POND.x, 0.03, POND.z, scene);
      const waveTex = C.canvasTex(128, 128, (c, w) => { c.lineWidth = 1.4; for (let i = 0; i < 46; i++) { const x = rand(0, w), y = rand(0, w), l = rand(8, 22); c.strokeStyle = `rgba(235,248,255,${rand(0.15, 0.4).toFixed(2)})`; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + l / 2, y - 2.5, x + l, y); c.stroke(); } });
      waveTex.wrapS = waveTex.wrapT = THREE.RepeatWrapping; waveTex.repeat.set(3, 3);
      W.waves = mesh(new THREE.CircleGeometry(PR * 0.97, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: waveTex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3 }), POND.x, 0.034, POND.z, scene);
      // ripple rings (one draw, hidden when still): faded by dimming their colour, as they add light
      const RN = 14; W.rip = new THREE.InstancedMesh(new THREE.RingGeometry(0.86, 1, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), RN);
      W.rip.frustumCulled = false; W.rip.visible = false; W.rip.renderOrder = 2; W.ripples = []; for (let i = 0; i < RN; i++) { W.ripples.push({ t: 9, x: 0, z: 0, s: 1 }); W.rip.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); W.rip.setColorAt(i, new THREE.Color(0)); } scene.add(W.rip);
      // ducks paddling round the pond (one instanced draw; the second is a brown one)
      { const parts = [], add2 = (g, hex) => parts.push(vcol(g, hex));
        add2(new THREE.SphereGeometry(0.17, 8, 6).scale(0.85, 0.6, 1.25), 0xf2efe6); add2(new THREE.SphereGeometry(0.085, 8, 6).translate(0, 0.17, 0.17), 0xf2efe6);
        add2(new THREE.ConeGeometry(0.035, 0.09, 5).rotateX(Math.PI / 2).translate(0, 0.16, 0.28), 0xe08a2a); add2(new THREE.ConeGeometry(0.07, 0.14, 4).rotateX(-Math.PI / 2 - 0.5).translate(0, 0.07, -0.22), 0xe6e2d6);
        for (const sx of [-1, 1]) add2(new THREE.SphereGeometry(0.018, 5, 4).translate(sx * 0.06, 0.2, 0.22), 0x15120e);
        const dg = C.mergeGeometries ? C.mergeGeometries(parts) : null;
        if (dg) { W.ducks = new THREE.InstancedMesh(dg, Mat({ vertexColors: true, roughness: 0.7 }), 3); W.ducks.frustumCulled = false; W.duckS = [[2.15, 0.16, 0], [1.75, -0.12, 2.1], [2.45, 0.1, 4.2]];
          [0xffffff, 0xa98a62, 0xffffff].forEach((c, i) => W.ducks.setColorAt(i, new THREE.Color(c))); scene.add(W.ducks); } }
      // the rest is one vertex-coloured draw: reeds and cattails, lily pads with lotus, stones, a washing stone and a pot
      const parts = [], put = (g, hex, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(vcol(g, hex)); o.position.set(POND.x + x, y, POND.z + z); o.rotation.set(rx, ry, rz); parts.push(o); scene.add(o); return o; };
      for (let k = 0; k < 13; k++) { const a = k / 13 * 6.28 + rand(-0.15, 0.15); if (!away(a, 0.95)) continue; const r = rand(3.05, 3.5), cx = Math.cos(a) * r, cz = Math.sin(a) * r;
        for (let b = 0; b < 8; b++) { const h = rand(0.6, 1.3); put(new THREE.ConeGeometry(0.022, h, 3), [0x4f7d35, 0x5f8a3a, 0x3e6b2c][b % 3], cx + rand(-0.2, 0.2), h / 2, cz + rand(-0.2, 0.2), rand(-0.22, 0.22), 0, rand(-0.22, 0.22)); }
        if (k % 2) { const x = cx + rand(-0.1, 0.1), z = cz + rand(-0.1, 0.1); put(new THREE.CylinderGeometry(0.008, 0.008, 1.1, 3), 0x6f7a3a, x, 0.55, z); put(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 6), 0x5a3a22, x, 1.12, z); } }
      for (let k = 0; k < 16; k++) { const a = rand(0, 6.28); if (!away(a, 0.55)) continue; const r = rand(1.5, 2.8), x = Math.cos(a) * r, z = Math.sin(a) * r, s = rand(0.24, 0.4);
        put(new THREE.CylinderGeometry(s, s, 0.012, 12, 1, false, 0.35, 6.28 - 0.7), k % 3 ? 0x6aa84a : 0x58953c, x, 0.075, z, 0, rand(0, 6.28)); // clear of the water's depth offset
        if (k % 4 === 0) { for (let q = 0; q < 12; q++) { const inner = q >= 6, pa = q / 6 * Math.PI * 2 + (inner ? 0.5 : 0), pr = inner ? 0.05 : 0.09; put(new THREE.SphereGeometry(inner ? 0.05 : 0.07, 6, 4).scale(0.45, 0.3, 1).translate(0, 0, pr), inner ? 0xf6c2d4 : 0xe98fb0, x, 0.12 + (inner ? 0.04 : 0), z, inner ? -0.9 : -0.55, pa, 0); } // a lotus: two rings of petals
          put(new THREE.SphereGeometry(0.035, 6, 4), 0xe8c547, x, 0.15, z); } }
      for (let k = 0; k < 10; k++) { const a = rand(0, 6.28), r = rand(3.25, 3.75), s = rand(0.1, 0.22); put(new THREE.SphereGeometry(s, 6, 4).scale(1.3, 0.55, 1), [0x8a8478, 0x6f6a60, 0x9a9488][k % 3], Math.cos(a) * r, s * 0.25, Math.sin(a) * r, 0, rand(0, 3)); }
      { const a = fa + 1.75, x = Math.cos(a) * 3.15, z = Math.sin(a) * 3.15; put(new THREE.BoxGeometry(0.95, 0.12, 0.55), 0x7d776c, x, 0.07, z, 0, -a, 0.16);
        put(new THREE.SphereGeometry(0.2, 9, 7).scale(1, 0.95, 1), 0x9a4c2a, x + Math.cos(a) * 0.75, 0.2, z + Math.sin(a) * 0.75); put(new THREE.CylinderGeometry(0.075, 0.1, 0.08, 9), 0x8a4222, x + Math.cos(a) * 0.75, 0.4, z + Math.sin(a) * 0.75); }
      scene.updateMatrixWorld(true); C.bakeStatic(parts, Mat({ vertexColors: true, flatShading: true, roughness: 0.9 }));
    }
    W.float = new THREE.Group(); mesh(new THREE.SphereGeometry(0.09, 8, 6), red, 0, 0.05, 0, W.float); mesh(new THREE.SphereGeometry(0.07, 8, 6), paste, 0, 0.13, 0, W.float); W.float.visible = false; scene.add(W.float);
    W.floatHome = POND.clone().addScaledVector(W.fIn, 1.3).setY(0.03);
    W.fishM = new THREE.Group(); { const fm = Mat({ color: 0xc9d3d8, roughness: 0.35 }); const b = mesh(new THREE.SphereGeometry(0.2, 10, 8), fm, 0, 0, 0, W.fishM); b.scale.set(0.45, 0.6, 1.3); const tl = mesh(new THREE.ConeGeometry(0.13, 0.22, 4).rotateX(-Math.PI / 2), fm, 0, 0, -0.33, W.fishM); tl.scale.x = 0.3; } W.fishM.visible = false; scene.add(W.fishM);
    // a marigold string over each door that still wants a song today
    W.jale = JALE.map(j => { const s2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: C.glowTex, color: 0xffc21c, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })); s2.scale.setScalar(1.1); s2.position.copy(j.stand).setY(2.3); scene.add(s2); return s2; });

    /* --- objective marker --- */
    W.marker = new THREE.Group(); scene.add(W.marker);
    const beamTex = C.canvasTex(8, 128, (c, w, h) => { const gr = c.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
    W.beam = mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 14, 1, true), new THREE.MeshBasicMaterial({ map: beamTex, color: 0xffb347, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }), 0, 3, 0, W.marker);
    W.mring = mesh(new THREE.RingGeometry(0.62, 0.78, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.85, depthWrite: false }), 0, 0.04, 0, W.marker);

    for (const s of W.spots) s.k = 0;
    applyPaint(true);
  }
  function applyPaint(instant) { W.spots.forEach((s, i) => { const on = !!save.painted[i]; s.outline.visible = !on && save.ch >= 1; s.art.visible = on; if (on && instant) { s.art.material.opacity = 1; s.k = 1; } }); }

  /* ---------- villagers on story duty ---------- */
  function castCrowd() {
    mother = C.crowd.find(c => c.kind === 'woman') || C.crowd[0];
    majhi = C.crowd.find(c => c.kind === 'man' && c !== mother) || C.crowd[1];
    dancers = C.crowd.filter(c => c !== mother && c !== majhi);
    for (const c of C.crowd) { c.busy = true; c.goingHome = false; c.wrap.visible = true; c.wrap.rotation.z = 0; c.play('Idle', { fade: 0.2 }); }
    mother.wrap.position.copy(W.inside.mother); mother.wrap.rotation.y = 0.5;
    majhi.wrap.position.copy(W.majhiPos); majhi.wrap.rotation.y = faceCentre(W.majhiPos) + 0.5;
    const n = dancers.length, r = 15.4;
    dancers.forEach((c, i) => {
      const a = AA + (i - (n - 1) / 2) * (1.2 / r); c.sBase = polar(a, r).clone(); c.sYaw = Math.atan2(AKHRA.x - c.sBase.x, AKHRA.z - c.sBase.z);
      c.sTan = V(-Math.sin(a), 0, Math.cos(a)); c.wrap.position.copy(c.sBase); c.wrap.rotation.y = c.sYaw; c.sHop = 0;
    });
  }
  function releaseCrowd() {
    for (const c of C.crowd) { c.busy = false; c.goingHome = false; c.wrap.position.copy(c.home); c.wrap.rotation.set(0, c.homeYaw, 0); c.play('Idle', { fade: 0.2 }); }
    C.crowdBudget();
  }

  /* ---------- the animal ---------- */
  const atRing = () => save.ch >= 3;
  function placeAnimal() {
    const b = game.b, bull = C.bull();
    if (atRing()) { b.pos.copy(RING_SPOT); b.yaw = 0; } else { b.pos.copy(GOHAL); b.yaw = W.gohalYaw; }
    bull.wrap.position.copy(b.pos); bull.wrap.rotation.y = b.yaw;
    C.rope.visible = atRing(); C.garland.visible = atRing() || !!save.garland;
    bull.play(atRing() ? 'Idle' : 'Eating', { fade: 0.2 });
    if (save.oiled) C.tint(bull, { Horns: 0xc8301c });
  }

  /* ---------- sticks for drumming ---------- */
  function giveSticks(a) {
    if (a.sticks) return;
    a.sticks = [];
    for (const n of [['FistR', 'Fist.R'], ['FistL', 'Fist.L']]) {
      const hand = a.root.getObjectByName(n[0]) || a.root.getObjectByName(n[1]); if (!hand) continue;
      a.root.updateMatrixWorld(true); const ws = hand.getWorldScale(V());
      const h = new THREE.Group(); h.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z);
      const st = mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.46, 6), Mat({ color: 0x6b4a2c, roughness: 0.8 }), 0, 0.17, 0, h);
      st.castShadow = true; hand.add(h); h.visible = false; a.sticks.push(h);
    }
  }
  const showSticks = (on) => { const pl = C.player(); if (pl.sticks) pl.sticks.forEach(s => s.visible = on); };

  /* ---------- screen pieces ---------- */
  function fade(fn, hold = 300) {
    S.lock = Math.max(S.lock, (hold + 350) / 1000); $('fade').classList.add('on');
    setTimeout(() => { fn(); setTimeout(() => $('fade').classList.remove('on'), 140); }, hold);
  }
  function say(lines, then) {
    S.dlg = { lines, i: 0, then, t: now() }; $('dlg').hidden = false; showLine();
  }
  function showLine() { const d = S.dlg, l = d.lines[d.i]; $('dlgWho').textContent = l[0]; $('dlgText').textContent = l[1]; $('dlgNext').textContent = tr(d.i < d.lines.length - 1 ? (C.isTouch ? 'Tap to go on' : 'Enter to go on') : (C.isTouch ? 'Tap to close' : 'Enter to close')); d.t = now(); }
  function nextLine() {
    const d = S.dlg; if (!d || now() - d.t < 0.25) return;
    if (++d.i < d.lines.length) { showLine(); return; }
    S.dlg = null; $('dlg').hidden = true;
    if (S.hintAfterDlg) { S.hintAfterDlg = false; hint(C.isTouch ? (LANG === 'hi' ? 'बाएँ खींचकर चलो। काम के लिए नारंगी बटन दबाओ।' : 'Drag the left side to walk. Tap the orange button to do things.') : (LANG === 'hi' ? 'WASD से चलो। काम के लिए E दबाओ या नारंगी बटन पर क्लिक करो।' : 'Walk with WASD or the arrow keys. Press E or click the orange button to do things.'), 4500); }
    if (d.then) d.then();
  }
  $('dlg').addEventListener('pointerdown', (e) => { e.preventDefault(); nextLine(); });

  function setChapter(n) { if (n > save.ch && C.track) C.track('ch.' + n); save.ch = n; persist(); S.objKey = ''; applyPaint(false); }

  /* ---------- things you can do ---------- */
  function interactions() {
    const p = game.p.pos, list = [];
    const add = (pos, r, label, text, go) => { const d = Math.hypot(p.x - pos.x, p.z - pos.z); if (d < r) list.push({ d, label, text, go }); };
    if (S.inside) {
      const I = W.inside;
      add(I.handi, 1.25, 'DRINK', 'Drink the handi', drinkHandi);
      add(I.pitha, 1.1, 'EAT', 'Eat a pitha', eatPitha);
      add(I.bed, 1.5, 'REST', 'Rest on the khatia', rest);
      add(mother.wrap.position, 1.3, 'TALK', 'Talk to Gogo', () => say(save.ch === 0 ? T.wake.slice(1) : T.gogoIdle));
      add(I.door, 1.1, 'GO OUT', 'Go outside', () => leaveHouse());
    } else {
      add(DOOR_OUT, 1.5, 'ENTER', 'Go into the house', enterHouse);
      if (save.ch >= 1) W.spots.forEach((s, i) => { if (!save.painted[i]) add(s.stand, 1.3, 'PAINT', 'Paint the wall', () => paint(i)); });
      add(majhi.wrap.position, 1.5, 'TALK', 'Talk to the Majhi', talkMajhi);
      if (!atRing() && save.ch >= 2) {
        if (!save.chosen) add(W.gStand, 2.4, 'CHOOSE', 'Choose the animal', openPicker);
        else if (!save.oiled) add(W.gStand, 2.4, 'OIL', 'Oil the horns', oilHorns);
        else if (!save.garland) add(W.gStand, 2.4, 'GARLAND', 'Put on the garland', putGarland);
      }
      if (save.ch >= 3) { const chart = save.ch === 3 || (save.ch >= 5 && !today().drum); add(W.drumStand, 1.9, 'BEAT', chart ? 'Beat the tamak' : 'Drum freely', () => drumStart(!chart)); }
      if (save.ch >= 1) {
        add(ARCH, 1.7, 'SHOOT', 'Shoot at the target', archStart);
        add(FSTAND, 1.7, 'FISH', 'Fish in the pond', fishStart);
        JALE.forEach((j, i) => { if (!today().jv[i]) add(j.stand, 1.5, 'SING', 'Sing at this house', () => echoStart(i)); });
      }
      { const d = Math.hypot(p.x, p.z); if (d < 10.6) list.push(save.ch === 4 ? { d: 0.5, label: 'START', text: 'Start the Khuntau', go: startRing } // the story's finale: 3 pitha
        : { d: 0.5, label: 'RING', text: 'Play a round at the khunt', go: villageRound }); } // any other time: a normal scored round
    }
    list.sort((a, b) => a.d - b.d); return list[0] || null;
  }

  function enterHouse() {
    fade(() => { S.inside = true; W.room.visible = true; game.p.pos.copy(W.inside.spawn); game.p.yaw = -Math.PI / 2; snapCam(); });
  }
  function leaveHouse() {
    fade(() => { S.inside = false; W.room.visible = false; game.p.pos.copy(STEP_OUT); game.p.yaw = H.rot; S.camYaw = H.rot; snapCam(); });
  }
  function gulp() { if (!C.audio.ctx) return; const t = C.audio.ctx.currentTime; [0, 0.16, 0.32, 0.5].forEach((d, i) => C.tone(t + d, 'sine', 300 - i * 30, 150 - i * 15, 0.13, 0.4, C.audio.sfxBus)); C.play('bells', { vol: 0.4, rate: 1.4, when: 0.7 }); }
  function drinkHandi() {
    const pl = C.player(); game.p.yaw = Math.atan2(W.inside.handi.x - game.p.pos.x, W.inside.handi.z - game.p.pos.z);
    pl.play('PickUp', { once: true, fade: 0.1, ts: 1.1 }); S.lock = 1.3; gulp(); C.buzz(30);
    setTimeout(() => {
      S.tipsy = 7; S.boost = 25; pop('Handi!', 'You feel strong');
      const wp = inW(-0.25, -2.2).setY(IN.y + 1); for (let i = 0; i < 10; i++) C.emit(C.sparkPool, wp, { life: 0.8, vel: V(rand(-1.2, 1.2), rand(0.8, 2.4), rand(-1.2, 1.2)), size: 0.26, grow: -0.2, grav: 4, color: i % 2 ? 0x9dff9a : 0xfff1c9 });
      if (save.ch === 0) setTimeout(() => { setChapter(1); say(T.drank); }, 900);
    }, 700);
  }
  function eatPitha() {
    const left = W.cakes.filter(c => c.visible); if (!left.length) { hint('The plate is empty. Gogo will make more tomorrow.', 2000); return; }
    C.player().play('PickUp', { once: true, fade: 0.1, ts: 1.3 }); S.lock = 0.9;
    setTimeout(() => { left[left.length - 1].visible = false; C.play('bells', { vol: 0.5, rate: 1.2 }); pop('Pitha!', 'Sweet rice cake'); C.buzz(20); }, 450);
  }
  // resting: sit on the khatia, lie back with your head on the pillow, breathe slowly, then get up
  const REST_Q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, -1), V(-1, 0, 0), V(0, 1, 0))); // up -> pillow end, face -> sky
  function rest() {
    const pl = C.player(); S.lock = 99; game.p.yaw = Math.PI / 2;
    pl.play('SitDown', { once: true, fade: 0.15 });
    fade(() => { S.rest = { t: 0, z: 0.6 }; S.tipsy = 0; for (const c of W.cakes) c.visible = true; pl.play('Idle', { fade: 0, ts: 0.3 }); toast('You rest a while', 1300); }, 700);
  }
  function wake() {
    const pl = C.player(); S.rest.t = -99;
    fade(() => { S.rest = null; pl.wrap.rotation.set(0, 0, 0); game.p.pos.copy(W.inside.bedSide); game.p.yaw = 0; pl.play('StandUp', { once: true, fade: 0.1 }); S.lock = 0.9; }, 350);
  }
  function paint(i) {
    const s = W.spots[i], pl = C.player();
    game.p.yaw = Math.atan2(s.look.x - game.p.pos.x, s.look.z - game.p.pos.z);
    pl.play('SwordSlash', { once: true, fade: 0.08, ts: 1.2 }); S.lock = 1.2; C.sfx.whoosh();
    save.painted[i] = 1; persist(); s.art.visible = true; s.art.material.opacity = 0; s.k = 0; s.outline.visible = false;
    setTimeout(() => { C.play('bells', { vol: 0.5, rate: 1.1 }); C.buzz(20); }, 500);
    const left = save.painted.filter(v => !v).length;
    if (left) setTimeout(() => toast(left === 1 ? 'One more to paint' : left + ' more to paint', 1300), 900);
    else setTimeout(() => { C.crowdCheer(0.5); if (save.ch === 1) { setChapter(2); say(T.painted); } }, 1300);
  }
  function talkMajhi() {
    if (save.ch === 2 && !save.chosen) say(T.majhi1, openPicker);
    else if (save.ch === 2) say(T.majhi2);
    else if (save.ch === 3) say(T.majhiIdle.concat(T.drumHow));
    else say(T.majhiIdle);
  }

  /* --- choosing the animal --- */
  const pick = { on: false, i: 0, busy: false };
  function openPicker() {
    pick.on = true; pick.i = Math.max(0, C.ANIMALS.indexOf(C.animal())); $('pick').hidden = false; renderPick();
    S.focus = { pos: GOHAL.clone().addScaledVector(W.gF, 0.1).addScaledVector(W.gR, 4.8).setY(1.9), look: GOHAL.clone().addScaledVector(W.gF, 0.35).setY(1.0) }; // between the posts: the front post used to stand right in front of the animal's head
    C.bull().play('Idle', { fade: 0.3 });
  }
  function renderPick() { const a = C.ANIMALS[pick.i]; $('pickName').textContent = tr(pick.busy ? 'Bringing…' : a.name); $('pickSub').textContent = tr((pick.i + 1) + ' of ' + C.ANIMALS.length); }
  async function stepPick(d) {
    if (pick.busy || !pick.on) return; pick.i = (pick.i + d + C.ANIMALS.length) % C.ANIMALS.length; pick.busy = true; renderPick();
    await C.setAnimal(C.ANIMALS[pick.i].id); pick.busy = false; pick.i = C.ANIMALS.indexOf(C.animal());
    const bull = C.bull(); bull.wrap.position.copy(game.b.pos); bull.wrap.rotation.y = game.b.yaw; C.garland.visible = false; bull.play('Idle', { fade: 0.2 });
    C.sfx.snort(); renderPick();
  }
  $('pickPrev').addEventListener('click', () => stepPick(-1)); $('pickNext').addEventListener('click', () => stepPick(1));
  $('pickOk').addEventListener('click', () => {
    if (pick.busy || !pick.on) return; pick.on = false; $('pick').hidden = true; S.focus = null;
    save.chosen = 1; save.oiled = 0; save.garland = 0; persist(); C.buzz(20); say(T.majhi2);
  });
  function oilHorns() {
    const pl = C.player(), bull = C.bull(); game.p.yaw = Math.atan2(game.b.pos.x - game.p.pos.x, game.b.pos.z - game.p.pos.z);
    pl.play('PickUp', { once: true, fade: 0.1, ts: 1.1 }); S.lock = 1.1;
    setTimeout(() => {
      save.oiled = 1; persist(); C.tint(bull, { Horns: 0xc8301c }); C.play('bells', { vol: 0.5, rate: 1.3 }); pop('Oiled', 'The horns shine');
      const hp = bull.head ? bull.head.getWorldPosition(V()) : game.b.pos.clone().setY(1.5);
      for (let i = 0; i < 10; i++) C.emit(C.sparkPool, hp, { life: 0.7, vel: V(rand(-1, 1), rand(0.5, 2), rand(-1, 1)), size: 0.24, grow: -0.2, grav: 3, color: i % 2 ? 0xffd27a : 0xffffff });
      bull.play('Idle_HitReact1', { once: true, fade: 0.1 }); S.bullReact = 0.9;
    }, 550);
  }
  function putGarland() {
    const pl = C.player(); pl.play('PickUp', { once: true, fade: 0.1, ts: 1.1 }); S.lock = 1.1;
    setTimeout(() => {
      save.garland = 1; persist(); C.garland.visible = true; C.sfx.grab(); pop('Garlanded', 'Marigolds for the day');
      setTimeout(() => say(T.majhi3, () => fade(() => { setChapter(3); placeAnimal(); C.sfx.bellow(); }, 450)), 1000);
    }, 550);
  }

  /* ---------- tamak and tumdak ---------- */
  const BEAT = 0.62, TRAVEL = 1.5, WIN = C.isTouch ? 0.23 : 0.2, LAG = C.isTouch ? 0.045 : 0; // a finger lands a little after the ear expects it
  // each phone learns its own timing: after a chart, the median of how late (or early) the hits landed nudges this
  let calib = 0; try { calib = clamp(+localStorage.getItem('khuntau-drumlag') || 0, -0.1, 0.15); } catch (e) {}
  const off = () => LAG + calib; // judged time = when the finger landed minus this
  const evTime = (e) => { const t = e && e.timeStamp / 1000; return t > 0 && Math.abs(now() - t) < 0.5 ? t : now(); }; // when the touch really happened, not when the busy frame got to it
  const CHART = [['T', 0], ['U', 1], ['U', 1.5], ['T', 2], ['U', 3], ['T', 4], ['U', 5], ['U', 5.5], ['T', 6], ['U', 7], ['T', 8], ['T', 8.5], ['U', 9], ['T', 10], ['U', 11], ['U', 11.5], ['T', 12], ['U', 13], ['T', 14], ['T', 14.5], ['U', 15], ['T', 16]];
  const NEED = 13;
  const drum = { free: false, t0: 0, notes: [], hits: 0, end: 0, click: -4, lo: false, done: false };
  function drumStart(free) {
    const pl = C.player(), p = game.p;
    S.mode = 'drum'; drum.free = free; drum.done = false; drum.hits = 0; drum.notes = []; drum.errs = []; drum.sched = -4;
    p.pos.copy(W.drumStand); p.yaw = Math.atan2(W.aIn.x, W.aIn.z); p.vel.set(0, 0, 0);
    S.camYaw = Math.atan2(-W.aIn.x, -W.aIn.z); S.lookT = now() + 999;
    giveSticks(pl); showSticks(true); pl.play('Idle', { fade: 0.15 });
    C.musicLevel(0.0); $('pads').hidden = false; $('padDone').hidden = !free; $('beatCount').textContent = '';
    $('laneT').textContent = ''; $('laneU').textContent = '';
    if (free) { hint('Play anything. The village follows your hands.', 2400); return; }
    drum.t0 = now() + BEAT * 4 + 0.3; drum.click = -4;
    for (const [lane, b] of CHART) { const el = document.createElement('div'); el.className = 'note'; $(lane === 'T' ? 'laneT' : 'laneU').appendChild(el); drum.notes.push({ lane, time: drum.t0 + b * BEAT, el, state: 0 }); }
    drum.end = drum.t0 + CHART[CHART.length - 1][1] * BEAT + 0.7; drum.laneH = $('laneT').clientHeight;
  }
  function drumStop() {
    S.mode = 'walk'; $('pads').hidden = true; showSticks(false); C.musicLevel(0.3); S.lookT = -9;
    $('laneT').textContent = ''; $('laneU').textContent = ''; drum.notes = [];
  }
  function judge(lane, text) { const el = $(lane === 'T' ? 'judgeT' : 'judgeU'); el.textContent = tr(text); el.classList.add('show'); void el.offsetWidth; setTimeout(() => el.classList.remove('show'), 60); }
  function drumSound(lane, quiet) {
    const pl = C.player(), ctx = C.audio.ctx;
    if (ctx && !C.audio.muted) { const t = ctx.currentTime;
      if (lane === 'T') { C.sfx.dhamsa(t); C.tone(t, 'sine', 70, 38, 0.6, 0.5, C.audio.drumBus); }
      else { drum.lo = !drum.lo; drum.lo ? C.sfx.madalLo(t) : C.sfx.madalHi(t); C.sfx.madalHi(t + 0.001); } }
    const pad = $(lane === 'T' ? 'padT' : 'padU'); pad.classList.add('hit'); setTimeout(() => pad.classList.remove('hit'), quiet ? 260 : 90);
    if (quiet) return;
    pl.play(lane === 'T' ? 'SwordSlash' : 'Punch', { once: true, fade: 0.04, ts: lane === 'T' ? 2.6 : 2.4 }); C.buzz(lane === 'T' ? 18 : 8);
  }
  function strike(lane, at) {
    if (S.mode === 'echo') { echoStrike(lane); return; }
    if (S.mode !== 'drum' || drum.done) return;
    const pl = C.player(), tn = (at ?? now()) - off();
    drumSound(lane);
    const dp = (lane === 'T' ? W.tamak.position : W.tumdak.position).clone(); dp.y = lane === 'T' ? 0.62 : 0.6;
    C.emit(C.dustPool, dp, { life: 0.35, vel: V(0, 1.4, 0), size: 0.25, grow: 0.7 });
    let power = 1;
    if (!drum.free) {
      power = 0.45; let best = null;
      for (const n of drum.notes) if (n.lane === lane && n.state === 0 && Math.abs(n.time - tn) <= WIN && (!best || n.time < best.time)) best = n; // oldest open note, so a late tap can't steal the next one
      if (best) { best.state = 1; best.el.classList.add('done'); drum.hits++; drum.errs.push(tn - best.time); power = 1; judge(lane, Math.abs(best.time - tn) < 0.085 ? 'Perfect' : 'Good'); }
      else if (drum.notes.some(n => n.lane === lane && n.state === 0 && n.time - tn > WIN && n.time - tn < 0.5)) judge(lane, 'Early');
    }
    pulse(power, lane === 'T');
  }
  // every hit is heard: the dance line steps, the cattle lift their heads, the ring drummers answer
  function pulse(power, deep) {
    dance.energy = Math.min(1.5, dance.energy + 0.26 * power); dance.hop = 1;
    dance.target += (deep ? Math.PI / 2 : Math.PI / 4) * (power > 0.6 ? 1 : 0.5);
    dancers.forEach((c, i) => { c.sHop = -i * 0.05; });
    if (deep && dance.energy > 0.7 && S.bullReact <= -2.5) { const bull = C.bull(); bull.play(Math.random() < 0.5 ? 'Idle_HitReact1' : 'Idle_HitReact2', { once: true, fade: 0.1 }); S.bullReact = 0.9; if (Math.random() < 0.5) C.sfx.snort(); }
    if (dance.energy > 1.05 && !dance.said) { dance.said = true; toast('The village is dancing!', 1500); C.crowdCheer(0.5, 1, 0, 'none'); }
  }
  for (const [id, lane] of [['padT', 'T'], ['padU', 'U']]) $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); strike(lane, evTime(e)); });
  $('padDone').addEventListener('click', drumStop);
  function drumUpdate(tn) {
    if (drum.free || drum.done) return;
    // count-in and a soft stick click on every beat. Clicks are booked on the audio clock a little ahead, minus the
    // speaker's own delay, so you hear each one exactly when its note reaches the line (not up to a frame late).
    const ctx = C.audio.ctx, outLat = ctx ? clamp((ctx.outputLatency || 0) + (ctx.baseLatency || 0), 0, 0.3) : 0;
    while (drum.sched <= 16 && drum.t0 + drum.sched * BEAT - tn < 0.25 + outLat) {
      if (ctx && !C.audio.muted) C.noise(Math.max(ctx.currentTime, ctx.currentTime + (drum.t0 + drum.sched * BEAT - tn) - outLat), 0.03, drum.sched < 0 ? 0.3 : 0.1, 'highpass', 3000, 1, C.audio.sfxBus);
      drum.sched++;
    }
    while (tn >= drum.t0 + drum.click * BEAT && drum.click <= 16) { $('beatCount').textContent = drum.click < 0 ? String(-drum.click) : ''; drum.click++; }
    const tj = tn - off(); // judging clock, same offset as strike()
    const hgt = drum.laneH || 200;
    for (const n of drum.notes) {
      const f = 1 - (n.time - tn) / TRAVEL;
      if (n.state === 0 && tj - n.time > WIN + 0.12) { n.state = 2; judge(n.lane, 'Miss'); } // grace: a touch that came in time may reach us a frame or two late
      const show = f > 0 && (n.state === 0 || (n.state === 1 && tn - n.time < 0.15));
      n.el.style.opacity = show ? Math.min(1, f * 4) : 0;
      if (show) n.el.style.transform = `translate3d(0,${(Math.min(f, 1.04) * hgt).toFixed(1)}px,0) scale(${n.state === 1 ? 1.5 : 1})`;
    }
    if (tj > drum.end) {
      drum.done = true; const ok = drum.hits >= NEED;
      if (drum.errs.length >= 6) { const e = drum.errs.slice().sort((a, b) => a - b), m = e[e.length >> 1]; calib = clamp(calib + m * 0.7, -0.1, 0.15); try { localStorage.setItem('khuntau-drumlag', calib.toFixed(3)); } catch (x) {} }
      pop(drum.hits + '/' + CHART.length, ok ? 'The beat is yours' : 'Need ' + NEED + '. Try again');
      if (ok) { C.crowdCheer(0.9); C.buzz([30, 40, 60]); dance.energy = 1.5; for (const c of dancers) c.play('Victory', { once: true, fade: 0.2 }); S.sat = 1.6; }
      setTimeout(() => { drumStop(); if (ok && save.ch === 3) { setChapter(4); say(T.drumWin); } else if (ok && save.ch >= 5) daily('drum', 'Tamak played'); }, 1500);
    }
  }

  /* ---------- tap games: archery and fishing share one full-screen tap layer ---------- */
  $('tapzone').addEventListener('pointerdown', (e) => { if (e.target.id === 'tapQuit') return; e.preventDefault();
    if (S.mode === 'aim') { arch.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, u: arch.u, v: arch.v }; arch.held = 0; try { $('tapzone').setPointerCapture(e.pointerId); } catch (x) {} return; }
    S.tap = true; });
  // archery: the crosshair follows the drag (so the thumb never covers the target), letting go shoots
  $('tapzone').addEventListener('pointermove', (e) => { const d = arch.drag; if (S.mode !== 'aim' || !d || d.id !== e.pointerId) return;
    const g = 1 / Math.max(arch.ppm || 120, 20); arch.u = clamp(d.u + (e.clientX - d.x) * g, -1.8, 1.8); arch.v = clamp(d.v - (e.clientY - d.y) * g, -1.4, 1.4); });
  const archRelease = (e) => { const d = arch.drag; if (S.mode !== 'aim' || !d || d.id !== e.pointerId) return; arch.drag = null; arch.rel = { u: arch.u + (arch.su || 0), v: arch.v + (arch.sv || 0) }; S.tap = true; }; // the shot goes where the crosshair was when you let go
  $('tapzone').addEventListener('pointerup', archRelease); $('tapzone').addEventListener('pointercancel', (e) => { if (arch.drag && arch.drag.id === e.pointerId) arch.drag = null; });
  const reticle = document.createElement('div'); reticle.id = 'reticle'; reticle.hidden = true;
  reticle.style.cssText = 'position:absolute;left:0;top:0;width:38px;height:38px;margin:-19px 0 0 -19px;border-radius:50%;border:3px solid #fff6e0;box-shadow:0 0 0 2px rgba(20,10,6,.85),inset 0 0 0 2px rgba(20,10,6,.85);pointer-events:none;will-change:transform';
  reticle.innerHTML = '<i style="position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px;border-radius:50%;background:#ffb347;box-shadow:0 0 0 2px rgba(20,10,6,.85)"></i>';
  $('tapzone').appendChild(reticle);
  $('tapQuit').addEventListener('click', () => { if (S.mode === 'aim' || S.mode === 'fish') tapStop(); });
  function tapOpen(mode, text) { S.mode = mode; S.tap = false; $('tapzone').hidden = false; reticle.hidden = mode !== 'aim'; tapHint(text); $('tapScore').textContent = ''; game.p.vel.set(0, 0, 0); C.player().play('Idle', { fade: 0.15 }); }
  function tapHint(text) { $('tapHint').textContent = tr(text); }
  function tapStop() { if (cine.shot) cinemaEnd(); reticle.hidden = true; arch.drag = null; S.mode = 'walk'; S.focus = null; $('tapzone').hidden = true; W.float.visible = false; W.fishM.visible = false; if (W.rod) W.rod.visible = false; if (W.line) W.line.visible = false; if (W.bow) W.bow.visible = false; if (W.nocked) W.nocked.visible = false; S.lookT = -9; S.camYaw = game.p.yaw + Math.PI; }

  const arch = { n: 0, hits: 0, t: 0, fly: null, wait: 0, over: false };
  function archStart() {
    const p = game.p; p.pos.copy(ARCH); p.yaw = Math.atan2(W.aDir.x, W.aDir.z);
    Object.assign(arch, { n: 0, hits: 0, t: rand(0, 6), fly: null, wait: 0.4, over: false, drag: null, held: 0, draw: 0 }); W.bow.visible = true; archNock(); for (const a of W.arrows) a.visible = false;
    S.focus = { pos: ARCH.clone().addScaledVector(W.aDir, -2.2).addScaledVector(W.aSide, 1.15).setY(2.3), look: TARGET.clone().addScaledVector(W.aSide, 0.35).setY(FACE_Y - 0.15) };
    $('hint').classList.remove('show');
    tapOpen('aim', C.isTouch ? 'Drag to aim, let go to shoot' : 'Drag to aim, let go to shoot. Or arrow keys and Space'); $('tapScore').textContent = '0/5';
  }
  // each arrow starts with the aim off the target, so every shot is aimed
  function archNock() { const a = rand(0, Math.PI * 2), r = rand(0.9, 1.3); arch.u = Math.cos(a) * r; arch.v = Math.sin(a) * r * 0.7; arch.held = 0; archHold(); }
  // hold the bow out: the shooting clip, frozen with the arm raised (the clip plays on from there on release)
  function archHold() { if (S.mode !== 'aim') return; const pl = C.player(), ac = pl.actions.Shoot_OneHanded; if (!ac) return; if (pl.curName !== 'Shoot_OneHanded' || !ac.paused) pl.play('Shoot_OneHanded', { once: true, fade: 0.15 }); ac.time = 0.2; ac.paused = true; }
  const FACE_R = 0.62, BULL_R = 0.13, archPt = V(), archPt2 = V();
  function archUpdate(dt) {
    // sway: a held bow never sits still; it grows a little per arrow and a lot if you hold too long (tired arms)
    arch.t += dt; if (arch.drag) arch.held += dt;
    const A = 0.07 + arch.n * 0.025 + Math.max(0, arch.held - 2.5) * 0.12, t = arch.t;
    arch.su = A * Math.sin(t * 1.9) * Math.cos(t * 0.63); arch.sv = A * 0.8 * Math.sin(t * 2.4 + 1.1);
    const u0 = arch.u + arch.su, v0 = arch.v + arch.sv;
    // crosshair: the aim point on the target's face, projected to the screen
    archPt.copy(TARGET).addScaledVector(W.aDir, -0.32).addScaledVector(W.aSide, u0).setY(FACE_Y + v0);
    archPt2.copy(archPt).addScaledVector(W.aSide, 1).project(camera); archPt.project(camera);
    const sw = innerWidth / 2, sh = innerHeight / 2, rx = (archPt.x + 1) * sw, ry = (1 - archPt.y) * sh;
    arch.ppm = Math.abs((archPt2.x - archPt.x) * sw); arch.scr = [rx, ry];
    reticle.style.transform = `translate3d(${rx.toFixed(1)}px,${ry.toFixed(1)}px,0)`;
    const r0 = Math.hypot(u0, v0); reticle.style.borderColor = r0 < FACE_R ? '#9dff9a' : '#fff6e0'; reticle.style.opacity = cine.shot ? 0 : arch.fly || arch.wait > 0 || arch.over ? 0.35 : 1;
    if (arch.fly) {
      const f = arch.fly; f.k = Math.min(1, f.k + dt / 0.42); f.a.position.lerpVectors(f.from, f.to, f.k); f.a.position.y += Math.sin(f.k * Math.PI) * 0.5;
      if (f.k >= 1) { arch.fly = null; arch.wait = 0.55;
        if (f.hit) { arch.hits++; C.sfx.snap(); C.buzz(25); for (let i = 0; i < 6; i++) C.emit(C.sparkPool, f.to, { life: 0.45, vel: V(rand(-0.8, 0.8), rand(0.3, 1.4), rand(-0.8, 0.8)), size: 0.1, grow: -0.05, grav: 5, color: 0xdfeeb0 }); /* banana fibre flies */ pop(f.bull ? 'Bullseye!' : 'Hit!', ''); W.target.rotation.z = f.bull ? 0.16 : 0.09; } else { toast('Missed', 700); for (let i = 0; i < 4; i++) C.emit(C.dustPool, f.to, { life: 0.5, vel: V(rand(-0.5, 0.5), rand(0.3, 0.8), rand(-0.5, 0.5)), size: 0.22, grow: 0.6 }); }
        $('tapScore').textContent = arch.hits + '/5';
        if (arch.n >= 5) { arch.over = true; const ok = arch.hits >= 3; setTimeout(() => { pop(arch.hits + '/5', ok ? 'Sharp eye' : 'Need 3. Try again'); if (ok) { C.crowdCheer(0.6); daily('arch', 'Archery contest'); } }, 500); setTimeout(() => { if (S.mode === 'aim') tapStop(); }, 2100); }
        else archNock(); }
    } else if (arch.wait > 0) { arch.wait -= dt; arch.rel = null; }
    else if (S.tap && !arch.over && !cine.shot) {
      const rel = arch.rel; arch.rel = null; const u = rel ? rel.u : u0, v = rel ? rel.v : v0, r = Math.hypot(u, v);
      const hit = r < FACE_R, a = W.arrows[arch.n++], pl = C.player();
      { const ac = pl.actions.Shoot_OneHanded; if (ac && pl.curName === 'Shoot_OneHanded') { ac.paused = false; ac.timeScale = 1.7; } else pl.play('Shoot_OneHanded', { once: true, fade: 0.05, ts: 1.7 }); } C.sfx.whoosh(); arch.draw = 0;
      const from = W.nocked.visible ? W.nocked.position.clone() : game.p.pos.clone().setY(1.3).addScaledVector(W.aDir, 0.5); W.nocked.visible = false; // leaves from the string
      // the arrow goes where the crosshair was: stuck in the face, or past the target and gone
      const to = hit ? TARGET.clone().addScaledVector(W.aSide, u).setY(FACE_Y + v).addScaledVector(W.aDir, -(0.32 + 0.4)) : TARGET.clone().addScaledVector(W.aSide, u * 1.4).addScaledVector(W.aDir, rand(1.2, 2.6)).setY(0.22); // a miss sticks in the ground
      a.visible = true; a.position.copy(from); a.lookAt(to); arch.fly = { a, from, to, k: 0, hit, bull: r < BULL_R };
      { const fl = arch.fly, dir = to.clone().sub(from).normalize(), side = V(dir.z, 0, -dir.x), bull = fl.bull, last = arch.n >= 5;
        cinema({ dur: hit ? (bull || last ? 2.3 : 1.8) : 1.3, at(t, P, L) {
          const flying = arch.fly === fl && fl.k < 0.55;
          if (flying) { P.copy(a.position).addScaledVector(dir, -1.25).addScaledVector(side, 0.22).y += 0.3; L.copy(a.position).addScaledVector(dir, 3); return { snap: 1e-7, zoom: 0.8 }; } // riding behind the arrow
          if (hit && !this.slowed) { this.slowed = true; game.slow = bull || last ? 1.0 : 0.6; } // the last stretch in slow motion
          P.copy(to).addScaledVector(W.aSide, hit ? 1.7 : 1.8).addScaledVector(W.aDir, hit ? -1.9 : -2.2).y = hit ? to.y + 0.35 : 0.9; L.copy(to).addScaledVector(W.aSide, hit ? 0.25 : 0); // the impact from the side, the whole face in frame
          return { snap: 0.002, zoom: hit ? (bull ? 0.62 : 0.72) : 0.75 }; } }); }
    }
    W.target.rotation.z *= Math.pow(0.02, dt); S.tap = false;
  }

  const fish = { st: 'idle', n: 0, got: 0, t: 0, bite: 0, jump: 0 };
  // a bamboo rod held in the right hand, aimed out over the water each frame (fixed to the fist it pointed at the
  // ground), and a line from its tip to the float. You used to fish with an empty hand.
  function fishingRod() {
    if (!W.rod) {
      W.rod = new THREE.Group(); const seg = (r0, r1, l, y, c) => mesh(new THREE.CylinderGeometry(r1, r0, l, 5), Mat({ color: c, roughness: 0.7 }), 0, y, 0, W.rod);
      seg(0.024, 0.018, 0.9, 0.3, 0xb8975a); seg(0.018, 0.012, 0.8, 1.15, 0xc9a866); seg(0.012, 0.006, 0.7, 1.9, 0xd2b277);
      W.rodTip = new THREE.Object3D(); W.rodTip.position.y = 2.25; W.rod.add(W.rodTip); W.rod.visible = false; scene.add(W.rod);
      W.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 10 }, () => V())), new THREE.LineBasicMaterial({ color: 0xf2efe6, transparent: true, opacity: 0.85 })); W.line.frustumCulled = false; W.line.visible = false; scene.add(W.line);
    }
    return W.rod;
  }
  function ripple(x, z, s = 1) { const r = W.ripples && W.ripples.find(q => q.t > 1.6); if (!r) return; r.t = 0; r.x = x; r.z = z; r.s = s; W.rip.visible = true; }
  function fishStart() {
    const p = game.p; p.pos.copy(FSTAND); p.yaw = Math.atan2(-W.fIn.x, -W.fIn.z);
    if (fishingRod()) W.rod.visible = true;
    Object.assign(fish, { st: 'idle', n: 0, got: 0, t: 0, jump: 0 });
    S.focus = { pos: FSTAND.clone().addScaledVector(W.fIn, 4.2).addScaledVector(V(W.fIn.z, 0, -W.fIn.x), 1.2).setY(3.1), look: POND.clone().addScaledVector(W.fIn, 1.6).setY(0.4) };
    tapOpen('fish', 'Tap to cast'); $('tapScore').textContent = '0';
  }
  function fishUpdate(dt, tn) {
    const pl = C.player(), tap = S.tap; S.tap = false; fish.t += dt;
    const next = (msg) => { fish.n++; fish.st = 'rest'; fish.t = 0; W.float.visible = false; tapHint(''); if (msg) toast(msg, 900); };
    if (fish.st === 'idle') { if (tap) { fish.st = 'wait'; fish.t = 0; fish.bite = rand(1.3, 3.6); pl.play('SwordSlash', { once: true, fade: 0.06, ts: 1.3 }); C.sfx.whoosh(); W.float.visible = true; W.float.position.copy(W.floatHome); ripple(W.floatHome.x, W.floatHome.z, 0.7); tapHint('Wait for the bite…'); } }
    else if (fish.st === 'wait') {
      W.float.position.y = 0.03 + Math.sin(tn * 3) * 0.015;
      if (tap) next('Too early'); else if (fish.t > fish.bite) { fish.st = 'bite'; fish.t = 0; C.buzz(70); ripple(W.floatHome.x, W.floatHome.z, 0.5); ripple(W.floatHome.x, W.floatHome.z, 0.9); tapHint('PULL!'); if (C.audio.ctx) C.tone(C.audio.ctx.currentTime, 'sine', 500, 180, 0.18, 0.5, C.audio.sfxBus);
        for (let i = 0; i < 5; i++) C.emit(C.sparkPool, W.floatHome, { life: 0.5, vel: V(rand(-1, 1), rand(1, 2), rand(-1, 1)), size: 0.16, grow: -0.1, grav: 5, color: 0xcfe9ff }); }
    } else if (fish.st === 'bite') {
      W.float.position.y = -0.06 + Math.sin(tn * 30) * 0.02;
      if (tap) { fish.got++; fish.jump = 0.001; ripple(W.floatHome.x, W.floatHome.z, 1.2); for (let i = 0; i < 8; i++) C.emit(C.sparkPool, W.floatHome, { life: 0.6, vel: V(rand(-1.2, 1.2), rand(1.2, 2.6), rand(-1.2, 1.2)), size: 0.14, grow: -0.08, grav: 6, color: 0xdff2ff }); pl.play('PickUp', { once: true, fade: 0.06, ts: 1.4 }); C.sfx.grab(); C.buzz([20, 30, 40]); $('tapScore').textContent = String(fish.got); next(''); pop('Got one!', ''); }
      else if (fish.t > 0.85) next('It got away');
    } else if (fish.st === 'rest' && fish.t > 1.1) {
      if (fish.n >= 3) { fish.st = 'over'; const ok = fish.got >= 2; pop(fish.got + ' fish', ok ? 'A good catch' : 'Need 2. Try again'); if (ok) daily('fish', 'Fishing'); setTimeout(() => { if (S.mode === 'fish') tapStop(); }, 1600); }
      else { fish.st = 'idle'; tapHint('Tap to cast'); }
    }
    if (fish.jump > 0) { fish.jump += dt / 0.7; const k = Math.min(1, fish.jump); W.fishM.visible = k < 1; W.fishM.position.lerpVectors(W.floatHome, t3.copy(game.p.pos).setY(1), k); W.fishM.position.y += Math.sin(k * Math.PI) * 1.6; W.fishM.rotation.set(k * 6, 0, 0); if (k >= 1) fish.jump = 0; }
  }

  /* ---------- going house to house: hear the beat, give it back ---------- */
  const echo = { seq: [], ph: 'show', k: 0, t: 0, i: 0, house: 0 };
  const GIFTS = ['They give you pitha', 'They give you rice', 'They give you handi'];
  function echoStart(i) {
    const p = game.p, j = JALE[i]; p.pos.copy(j.stand); p.yaw = j.yaw; p.vel.set(0, 0, 0); S.camYaw = j.yaw + Math.PI; S.lookT = now() + 999;
    const n = 3 + today().jv.filter(Boolean).length; echo.seq = Array.from({ length: n }, () => Math.random() < 0.5 ? 'T' : 'U');
    Object.assign(echo, { ph: 'show', k: 0, t: 0.9, i: 0, house: i });
    S.mode = 'echo'; C.musicLevel(0.05); $('pads').hidden = false; $('padDone').hidden = true; $('laneT').textContent = ''; $('laneU').textContent = ''; $('beatCount').textContent = '';
    hint('Listen…', 1600); C.player().play('Idle', { fade: 0.15 });
  }
  function echoStop() { S.mode = 'walk'; $('pads').hidden = true; C.musicLevel(0.3); S.lookT = -9; }
  function echoUpdate(dt) {
    if (echo.ph !== 'show') return; echo.t -= dt; if (echo.t > 0) return;
    if (echo.k < echo.seq.length) { drumSound(echo.seq[echo.k++], true); echo.t = 0.52; }
    else { echo.ph = 'input'; echo.i = 0; hint('Your turn', 1500); }
  }
  function echoStrike(lane) {
    if (echo.ph !== 'input') return; drumSound(lane); pulse(1, lane === 'T');
    if (lane !== echo.seq[echo.i]) { judge(lane, 'Again'); echo.ph = 'show'; echo.k = 0; echo.t = 1.1; C.buzz(60); setTimeout(() => { if (S.mode === 'echo') hint('Listen…', 1400); }, 500); return; }
    judge(lane, 'Good');
    if (++echo.i >= echo.seq.length) {
      echo.ph = 'done'; const td = today(); td.jv[echo.house] = 1; persist(); S.objKey = ''; C.crowdCheer(0.5); C.play('bells', { vol: 0.6 }); C.buzz([20, 30, 40]);
      if (td.jv.every(Boolean)) daily('jale', 'Three houses sung');
      setTimeout(() => { echoStop(); toast(GIFTS[echo.house % 3], 1500); }, 700);
    }
  }

  /* ---------- the ring ---------- */
  function startRing() { fade(() => { stop(true); C.startRing(); }, 250); }
  function villageRound() { fade(() => { stop(true); C.villageRing(); }, 250); }
  // after a round started in the village: back on the village ground, next to the khunt
  function back() {
    game.villageRun = false; $('hudScore').hidden = true; $('overScreen').hidden = true;
    fade(() => { start(true); game.p.pos.set(0, 0, 13.5); game.p.yaw = Math.PI; S.camYaw = 0; snapCam(); }, 200);
  }
  function afterRing(won) {
    game.storyRun = false; $('hudScore').hidden = true; $('overScreen').hidden = true;
    fade(() => {
      start(true); game.p.pos.set(0, 0, 13.5); game.p.yaw = Math.PI; S.camYaw = 0; snapCam();
      if (won && !save.done) { save.done = 1; setChapter(5); C.addXp(60, 'Sohrai Day complete'); setTimeout(() => { C.crowdCheer(1); say(T.ringWin, () => pop('+60 XP', 'Sohrai Day complete')); }, 500); }
      else if (won) setTimeout(() => pop('Johar!', 'Three more pitha'), 500);
      else setTimeout(() => say(T.ringLose), 500);
    }, 200);
  }

  /* ---------- start / stop ---------- */
  function start(fromRing) {
    build(); S.on = true; S.mode = 'walk'; S.dlg = null; S.focus = null; S.lock = 0.4; S.tipsy = 0; pick.on = false;
    game.mode = 'story'; game.menuOpen = false; game.spectator = false; game.slow = 0;
    Object.assign(game.p, { state: 'free', t: 0, invuln: 0 }); game.p.vel.set(0, 0, 0);
    document.documentElement.classList.add('story-on');
    for (const id of ['startScreen', 'overScreen', 'hudScore', 'pads', 'pick', 'dlg']) $(id).hidden = true;
    $('hudStory').hidden = false; $('bestChip').hidden = true; $('langBtn').hidden = false; $('tapzone').hidden = true; applyLang(); today();
    const pl = C.player(); pl.wrap.visible = true; if (pl.hide) pl.hide.visible = false; pl.play('Idle');
    C.pitha.visible = save.ch >= 4; C.handi.visible = false;
    castCrowd(); placeAnimal(); applyPaint(true);
    C.setMusic('intro'); C.musicLevel(0.3);
    if (fromRing) return;
    setTimeout(() => { if (S.on && !S.dlg) hint(C.isTouch ? (LANG === 'hi' ? 'बाएँ खींचकर चलो। काम के लिए नारंगी बटन दबाओ।' : 'Drag the left side to walk. Tap the orange button to do things.') : (LANG === 'hi' ? 'WASD से चलो। काम के लिए E दबाओ या नारंगी बटन पर क्लिक करो।' : 'Walk with WASD or the arrow keys. Press E or click the orange button to do things.'), 4500); }, 600);
    S.hintAfterDlg = true;
    if (save.ch === 0) { S.inside = true; W.room.visible = true; game.p.pos.copy(W.inside.bedSide); game.p.yaw = 0.4; setTimeout(() => { if (S.on && save.ch === 0) say(T.wake); }, 700); }
    else { S.inside = false; W.room.visible = false; game.p.pos.copy(YARD); game.p.yaw = H.rot; S.camYaw = H.rot; }
    snapCam();
  }
  function stop(keepUi) {
    if (S.rest) { S.rest = null; C.player().wrap.rotation.set(0, 0, 0); }
    S.on = false; S.dlg = null; S.focus = null; pick.on = false; if (S.mode === 'drum') drumStop(); if (S.mode === 'echo') echoStop(); if (S.mode === 'aim' || S.mode === 'fish') tapStop(); S.mode = 'walk';
    $('tapzone').hidden = true; $('langBtn').hidden = true; if (!keepUi) C.tint(C.bull(), C.animal().tint);
    document.documentElement.classList.remove('story-on');
    for (const id of ['hudStory', 'pads', 'pick', 'dlg', 'prompt']) $(id).hidden = true;
    if (W.room) W.room.visible = false; S.inside = false; if (W.marker) W.marker.visible = false;
    const pl = C.player(); if (pl.hide) pl.hide.visible = true; showSticks(false); pl.wrap.rotation.z = 0;
    releaseCrowd(); C.rope.visible = true; C.garland.visible = true; C.pitha.visible = true; C.musicLevel(0.8);
    dance.energy = 0; camera.rotation.z = 0; S.label = '';
    if (!keepUi) { game.b.pos.copy(RING_SPOT); game.b.yaw = 0; }
  }

  /* ---------- every frame ---------- */
  // Push p out of a round obstacle. If the walk was going into it, turn the blocked part of the step into a
  // sideways slide (to the side the player is already on), so you glide round people instead of stopping dead.
  function pushOut(p, cx, cz, rr, v, step) {
    let ex = p.x - cx, ez = p.z - cz; const d = Math.hypot(ex, ez);
    if (d >= rr) return;
    if (d < 1e-4) { ex = 1; ez = 0; } else { ex /= d; ez /= d; }
    p.x = cx + ex * rr; p.z = cz + ez * rr;
    const vin = -(v.x * ex + v.z * ez); // speed going into the obstacle
    if (vin <= 0 || step <= 0) return;
    const side = (v.z * ex - v.x * ez) >= 0 ? 1 : -1; // which way round is shorter
    const tx = -ez * side, tz = ex * side, s = vin * step;
    p.x += tx * s; p.z += tz * s;
    const ox = p.x - cx, oz = p.z - cz, o = Math.hypot(ox, oz); p.x = cx + ox / o * rr; p.z = cz + oz / o * rr;
  }
  function collide(p, v = ZERO, step = 0) {
    if (S.inside) {
      const { W: RW, D: RD } = ROOM, I = W.inside, lx = p.x - IN.x, lz = p.z - IN.z;
      let x = clamp(lx, -RW / 2 + 0.4, RW / 2 - 0.4), z = clamp(lz, -RD / 2 + 0.4, RD / 2 - 0.25);
      const b = I.box, dx = x - b.x, dz = z - b.z;
      if (Math.abs(dx) < b.hx + 0.3 && Math.abs(dz) < b.hz + 0.3) { if (b.hx + 0.3 - Math.abs(dx) < b.hz + 0.3 - Math.abs(dz)) x = b.x + Math.sign(dx || 1) * (b.hx + 0.3); else z = b.z + Math.sign(dz || 1) * (b.hz + 0.3); }
      const circ = I.circles.concat([[mother.wrap.position.x - IN.x, mother.wrap.position.z - IN.z, 0.35]]);
      const q = t4.set(x, 0, z);
      for (const [cx, cz, r] of circ) pushOut(q, cx, cz, r + 0.3, v, step);
      p.set(IN.x + q.x, IN.y, IN.z + q.z); return;
    }
    for (const h of C.houses) { // pushed out of each house's footprint
      const c = Math.cos(h.rot), s = Math.sin(h.rot), dx = p.x - h.x, dz = p.z - h.z;
      let lx = dx * c - dz * s, lz = dx * s + dz * c; const hx = h.w / 2 + 0.4, hz = h.d / 2 + 0.4;
      if (Math.abs(lx) < hx && Math.abs(lz) < hz) {
        if (hx - Math.abs(lx) < hz - Math.abs(lz)) lx = Math.sign(lx || 1) * hx; else lz = Math.sign(lz || 1) * hz;
        p.x = h.x + lx * c + lz * s; p.z = h.z - lx * s + lz * c;
      }
    }
    const circ = [[POND.x, POND.z, 3.0], [TARGET.x, TARGET.z, 0.5], [0, 0, 0.5], [game.b.pos.x, game.b.pos.z, 1.15], [AKHRA.x, AKHRA.z, 0.75], [majhi.wrap.position.x, majhi.wrap.position.z, 0.35], [W.tumdak.position.x, W.tumdak.position.z, 0.45]];
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) { t3.copy(GOHAL).addScaledVector(W.gR, sx * 2.1).addScaledVector(W.gF, sz * 1.7); circ.push([t3.x, t3.z, 0.3]); }
    for (const c of dancers) if (c.wrap.visible) circ.push([c.wrap.position.x, c.wrap.position.z, 0.35]);
    for (const o of C.props || []) circ.push([o.x, o.z, o.r]); // hand pump, cart, clothesline, trees // hidden dancers (slow phones) don't block
    for (const [cx, cz, r] of circ) pushOut(p, cx, cz, r + 0.32, v, step);
    const pr = Math.hypot(p.x, p.z); if (pr > VILLAGE_R) { p.x *= VILLAGE_R / pr; p.z *= VILLAGE_R / pr; }
    p.y = 0;
  }

  // the pond moves: wavelets drift, ducks paddle round with small wakes, a fish rises now and then, ripples spread
  const pondM = new THREE.Matrix4(), pondQ = new THREE.Quaternion(), pondS = V(), pondP = V(), pondE = new THREE.Euler(), pondC = new THREE.Color();
  function pondUpdate(dt, tn) {
    if (W.waves) { W.waves.material.map.offset.set(tn * 0.012, tn * 0.007); }
    if (W.ducks) for (let i = 0; i < 3; i++) { const [r, w, a0] = W.duckS[i], a = a0 + tn * w, x = POND.x + Math.cos(a) * r, z = POND.z + Math.sin(a) * r;
      pondE.set(Math.sin(tn * 2 + i) * 0.05, -a + (w > 0 ? 0 : Math.PI), 0); pondQ.setFromEuler(pondE); W.ducks.setMatrixAt(i, pondM.compose(pondP.set(x, 0.05 + Math.sin(tn * 2.3 + i) * 0.012, z), pondQ, pondS.set(1, 1, 1)));
      if (Math.random() < dt * 1.2) ripple(x - Math.cos(a + Math.sign(w) * 1.57) * 0.25, z - Math.sin(a + Math.sign(w) * 1.57) * 0.25, 0.35); }
    if (W.ducks) W.ducks.instanceMatrix.needsUpdate = true;
    if (Math.random() < dt * 0.25) { const a = rand(0, 6.28), r = rand(0.4, 2.6); ripple(POND.x + Math.cos(a) * r, POND.z + Math.sin(a) * r, rand(0.4, 0.8)); } // a fish rises
    if (W.rip && W.rip.visible) { let any = false;
      W.ripples.forEach((q, i) => { if (q.t > 1.6) return; q.t += dt; const k = q.t / 1.6; any = true; const s = q.s * (0.15 + k * 0.85);
        W.rip.setMatrixAt(i, pondM.compose(pondP.set(q.x, 0.04, q.z), pondQ.identity(), pondS.set(s, 1, s))); W.rip.setColorAt(i, pondC.setScalar(Math.max(0, 1 - k) * 0.5)); if (q.t > 1.6) W.rip.setMatrixAt(i, pondM.makeScale(0, 0, 0)); });
      W.rip.instanceMatrix.needsUpdate = true; W.rip.instanceColor.needsUpdate = true; W.rip.visible = any; }
    if (W.rod && W.rod.visible) { // butt in the hand, tip out over the water: raised to cast, lowered to the float, a jerk on the catch
      const pl = C.player(), hand = pl.root.getObjectByName('FistR') || pl.root.getObjectByName('Fist.R'), fw = V(Math.sin(game.p.yaw), 0, Math.cos(game.p.yaw));
      if (hand) hand.getWorldPosition(W.rod.position); else W.rod.position.copy(game.p.pos).setY(1);
      const st = fish.st, pitch = st === 'idle' ? 1.0 : st === 'wait' ? 0.42 : st === 'bite' ? 0.3 + Math.sin(tn * 40) * 0.06 : fish.jump > 0 ? 1.15 : 0.6;
      W.rodPitch = W.rodPitch === undefined ? pitch : W.rodPitch + (pitch - W.rodPitch) * Math.min(1, dt * (st === 'bite' ? 20 : 7));
      W.rod.quaternion.setFromUnitVectors(UP, fw.multiplyScalar(Math.cos(W.rodPitch)).add(V(0, Math.sin(W.rodPitch), 0)).normalize()); }
    if (W.line && W.rod && W.rod.visible && W.float.visible) { // the line hangs from the rod tip to the float with a little sag
      const a = W.rodTip.getWorldPosition(t1), b = W.float.position, pos = W.line.geometry.attributes.position;
      for (let i = 0; i < 10; i++) { const k = i / 9; pos.setXYZ(i, a.x + (b.x - a.x) * k, a.y + (b.y + 0.05 - a.y) * k - Math.sin(k * Math.PI) * 0.25, a.z + (b.z - a.z) * k); }
      pos.needsUpdate = true; W.line.visible = true; } else if (W.line) W.line.visible = false;
  }
  const archM = new THREE.Matrix4(), archZ = new THREE.Matrix4().makeScale(0, 0, 0), archB = new THREE.Matrix4(), archQ = new THREE.Quaternion();
  function archDecor(dt) {
    if (W.bow.visible) { const pl = C.player(), hand = pl.root.getObjectByName('FistR') || pl.root.getObjectByName('Fist.R');
      if (hand) hand.getWorldPosition(W.bow.position); else W.bow.position.copy(game.p.pos).setY(1.1);
      W.bow.position.addScaledVector(W.aSide, 0.38).y += 0.1; // a long bow, held a little toward the camera: behind the body it was invisible
      const x = V().crossVectors(UP, W.aDir).normalize(); W.bow.quaternion.setFromRotationMatrix(archB.makeBasis(x, UP, W.aDir)).multiply(archQ.setFromAxisAngle(V(0, 0, 1), W.bowCant ?? -0.28)); // canted, top out toward the camera
      const aiming = S.mode === 'aim' && !arch.fly && !arch.over && arch.wait <= 0 && !cine.shot; arch.draw = (arch.draw || 0) + ((aiming && arch.drag ? 1 : 0) - (arch.draw || 0)) * Math.min(1, dt * (arch.drag ? 5 : 18));
      const nz = -0.1 - arch.draw * 0.42, sp = W.bowString.geometry.attributes.position; sp.setZ(1, nz); sp.needsUpdate = true;
      if (aiming && C.player().curName !== 'Shoot_OneHanded') archHold();
      W.nocked.visible = aiming; if (aiming) { W.nocked.position.copy(W.bow.position).addScaledVector(W.aDir, nz + 0.42); W.nocked.quaternion.copy(W.bow.quaternion); } }
    let any = false; W.arrows.forEach((a, i) => { if (a.visible) { any = true; a.updateMatrix(); W.arrowIM.setMatrixAt(i, archM.copy(a.matrix)); } else W.arrowIM.setMatrixAt(i, archZ); });
    W.arrowIM.instanceMatrix.needsUpdate = true; W.arrowIM.visible = any;
  }
  function update(dt) {
    const p = game.p, pl = C.player(), bull = C.bull(), tn = now();
    S.lock -= dt; S.tipsy = Math.max(0, S.tipsy - dt); S.boost -= dt; S.bullReact -= dt; S.sat -= dt;
    const free = S.mode === 'walk' && !S.dlg && !pick.on && S.lock <= 0;

    // walking
    const camF = t1.copy(p.pos).sub(camera.position).setY(0).normalize(), camR = t2.crossVectors(camF, UP).normalize();
    const mv = t3.set(0, 0, 0).addScaledVector(camF, -input.y).addScaledVector(camR, input.x); let mag = Math.min(mv.length(), 1);
    if (!free) mag = 0;
    if (mag > 0.08) {
      const sp = (S.inside ? 3.4 : 5.4) * mag * (S.boost > 0 ? 1.15 : 1);
      p.vel.copy(mv).setLength(sp); p.yaw = C.turnTo(p.yaw, Math.atan2(mv.x, mv.z), 11, dt);
      pl.play(mag > 0.55 ? 'Run' : 'Walk', { ts: (mag > 0.55 ? 1 : 1.2) * (S.inside ? 0.8 : 1) });
      p.pos.addScaledVector(p.vel, dt);
    } else { p.vel.set(0, 0, 0); if (free && (pl.curName === 'Run' || pl.curName === 'Walk')) pl.play('Idle'); }
    collide(p.pos, p.vel, dt);
    pl.wrap.position.copy(p.pos); pl.wrap.rotation.y = p.yaw; pl.wrap.visible = true;
    if (S.rest && S.rest.t >= 0) { // lying on the khatia, chest rising and falling
      const r = S.rest; r.t += dt; const a = W.inside.restAt;
      pl.wrap.position.set(a.x, a.y + 0.6 + Math.sin(r.t * 1.9) * 0.008, a.z); pl.wrap.quaternion.copy(REST_Q);
      if ((r.z -= dt) < 0) { r.z = 1.5; toast('z z z…', 900); }
      if (r.t > 5 || (r.t > 0.8 && (Math.hypot(input.x, input.y) > 0.3 || S.act))) { S.act = false; wake(); }
    }
    input.roll = input.grab = input.tease = false;

    // the nearest thing to do
    const it = free ? interactions() : null; S.near = it;
    const label = it ? it.label : '';
    if (label !== S.label) {
      S.label = label; const b = $('actBtn'); b.textContent = tr(label) || '·'; b.classList.toggle('off', !label);
      const pr = $('prompt'); pr.hidden = !label; if (label) pr.innerHTML = '<kbd>E</kbd>' + tr(it.text);
    }
    if (S.act) { S.act = false; if (it) it.go(); }

    // wall paint coming up
    for (const s of W.spots) if (s.art.visible && s.k < 1) { s.k = Math.min(1, s.k + dt * 0.9); s.art.material.opacity = s.k; }

    // drums, and everyone who hears them
    if (S.mode === 'drum') drumUpdate(tn);
    else if (S.mode === 'aim') archUpdate(dt); else if (S.mode === 'fish') fishUpdate(dt, tn); else if (S.mode === 'echo') echoUpdate(dt);
    if (W.flags) for (const f of W.flags) f.children[1].rotation.y = Math.sin(tn * 2.4 + f.position.x) * 0.35;
    if (!S.inside) pondUpdate(dt, tn);
    if (W.arrowIM) archDecor(dt);
    { const td = today(); W.jale.forEach((sp, i) => { sp.visible = !S.inside && save.ch >= 1 && !td.jv[i]; if (sp.visible) sp.scale.setScalar(1 + Math.sin(tn * 3 + i) * 0.15); }); }
    dance.energy = Math.max(0, dance.energy - dt * (S.mode === 'drum' ? 0.42 : 0.7));
    if (dance.energy < 0.2) dance.said = false;
    dance.phase = lerp(dance.phase, dance.target, 1 - Math.pow(0.0008, dt));
    const amp = clamp(dance.energy, 0, 1);
    const thin = C.perf.thin; // slow phones keep two dancers
    for (let i = 0; i < dancers.length; i++) {
      const c = dancers[i]; c.wrap.visible = !thin || i < 2; if (!c.wrap.visible) continue;
      const was = c.sHop; c.sHop += dt * 3.4; const hop = c.sHop > 0 && c.sHop < 1 ? Math.sin(c.sHop * Math.PI) : 0;
      if (was < 1 && c.sHop >= 1 && amp > 0.25 && !thin) for (let k = 0; k < 2; k++) C.emit(C.dustPool, V(c.wrap.position.x + rand(-0.2, 0.2), 0.06, c.wrap.position.z + rand(-0.2, 0.2)), { life: 0.6, vel: V(rand(-0.4, 0.4), rand(0.2, 0.5), rand(-0.4, 0.4)), size: 0.28, grow: 0.7 }); // dust where their feet land
      const sway = Math.sin(dance.phase) * amp;
      c.wrap.position.copy(c.sBase).addScaledVector(c.sTan, sway * 0.55); c.wrap.position.y = hop * 0.17 * amp;
      c.wrap.rotation.y = c.sYaw + sway * 0.3; c.wrap.rotation.z = Math.cos(dance.phase) * 0.1 * amp;
      if (S.sat > 0) continue;
      if (amp > 0.18) c.play('Walk', { ts: 0.5 + amp * 0.9, fade: 0.25 }); else c.play('Idle', { fade: 0.4 });
    }
    if (amp > 0.3) { // the Majhi turns to the sound and claps along
      const ty = Math.atan2(AKHRA.x - majhi.wrap.position.x, AKHRA.z - majhi.wrap.position.z);
      majhi.wrap.rotation.y = C.turnTo(majhi.wrap.rotation.y, ty, 2.5, dt);
      if (amp > 0.9 && majhi.curName !== 'Victory') { majhi.play('Victory', { once: true, fade: 0.2 }); majhi.vt = 1.6; }
    }
    if (majhi.vt > 0) { majhi.vt -= dt; if (majhi.vt <= 0) majhi.play('Idle', { fade: 0.3 }); }
    if (mother.curName !== 'Idle' && !S.inside) mother.play('Idle');

    // the animal: eating in the shed, watching you at the ring, startled by the tamak
    if (S.bullReact <= 0 && S.bullReact > -0.1 && bull.curName !== 'Idle') bull.play(atRing() || pick.on || save.chosen ? 'Idle' : 'Eating', { fade: 0.25 });
    if (atRing()) { const ty = Math.atan2(p.pos.x - game.b.pos.x, p.pos.z - game.b.pos.z); game.b.yaw = C.turnTo(game.b.yaw, ty, 0.5, dt); }
    bull.wrap.position.copy(game.b.pos); bull.wrap.rotation.y = game.b.yaw;

    // the shed roof clears when you stand under it, so the animal is never hidden
    { const m = W.shedRoof.material, near = pick.on || (!S.inside && Math.hypot(p.pos.x - GOHAL.x, p.pos.z - GOHAL.z) < 6.5); m.opacity = lerp(m.opacity, near ? 0.12 : 1, 1 - Math.pow(0.01, dt)); m.depthWrite = m.opacity > 0.9; W.shedRoof.castShadow = m.opacity > 0.5; }
    // house lights
    if (S.inside) { const f = 1 + Math.sin(tn * 9) * 0.08 + Math.sin(tn * 23) * 0.05; W.lamp.scale.setScalar(0.5 * f); W.ember.scale.setScalar(0.9 * f); W.hlid.rotation.y += dt * 0.2; }

    objective(camF, camR);
  }

  function objective(camF, camR) {
    const p = game.p.pos; let target = null;
    const ch = save.ch;
    if (ch === 0) target = S.inside ? W.inside.handi : DOOR_OUT;
    else if (S.inside) target = W.inside.door;
    else if (ch === 1) { const i = save.painted.indexOf(0); target = i >= 0 ? W.spots[i].stand : null; }
    else if (ch === 2) target = W.gStand;
    else if (ch === 3) target = W.drumStand;
    else if (ch === 4) target = t3.set(p.x, 0, p.z).setLength(10).clone();
    let text = T.obj[ch] || '';
    if (ch >= 5) { const td = today(), jn = td.jv.filter(Boolean).length;
      if (!td.arch) { target = ARCH; text = tr('Today: archery contest'); } else if (!td.fish) { target = FSTAND; text = tr('Today: catch fish at the pond'); }
      else if (!td.jale && jn < 3) { target = JALE[td.jv.indexOf(0)].stand; text = tr('Today: sing at three houses (' + jn + '/3)'); }
      else if (!td.drum) { target = W.drumStand; text = tr('Today: beat the tamak'); } else text = tr('All done today. Come back tomorrow'); }
    if (text !== S.objKey) { S.objKey = text; $('objText').textContent = text; }
    const show = !!target && S.mode === 'walk';
    W.marker.visible = show && !(ch === 4 && Math.hypot(p.x, p.z) < 10.6);
    $('objArrow').style.visibility = target ? 'visible' : 'hidden';
    if (!target) { $('objDist').textContent = ''; return; }
    W.marker.position.set(target.x, target.y, target.z);
    const tn = now(); W.beam.material.opacity = 0.4 + Math.sin(tn * 4) * 0.12; W.mring.scale.setScalar(1 + Math.sin(tn * 4) * 0.12);
    const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
    const ang = Math.atan2(dx * camR.x + dz * camR.z, dx * camF.x + dz * camF.z);
    $('objArrow').style.transform = `rotate(${ang.toFixed(2)}rad)`;
    const dtxt = d > 2.5 ? Math.round(d) + ' m' : ''; if ($('objDist').textContent !== dtxt) $('objDist').textContent = dtxt;
  }

  /* ---------- camera: behind the player outside, a cut-away view indoors ---------- */
  const camLook = V(), camPos = V();
  function camTarget(portrait) {
    const p = game.p.pos;
    if (S.focus) { camPos.copy(S.focus.pos); if (portrait) camPos.sub(S.focus.look).multiplyScalar(1.35).add(S.focus.look); t3.copy(S.focus.look); return; }
    if (S.inside) {
      const lx = p.x - IN.x;
      camPos.set(IN.x + lx * (portrait ? 0.8 : 0.45), IN.y + (portrait ? 5.0 : 4.3), IN.z + ROOM.D / 2 + (portrait ? 5.4 : 4.9));
      t3.set(IN.x + lx * (portrait ? 0.9 : 0.6), IN.y + 0.9, IN.z - 0.9); return;
    }
    const drumming = S.mode === 'drum';
    const back = (portrait ? 7.4 : 6.2) * (drumming ? 0.9 : 1), up = (portrait ? 4.6 : 3.3) + (drumming ? 0.6 : 0);
    // pull the camera in until nothing stands between it and you: a house (walls and roof), a straw stack, a tree trunk
    // or canopy. Checking only the camera's own spot let it land beyond a house with the whole house in the way.
    // if even close in it is blocked (walking out of a door, the camera trails straight into the house), swing round to
    // the nearest clear side, keeping the side it swung to last time so it does not wobble
    const sw = S.camSide || 1; let found = false;
    for (const off of [0, 0.45 * sw, -0.45 * sw, 0.9 * sw, -0.9 * sw, 1.4 * sw, -1.4 * sw, 2 * sw, -2 * sw]) {
      for (let k = 1; k > 0.29; k -= 0.1) { const yw = S.camYaw + off, cy = up * (0.55 + 0.45 * k) + (k < 0.99 ? 0.6 : 0); camPos.set(p.x + Math.sin(yw) * back * k, cy, p.z + Math.cos(yw) * back * k);
        if (sightClear(p, camPos)) { found = true; if (off) { S.camYaw += off; S.camSide = Math.sign(off); } break; } }
      if (found) break; }
    t3.set(p.x - Math.sin(S.camYaw) * (drumming ? 3 : 1.2), 1.25, p.z - Math.cos(S.camYaw) * (drumming ? 3 : 1.2));
  }
  function sightClear(p, c) { // samples along the line from your head to the camera
    for (let i = 2; i <= 8; i++) { const t = i / 8; camQ.set(p.x + (c.x - p.x) * t, 1.4 + (c.y - 1.4) * t, p.z + (c.z - p.z) * t);
      if (camQ.y < 4.9 && inHouse(camQ, 0.35 + (camQ.y > 2.5 ? 0.45 : 0))) return false;
      for (const o of C.props || []) { const d = Math.hypot(camQ.x - o.x, camQ.z - o.z); if ((d < o.r + 0.3 && camQ.y < (o.top ?? 2.2)) || (o.cr && camQ.y > o.cy && d < o.cr)) return false; } }
    return true; }
  const camQ = V();
  function inHouse(q, m) { for (const h of C.houses) { const c = Math.cos(h.rot), s = Math.sin(h.rot), dx = q.x - h.x, dz = q.z - h.z; if (Math.abs(dx * c - dz * s) < h.w / 2 + m && Math.abs(dx * s + dz * c) < h.d / 2 + m) return true; } return false; }
  /* --- cinema: short camera shots for the moments your hands are free (an arrow in flight, a fish landing). Black bars,
     a change of lens, slow motion; a tap skips; never while you have to act; off with reduced motion. --- */
  const cine = { shot: null, t0: 0, fov: 0 };
  const cineBars = [0, 1].map(i => { const d = document.createElement('div'); d.style.cssText = `position:fixed;left:0;right:0;${i ? 'bottom' : 'top'}:0;height:0;background:#000;z-index:4;pointer-events:none;transition:height .3s ease`; document.body.appendChild(d); return d; });
  function cinema(shot) { if (C.reduceMotion) return false; cine.shot = shot; cine.t0 = now(); cine.last = 0; arch.cine = true; cineBars.forEach(b => b.style.height = '7vh'); $('tapHint').style.visibility = 'hidden'; return true; }
  function cinemaEnd() { const s2 = cine.shot; cine.shot = null; arch.cine = false; cineBars.forEach(b => b.style.height = '0'); $('tapHint').style.visibility = ''; if (game.slow > 0 && s2 && s2.slowed) game.slow = 0; if (s2 && s2.end) s2.end(); }
  document.addEventListener('pointerdown', () => { if (cine.shot && now() - cine.t0 > 0.2) cinemaEnd(); }, true); // a tap skips
  const baseFov = () => camera.aspect < 1 ? 62 : 50;
  function cineCam(dt) { // drives the camera while a shot runs; returns false when none
    const sh = cine.shot; if (!sh) { if (cine.fov) { cine.fov = 0; camera.fov = baseFov(); camera.updateProjectionMatrix(); } return false; }
    const t = now() - cine.t0; if (t > sh.dur) { cinemaEnd(); return false; }
    const tn = now(), rdt = Math.min(0.05, tn - (cine.last || tn)); cine.last = tn; // real time: slow motion must not slow the camera
    const r = sh.at(t, camPos, t3) || {}; const k = 1 - Math.pow(r.snap ?? 0.0005, Math.max(rdt, 1 / 120));
    camera.position.lerp(camPos, k); camLook.lerp(t3, k); camera.lookAt(camLook);
    const fov = baseFov() * (r.zoom ?? 1); cine.fov = cine.fov ? cine.fov + (fov - cine.fov) * Math.min(1, rdt * 6) : camera.fov; camera.fov = cine.fov; camera.updateProjectionMatrix();
    return true;
  }
  function snapCam() { camTarget(camera.aspect < 1); camera.position.copy(camPos); camLook.copy(t3); camera.lookAt(camLook); }
  function cam(dt, portrait) {
    const p = game.p, moving = p.vel.lengthSq() > 1;
    if (!S.inside && !S.focus && S.mode === 'walk' && moving && now() - S.lookT > 1.4) { // drift back behind the player
      const want = p.yaw + Math.PI; let d = want - S.camYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      S.camYaw += clamp(d, -1.2, 1.2) * dt * (Math.abs(d) > 2.4 ? 0.9 : 1.5);
    }
    if (cineCam(dt)) return;
    camTarget(portrait);
    camera.position.lerp(camPos, 1 - Math.pow(0.002, dt)); camLook.lerp(t3, 1 - Math.pow(0.001, dt)); camera.lookAt(camLook);
    if (S.tipsy > 0 && !C.reduceMotion) camera.rotateZ(Math.sin(now() * 2.1) * 0.035 * Math.min(1, S.tipsy / 2));
  }
  // drag anywhere that is not a control to look around
  const look = { id: null, x: 0 };
  addEventListener('pointerdown', (e) => {
    if (!S.on || game.mode !== 'story' || S.inside || S.mode !== 'walk' || look.id !== null) return;
    if (e.target.closest && e.target.closest('#joyzone, button, .overlay, #dlg, #pick, #pads')) return;
    look.id = e.pointerId; look.x = e.clientX;
  });
  addEventListener('pointermove', (e) => { if (e.pointerId !== look.id) return; S.camYaw -= (e.clientX - look.x) * 0.0075; look.x = e.clientX; S.lookT = now(); });
  const lookEnd = (e) => { if (e.pointerId === look.id) look.id = null; };
  addEventListener('pointerup', lookEnd); addEventListener('pointercancel', lookEnd);

  $('actBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); if (S.on && S.label) S.act = true; });
  function key(e) {
    const k = e.code;
    if (S.dlg) { if (k === 'Enter' || k === 'Space' || k === 'KeyE') { e.preventDefault(); nextLine(); } return; }
    if (pick.on) { if (k === 'ArrowLeft' || k === 'KeyA') stepPick(-1); else if (k === 'ArrowRight' || k === 'KeyD') stepPick(1); else if (k === 'Enter' || k === 'KeyE') $('pickOk').click(); return; }
    if (S.mode === 'aim') { const st = 0.06, mv = { ArrowLeft: [-st, 0], KeyA: [-st, 0], ArrowRight: [st, 0], KeyD: [st, 0], ArrowUp: [0, st], KeyW: [0, st], ArrowDown: [0, -st], KeyS: [0, -st] }[k];
      if (mv) { e.preventDefault(); arch.u = clamp(arch.u + mv[0], -1.8, 1.8); arch.v = clamp(arch.v + mv[1], -1.4, 1.4); return; } }
    if (S.mode === 'aim' || S.mode === 'fish') { if (e.repeat) return; if (k === 'Space' || k === 'Enter' || k === 'KeyE') { e.preventDefault(); S.tap = true; } return; }
    if (S.mode === 'drum' || S.mode === 'echo') { if (e.repeat) return; if (k === 'KeyF' || k === 'KeyD' || k === 'ArrowLeft') strike('T', evTime(e)); else if (k === 'KeyJ' || k === 'KeyK' || k === 'ArrowRight') strike('U', evTime(e)); else if (drum.free && (k === 'Enter' || k === 'KeyE')) drumStop(); return; }
    if (k === 'KeyE' || k === 'Enter' || k === 'Space') { e.preventDefault(); S.act = true; }
  }

  return {
    start: () => fade(() => start(false), 220), stop, update, cam, key, afterRing, back, tr,
    toMenu: C.toMenu, active: () => S.on, energy: () => dance.energy,
    wantsControls: () => S.mode === 'walk' && !S.dlg && !pick.on,
    label: () => save.done ? `Into the village · ${doneToday()}/4 done today` : save.ch > 0 ? `Into the village · Sohrai Day ${save.ch}/5` : 'Into the village · Sohrai Day',
    debug: { calib: () => calib, S, save, dance, drum, W, arch, fish, echo, today, strike, setChapter, persist, placeAnimal, snapCam, say },
  };
}
