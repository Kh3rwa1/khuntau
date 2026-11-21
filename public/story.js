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
    mesh(new THREE.CircleGeometry(2.7, 20).rotateX(-Math.PI / 2), Mat({ color: 0xc9ab62, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }), 0, 0.02, 0, sg);
    const gw = [], gs = []; // shed timber and bamboo, fused into two pieces below
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.4, 7), wood, sx * 2.1, 1.2, sz * 1.7, sg); p.castShadow = true; gw.push(p); }
    const roof = mesh(new THREE.ConeGeometry(1, 1.3, 4, 1, true), Mat({ map: C.thatchTex, roughness: 1, side: THREE.DoubleSide, transparent: true }), 0, 3.0, 0, sg); W.shedRoof = roof; roof.rotation.y = Math.PI / 4; roof.scale.set(4.1, 1, 3.5); roof.castShadow = true;
    for (let i = 0; i < 2; i++) { const r = mesh(new THREE.CylinderGeometry(0.035, 0.035, 4.2, 5), straw, 0, 0.55 + i * 0.5, -1.7, sg); r.rotation.z = Math.PI / 2; gs.push(r); }
    for (let i = 0; i < 2; i++) { const r = mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.4, 5), straw, -2.1, 0.55 + i * 0.5, 0, sg); r.rotation.x = Math.PI / 2; gs.push(r); }
    gw.push(mesh(new THREE.BoxGeometry(1.5, 0.34, 0.5), wood, -1.0, 0.17, 1.2, sg)); gs.push(mesh(new THREE.BoxGeometry(1.34, 0.06, 0.36), straw, -1.0, 0.33, 1.2, sg));
    sg.updateMatrixWorld(true); C.bakeStatic(gw); C.bakeStatic(gs);
    const oil = mesh(potGeo, clay, 1.5, 0, 1.5, sg); oil.scale.setScalar(0.8); // the oil pot
    W.gohalYaw = sg.rotation.y;
    W.gF = V(Math.sin(W.gohalYaw), 0, Math.cos(W.gohalYaw)); W.gR = V(Math.cos(W.gohalYaw), 0, -Math.sin(W.gohalYaw));
    W.gStand = GOHAL.clone().addScaledVector(W.gF, 2.3);
    W.majhiPos = GOHAL.clone().addScaledVector(W.gF, 2.6).addScaledVector(W.gR, 2.4);

    /* --- akhra: the drum ground --- */
    W.aIn = V(-AKHRA.x, 0, -AKHRA.z).normalize(); W.aR = V(W.aIn.z, 0, -W.aIn.x);
    mesh(new THREE.CircleGeometry(4.2, 28).rotateX(-Math.PI / 2), Mat({ color: 0xa58a66, roughness: 1, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), AKHRA.x + W.aIn.x * 1.6, 0.015, AKHRA.z + W.aIn.z * 1.6, scene);
    W.tamak = C.dhamsaMesh(); W.tamak.scale.setScalar(1.35); W.tamak.position.copy(AKHRA); scene.add(W.tamak);
    W.tumdak = C.madalMesh(); W.tumdak.children.filter(o => o.material && o.material.isMeshBasicMaterial).forEach(o => W.tumdak.remove(o)); W.tumdak.scale.setScalar(1.25); W.tumdak.position.copy(AKHRA).addScaledVector(W.aR, 0.95); W.tumdak.position.y = 0.42; W.tumdak.rotation.set(0, Math.atan2(W.aR.x, W.aR.z), Math.PI / 2); scene.add(W.tumdak);
    const cradle = mesh(new THREE.BoxGeometry(0.5, 0.2, 0.3), wood, 0, 0.1, 0, scene); cradle.position.copy(AKHRA).addScaledVector(W.aR, 0.95); cradle.position.y = 0.1; cradle.rotation.y = W.tumdak.rotation.y;
    W.drumStand = AKHRA.clone().addScaledVector(W.aIn, -0.85).addScaledVector(W.aR, 0.35);

    /* --- archery ground: a shooting line, and a banana-trunk target out past the houses --- */
    const paste = Mat({ color: 0xf6eedd, roughness: 0.9 }), red = Mat({ color: 0xc0281e, roughness: 0.6 });
    const aDir = t1.copy(TARGET).sub(ARCH).setY(0).normalize().clone(); W.aDir = aDir; W.aSide = V(aDir.z, 0, -aDir.x);
    const line = mesh(new THREE.BoxGeometry(2.6, 0.02, 0.1), paste, ARCH.x + aDir.x * 0.6, 0.02, ARCH.z + aDir.z * 0.6, scene); line.rotation.y = Math.atan2(aDir.x, aDir.z);
    const flag = (pos, col) => { const g2 = new THREE.Group(); g2.position.copy(pos); mesh(new THREE.CylinderGeometry(0.03, 0.04, 3.2, 6), wood, 0, 1.6, 0, g2); const f = mesh(new THREE.PlaneGeometry(0.9, 0.5), Mat({ color: col, roughness: 0.8, side: THREE.DoubleSide }), 0.48, 2.9, 0, g2); f.name = 'cloth'; scene.add(g2); return g2; };
    W.flags = [flag(ARCH.clone().addScaledVector(W.aSide, -2.4).addScaledVector(W.aDir, -0.6), 0xffb347), flag(FSTAND.clone().addScaledVector(V(-FSTAND.z, 0, FSTAND.x).normalize(), 1.6), 0x3f8fb8)];
    const tg = new THREE.Group(); tg.position.copy(TARGET); scene.add(tg); W.target = tg;
    tg.rotation.y = Math.atan2(-aDir.x, -aDir.z); // local +z faces the shooter
    const trunk = mesh(new THREE.CylinderGeometry(0.3, 0.36, 2.6, 12), Mat({ color: 0xb7c48a, roughness: 0.8 }), 0, 1.3, 0, tg); trunk.castShadow = true;
    // painted face, big enough to read on a phone: white, red, white, red bull (radii match the hit zone)
    [[0.62, paste], [0.47, red], [0.3, paste], [0.13, red]].forEach(([r, m], i) => mesh(new THREE.CircleGeometry(r, 28), m, 0, FACE_Y, 0.31 + i * 0.006, tg));
    mesh(new THREE.CircleGeometry(0.66, 28), dark, 0, FACE_Y, 0.305, tg);
    // banana leaves: each turns to its side first, then leans out from the top of the trunk (YXZ), lit a little from within
    const bLeaf = Mat({ color: 0x6fa046, emissive: 0x1f3d12, roughness: 0.8, side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 + 0.3, lean = 0.85, lf = mesh(new THREE.PlaneGeometry(0.42, 1.4), bLeaf, Math.sin(a) * 0.62 * Math.sin(lean), 2.55 + 0.7 * Math.cos(lean), Math.cos(a) * 0.62 * Math.sin(lean), tg); lf.rotation.set(lean, a, 0, 'YXZ'); }
    const gold = Mat({ color: 0xffc23a, roughness: 0.6, side: THREE.DoubleSide });
    W.arrows = []; for (let i = 0; i < 5; i++) { const a = new THREE.Group(); mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.85, 6).rotateX(Math.PI / 2), wood, 0, 0, 0, a); mesh(new THREE.ConeGeometry(0.055, 0.14, 6).rotateX(Math.PI / 2), dark, 0, 0, 0.48, a); for (const r of [0, Math.PI / 2]) mesh(new THREE.PlaneGeometry(0.2, 0.24), gold, 0, 0, -0.34, a).rotation.set(0, Math.PI / 2, r); a.visible = false; scene.add(a); W.arrows.push(a); }

    /* --- the pond --- */
    mesh(new THREE.CircleGeometry(3.9, 28).rotateX(-Math.PI / 2), Mat({ color: 0x5a4632, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }), POND.x, 0.015, POND.z, scene);
    W.water = mesh(new THREE.CircleGeometry(3.2, 28).rotateX(-Math.PI / 2), Mat({ color: 0x3f86a8, roughness: 0.25, transparent: true, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -4 }), POND.x, 0.03, POND.z, scene);
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3, r = mesh(new THREE.ConeGeometry(0.05, rand(0.9, 1.5), 4), leaf, POND.x + Math.cos(a) * 3.3, 0.5, POND.z + Math.sin(a) * 3.3, scene); r.rotation.z = rand(-0.15, 0.15); }
    W.fIn = t1.copy(FSTAND).sub(POND).setY(0).normalize().clone();
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
    S.focus = { pos: GOHAL.clone().addScaledVector(W.gF, 1.6).addScaledVector(W.gR, 4.7).setY(1.9), look: GOHAL.clone().addScaledVector(W.gF, 0.5).setY(1.0) };
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
  function tapStop() { reticle.hidden = true; arch.drag = null; S.mode = 'walk'; S.focus = null; $('tapzone').hidden = true; W.float.visible = false; W.fishM.visible = false; S.lookT = -9; S.camYaw = game.p.yaw + Math.PI; }

  const arch = { n: 0, hits: 0, t: 0, fly: null, wait: 0, over: false };
  function archStart() {
    const p = game.p; p.pos.copy(ARCH); p.yaw = Math.atan2(W.aDir.x, W.aDir.z);
    Object.assign(arch, { n: 0, hits: 0, t: rand(0, 6), fly: null, wait: 0.4, over: false, drag: null, held: 0 }); archNock(); for (const a of W.arrows) a.visible = false;
    S.focus = { pos: ARCH.clone().addScaledVector(W.aDir, -2.2).addScaledVector(W.aSide, 1.15).setY(2.3), look: TARGET.clone().addScaledVector(W.aSide, 0.35).setY(FACE_Y - 0.15) };
    $('hint').classList.remove('show');
    tapOpen('aim', C.isTouch ? 'Drag to aim, let go to shoot' : 'Drag to aim, let go to shoot. Or arrow keys and Space'); $('tapScore').textContent = '0/5';
  }
  // each arrow starts with the aim off the target, so every shot is aimed
  function archNock() { const a = rand(0, Math.PI * 2), r = rand(0.9, 1.3); arch.u = Math.cos(a) * r; arch.v = Math.sin(a) * r * 0.7; arch.held = 0; }
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
    const r0 = Math.hypot(u0, v0); reticle.style.borderColor = r0 < FACE_R ? '#9dff9a' : '#fff6e0'; reticle.style.opacity = arch.fly || arch.wait > 0 || arch.over ? 0.35 : 1;
    if (arch.fly) {
      const f = arch.fly; f.k = Math.min(1, f.k + dt / 0.42); f.a.position.lerpVectors(f.from, f.to, f.k); f.a.position.y += Math.sin(f.k * Math.PI) * 0.5;
      if (f.k >= 1) { arch.fly = null; arch.wait = 0.55;
        if (f.hit) { arch.hits++; C.sfx.snap(); C.buzz(25); pop(f.bull ? 'Bullseye!' : 'Hit!', ''); W.target.rotation.z = f.bull ? 0.16 : 0.09; } else { f.a.visible = false; toast('Missed', 700); }
        $('tapScore').textContent = arch.hits + '/5';
        if (arch.n >= 5) { arch.over = true; const ok = arch.hits >= 3; setTimeout(() => { pop(arch.hits + '/5', ok ? 'Sharp eye' : 'Need 3. Try again'); if (ok) { C.crowdCheer(0.6); daily('arch', 'Archery contest'); } }, 500); setTimeout(() => { if (S.mode === 'aim') tapStop(); }, 2100); }
        else archNock(); }
    } else if (arch.wait > 0) { arch.wait -= dt; arch.rel = null; }
    else if (S.tap && !arch.over) {
      const rel = arch.rel; arch.rel = null; const u = rel ? rel.u : u0, v = rel ? rel.v : v0, r = Math.hypot(u, v);
      const hit = r < FACE_R, a = W.arrows[arch.n++], pl = C.player();
      pl.play('Shoot_OneHanded', { once: true, fade: 0.05, ts: 1.7 }); C.sfx.whoosh();
      const from = game.p.pos.clone().setY(1.3).addScaledVector(W.aDir, 0.5);
      // the arrow goes where the crosshair was: stuck in the face, or past the target and gone
      const to = TARGET.clone().addScaledVector(W.aSide, u).setY(FACE_Y + v).addScaledVector(W.aDir, hit ? -(0.32 + 0.4) : 3);
      a.visible = true; a.position.copy(from); a.lookAt(to); arch.fly = { a, from, to, k: 0, hit, bull: r < BULL_R };
    }
    W.target.rotation.z *= Math.pow(0.02, dt); S.tap = false;
  }

  const fish = { st: 'idle', n: 0, got: 0, t: 0, bite: 0, jump: 0 };
  function fishStart() {
    const p = game.p; p.pos.copy(FSTAND); p.yaw = Math.atan2(-W.fIn.x, -W.fIn.z);
    Object.assign(fish, { st: 'idle', n: 0, got: 0, t: 0, jump: 0 });
    S.focus = { pos: FSTAND.clone().addScaledVector(W.fIn, 4.2).addScaledVector(V(W.fIn.z, 0, -W.fIn.x), 1.2).setY(3.1), look: POND.clone().addScaledVector(W.fIn, 1.6).setY(0.4) };
    tapOpen('fish', 'Tap to cast'); $('tapScore').textContent = '0';
  }
  function fishUpdate(dt, tn) {
    const pl = C.player(), tap = S.tap; S.tap = false; fish.t += dt;
    const next = (msg) => { fish.n++; fish.st = 'rest'; fish.t = 0; W.float.visible = false; tapHint(''); if (msg) toast(msg, 900); };
    if (fish.st === 'idle') { if (tap) { fish.st = 'wait'; fish.t = 0; fish.bite = rand(1.3, 3.6); pl.play('SwordSlash', { once: true, fade: 0.06, ts: 1.3 }); C.sfx.whoosh(); W.float.visible = true; W.float.position.copy(W.floatHome); tapHint('Wait for the bite…'); } }
    else if (fish.st === 'wait') {
      W.float.position.y = 0.03 + Math.sin(tn * 3) * 0.015;
      if (tap) next('Too early'); else if (fish.t > fish.bite) { fish.st = 'bite'; fish.t = 0; C.buzz(70); tapHint('PULL!'); if (C.audio.ctx) C.tone(C.audio.ctx.currentTime, 'sine', 500, 180, 0.18, 0.5, C.audio.sfxBus);
        for (let i = 0; i < 5; i++) C.emit(C.sparkPool, W.floatHome, { life: 0.5, vel: V(rand(-1, 1), rand(1, 2), rand(-1, 1)), size: 0.16, grow: -0.1, grav: 5, color: 0xcfe9ff }); }
    } else if (fish.st === 'bite') {
      W.float.position.y = -0.06 + Math.sin(tn * 30) * 0.02;
      if (tap) { fish.got++; fish.jump = 0.001; pl.play('PickUp', { once: true, fade: 0.06, ts: 1.4 }); C.sfx.grab(); C.buzz([20, 30, 40]); $('tapScore').textContent = String(fish.got); next(''); pop('Got one!', ''); }
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
    { const td = today(); W.jale.forEach((sp, i) => { sp.visible = !S.inside && save.ch >= 1 && !td.jv[i]; if (sp.visible) sp.scale.setScalar(1 + Math.sin(tn * 3 + i) * 0.15); }); }
    dance.energy = Math.max(0, dance.energy - dt * (S.mode === 'drum' ? 0.42 : 0.7));
    if (dance.energy < 0.2) dance.said = false;
    dance.phase = lerp(dance.phase, dance.target, 1 - Math.pow(0.0008, dt));
    const amp = clamp(dance.energy, 0, 1);
    const thin = C.perf.thin; // slow phones keep two dancers
    for (let i = 0; i < dancers.length; i++) {
      const c = dancers[i]; c.wrap.visible = !thin || i < 2; if (!c.wrap.visible) continue;
      c.sHop += dt * 3.4; const hop = c.sHop > 0 && c.sHop < 1 ? Math.sin(c.sHop * Math.PI) : 0;
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
    let k = 1; // pull the camera in when a house would swallow it
    for (; k > 0.3; k -= 0.14) { camPos.set(p.x + Math.sin(S.camYaw) * back * k, up, p.z + Math.cos(S.camYaw) * back * k); if (!inHouse(camPos, 0.5)) break; }
    camPos.y = up * (0.55 + 0.45 * k) + (k < 0.99 ? 0.6 : 0);
    t3.set(p.x - Math.sin(S.camYaw) * (drumming ? 3 : 1.2), 1.25, p.z - Math.cos(S.camYaw) * (drumming ? 3 : 1.2));
  }
  function inHouse(q, m) { for (const h of C.houses) { const c = Math.cos(h.rot), s = Math.sin(h.rot), dx = q.x - h.x, dz = q.z - h.z; if (Math.abs(dx * c - dz * s) < h.w / 2 + m && Math.abs(dx * s + dz * c) < h.d / 2 + m) return true; } return false; }
  function snapCam() { camTarget(camera.aspect < 1); camera.position.copy(camPos); camLook.copy(t3); camera.lookAt(camLook); }
  function cam(dt, portrait) {
    const p = game.p, moving = p.vel.lengthSq() > 1;
    if (!S.inside && !S.focus && S.mode === 'walk' && moving && now() - S.lookT > 1.4) { // drift back behind the player
      const want = p.yaw + Math.PI; let d = want - S.camYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      S.camYaw += clamp(d, -1.2, 1.2) * dt * (Math.abs(d) > 2.4 ? 0.9 : 1.5);
    }
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
