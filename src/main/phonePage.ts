// Telefonda açılan yükleme sayfası (tek dosya, dış bağımlılık yok)
export const PHONE_PAGE = /* html */ `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#121214" />
<title>YKS 2027 · Soru gönder</title>
<style>
  :root { --bg:#f7f7f5; --card:#fff; --text:#1e1e20; --muted:#626268; --border:#e1e1dd; --accent:#4a6c91; --ok:#488c68; --err:#b85656; }
  @media (prefers-color-scheme: dark) { :root { --bg:#121214; --card:#19191c; --text:#e8e8eb; --muted:#a0a0a8; --border:#2d2d33; --accent:#7c9cc0; --ok:#70aa86; --err:#d07676; } }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin:0; background:var(--bg); color:var(--text); font: 16px/1.45 -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 520px; margin: 0 auto; padding: 20px 16px 120px; }
  h1 { font-size: 20px; font-weight: 600; margin: 4px 0 2px; }
  .sub { color: var(--muted); font-size: 13px; margin-bottom: 20px; }
  label.t { display:block; font-size:13px; color:var(--muted); margin: 18px 0 8px; font-weight:500; }
  .pick { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; padding:16px; border:1.5px dashed var(--border); border-radius:14px; background:var(--card); color:var(--text); font-size:15px; font-weight:500; }
  .row { display:flex; gap:8px; }
  .row .pick { flex:1; }
  .thumbs { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
  .thumbs div { position:relative; }
  .thumbs img { width:84px; height:84px; object-fit:cover; border-radius:10px; border:1px solid var(--border); }
  .thumbs button { position:absolute; top:-6px; right:-6px; width:24px; height:24px; border-radius:12px; border:0; background:var(--text); color:var(--bg); font-size:14px; line-height:24px; }
  select, textarea, input[type=text] { font-family:inherit; width:100%; padding:12px; border:1px solid var(--border); border-radius:12px; background:var(--card); color:var(--text); font-size:16px; }
  textarea { min-height:70px; resize:vertical; }
  .send { position:fixed; left:0; right:0; bottom:0; padding:12px 16px calc(12px + env(safe-area-inset-bottom)); background:linear-gradient(transparent, var(--bg) 30%); }
  .send button { display:block; width:100%; max-width:520px; margin:0 auto; padding:16px; border:0; border-radius:14px; background:var(--accent); color:#fff; font-size:16px; font-weight:600; }
  .send button:disabled { opacity:.45; }
  .msg { margin-top:16px; padding:12px 14px; border-radius:12px; font-size:14px; display:none; }
  .msg.ok { display:block; background:color-mix(in srgb, var(--ok) 15%, transparent); color:var(--ok); }
  .msg.err { display:block; background:color-mix(in srgb, var(--err) 15%, transparent); color:var(--err); }
  .hint { color:var(--muted); font-size:12px; margin-top:6px; }
  input[type=file] { display:none; }
  .tabs { display:flex; gap:4px; padding:4px; border-radius:12px; background:var(--card); border:1px solid var(--border); }
  .tabs button { flex:1; padding:10px; border:0; border-radius:9px; background:transparent; color:var(--muted); font-size:15px; font-weight:600; }
  .tabs button.on { background:var(--accent); color:#fff; }
  .thumbs .n { position:absolute; left:4px; bottom:4px; min-width:20px; padding:0 5px; border-radius:6px; background:rgba(0,0,0,.6); color:#fff; font-size:11px; line-height:18px; text-align:center; }
  [hidden] { display:none !important; }
  .bookrow { display:flex; gap:8px; }
  .bookrow select { flex:1; min-width:0; }
  .bookrow input { width:78px; flex:none; }
  #bookPage, #bookQ, #bPage { text-align:center; }
</style>
</head>
<body>
<main>
  <h1>Soru gönder</h1>
  <div class="sub">YKS 2027 Takip · fotoğraflar doğrudan bilgisayarındaki Hata Defteri'ne gider</div>

  <div class="tabs">
    <button type="button" data-mode="single" class="on">Tek soru</button>
    <button type="button" data-mode="bulk">Toplu</button>
  </div>

  <div id="bulk" hidden>
    <label class="t">Soruların fotoğrafları · her fotoğraf ayrı bir soru olur</label>
    <div class="row">
      <button class="pick" type="button" data-for="bCam">📷 Fotoğraf çek</button>
      <button class="pick" type="button" data-for="bGal">🖼️ Galeriden</button>
    </div>
    <input id="bCam" type="file" accept="image/*" capture="environment" />
    <input id="bGal" type="file" accept="image/*" multiple />
    <div class="hint">Arka arkaya çekebilirsin (en fazla 40). Cevap, konu ve diğer bilgileri bilgisayarda <b>Toplu giriş</b> ekranında tek tek girersin.</div>
    <div class="thumbs" id="bThumbs"></div>

    <label class="t">Ortak bilgiler (isteğe bağlı)</label>
    <select id="bSubject"><option value="">Ders (hepsi aynı dersse seç)</option></select>
    <div class="bookrow" style="margin-top:8px">
      <select id="bBook"><option value="">Kitap (hepsi aynı kitaptansa)</option></select>
      <input id="bPage" type="text" inputmode="numeric" placeholder="Sayfa" />
    </div>
    <div style="height:8px"></div>
    <input id="bSource" type="text" placeholder="Kaynak (ör. 3D TYT Deneme 4)" />
  </div>

  <div id="single">
  <label class="t">1. Sorunun fotoğrafı</label>
  <div class="row">
    <button class="pick" type="button" data-for="qCam">📷 Fotoğraf çek</button>
    <button class="pick" type="button" data-for="qGal">🖼️ Galeriden</button>
  </div>
  <input id="qCam" type="file" accept="image/*" capture="environment" />
  <input id="qGal" type="file" accept="image/*" multiple />
  <div class="thumbs" id="qThumbs"></div>

  <label class="t">2. Benim çözüm denemem (isteğe bağlı)</label>
  <div class="row">
    <button class="pick" type="button" data-for="aCam">📷 Çek</button>
    <button class="pick" type="button" data-for="aGal">🖼️ Galeriden</button>
  </div>
  <input id="aCam" type="file" accept="image/*" capture="environment" />
  <input id="aGal" type="file" accept="image/*" multiple />
  <div class="hint">Karalamalarını silmeden çek; AI nerede takıldığını buradan bulur.</div>
  <div class="thumbs" id="aThumbs"></div>

  <label class="t">3. Ders ve konu</label>
  <select id="subject"><option value="">Ders seç (sonra da seçebilirsin)</option></select>
  <div style="height:8px"></div>
  <select id="topic" disabled><option value="">Konu (isteğe bağlı)</option></select>
  <div class="bookrow" style="margin-top:8px">
    <select id="book"><option value="">Kitap (isteğe bağlı)</option></select>
    <input id="bookPage" type="text" inputmode="numeric" placeholder="Sayfa" />
    <input id="bookQ" type="text" inputmode="numeric" placeholder="Soru" />
  </div>

  <label class="t">Cevaplar (isteğe bağlı)</label>
  <div class="row">
    <select id="correct"><option value="">Doğru cevap</option><option>A</option><option>B</option><option>C</option><option>D</option><option>E</option></select>
    <select id="mine"><option value="">Benim cevabım</option><option>A</option><option>B</option><option>C</option><option>D</option><option>E</option><option value="Boş">Boş</option></select>
  </div>
  <div style="height:8px"></div>
  <select id="help"><option value="">Kendim denedim, çözemedim</option><option value="hint">Bir ipucuna baktım, gerisini kendim yaptım</option><option value="sol">Çözüme bakarak yaptım</option></select>
  <textarea id="hint" placeholder="Neyi gördün? ör. ortak paranteze alındığını gördüm, sonrasını ben yaptım" style="display:none;margin-top:8px"></textarea>

  <label class="t">Not (isteğe bağlı)</label>
  <textarea id="note" placeholder="ör. Süre yetmedi / şıklar arasında kaldım"></textarea>
  <div style="height:8px"></div>
  <input id="source" type="text" placeholder="Kaynak (ör. 3D TYT Deneme 4)" />
  </div>

  <div class="msg" id="msg"></div>
</main>
<div class="send"><button id="send" disabled>Gönder</button></div>
<script>
(function () {
  var t = new URLSearchParams(location.search).get('t') || '';
  var MAX_BULK = 40;
  var state = { q: [], a: [], b: [] };
  var mode = 'single';
  var $ = function (id) { return document.getElementById(id); };
  $('help').addEventListener('change', function () { $('hint').style.display = $('help').value === 'hint' ? 'block' : 'none'; });
  var subjectSel = $('subject'), topicSel = $('topic'), msg = $('msg'), sendBtn = $('send');
  var catalog = [];
  var last = {};
  try { last = JSON.parse(localStorage.getItem('yks-phone-last') || '{}'); } catch (e) {}

  function fillSubjects(sel, c) {
    ['TYT', 'AYT'].forEach(function (exam) {
      var g = document.createElement('optgroup'); g.label = exam;
      c.filter(function (s) { return s.exam === exam; }).forEach(function (s) {
        var o = document.createElement('option'); o.value = s.id; o.textContent = exam + ' ' + s.name; g.appendChild(o);
      });
      sel.appendChild(g);
    });
  }

  var books = [];
  function fillBooks(sel) {
    books.forEach(function (b) { var o = document.createElement('option'); o.value = b.id; o.textContent = b.title; sel.appendChild(o); });
    sel.closest('.bookrow').hidden = !books.length;
  }
  // Kitap seçilince ders boşsa kitabın dersi seçilir
  function bookPicked(bookSel, subjSel, after) {
    bookSel.addEventListener('change', function () {
      var b = books.find(function (x) { return x.id === bookSel.value; });
      if (b && b.subjectId && !subjSel.value) { subjSel.value = b.subjectId; if (after) after(); }
    });
  }

  fetch('/api/catalog?t=' + encodeURIComponent(t)).then(function (r) { return r.json(); }).then(function (c) {
    // Eski biçim: yalnızca ders listesi; yeni biçim: { subjects, books }
    catalog = Array.isArray(c) ? c : c.subjects;
    books = Array.isArray(c) ? [] : (c.books || []);
    fillSubjects(subjectSel, catalog);
    fillSubjects($('bSubject'), catalog);
    fillBooks($('book'));
    fillBooks($('bBook'));
    bookPicked($('book'), subjectSel, fillTopics);
    bookPicked($('bBook'), $('bSubject'));
    if (last.bookId && books.some(function (b) { return b.id === last.bookId; })) { $('book').value = last.bookId; $('bBook').value = last.bookId; }
    if (last.subjectId) { subjectSel.value = last.subjectId; fillTopics(); }
  }).catch(function () { show('Bağlantı kurulamadı. Bilgisayardaki QR kodu yeniden okut.', true); });

  // Tek soru / toplu mod
  document.querySelectorAll('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      mode = b.getAttribute('data-mode');
      document.querySelectorAll('.tabs button').forEach(function (x) { x.className = x === b ? 'on' : ''; });
      $('single').hidden = mode !== 'single';
      $('bulk').hidden = mode !== 'bulk';
      msg.className = 'msg';
      render();
    });
  });

  function fillTopics() {
    topicSel.innerHTML = '<option value="">Konu (isteğe bağlı)</option>';
    var s = catalog.find(function (x) { return x.id === subjectSel.value; });
    topicSel.disabled = !s;
    if (!s) return;
    var group = null, parent = topicSel;
    s.topics.forEach(function (tp) {
      if (tp.group && tp.group !== group) { group = tp.group; parent = document.createElement('optgroup'); parent.label = tp.group; topicSel.appendChild(parent); }
      if (!tp.group) parent = topicSel;
      var o = document.createElement('option'); o.value = tp.id; o.textContent = tp.name; parent.appendChild(o);
    });
  }
  subjectSel.addEventListener('change', fillTopics);

  document.querySelectorAll('.pick').forEach(function (b) {
    b.addEventListener('click', function () { $(b.getAttribute('data-for')).click(); });
  });

  // Fotoğrafı küçült (en uzun kenar 1800 px, JPEG) — yükleme hızlı olsun
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var max = 1800, w = img.width, h = img.height, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.85));
        URL.revokeObjectURL(img.src);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  function bind(inputId, key) {
    $(inputId).addEventListener('change', function (e) {
      var files = Array.prototype.slice.call(e.target.files || []);
      Promise.all(files.map(shrink)).then(function (urls) { state[key] = state[key].concat(urls).slice(0, key === 'b' ? MAX_BULK : 6); render(); });
      e.target.value = '';
    });
  }
  bind('qCam', 'q'); bind('qGal', 'q'); bind('aCam', 'a'); bind('aGal', 'a'); bind('bCam', 'b'); bind('bGal', 'b');

  function sendLabel() {
    if (mode === 'single') return 'Gönder';
    return state.b.length ? state.b.length + ' soruyu gönder' : 'Gönder';
  }

  function render() {
    ['q', 'a', 'b'].forEach(function (key) {
      var box = $(key + 'Thumbs'); box.innerHTML = '';
      state[key].forEach(function (u, i) {
        var d = document.createElement('div');
        d.innerHTML = '<img src="' + u + '" /><button type="button">×</button>' + (key === 'b' ? '<span class="n">' + (i + 1) + '</span>' : '');
        d.querySelector('button').onclick = function () { state[key].splice(i, 1); render(); };
        box.appendChild(d);
      });
    });
    sendBtn.textContent = sendLabel();
    sendBtn.disabled = (mode === 'single' ? state.q : state.b).length === 0;
  }

  function show(text, err) { msg.textContent = text; msg.className = 'msg ' + (err ? 'err' : 'ok'); }

  function post(body) {
    return fetch('/api/upload?t=' + encodeURIComponent(t), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Hata'); return j; }); });
  }

  function sendSingle() {
    var body = { subjectId: subjectSel.value, topicId: topicSel.value, note: $('note').value, source: $('source').value, question: state.q, attempt: state.a, correctAnswer: $('correct').value, myAnswer: $('mine').value, usedSolution: $('help').value === 'sol', usedHint: $('help').value === 'hint', hintSeen: $('help').value === 'hint' ? $('hint').value : '', bookId: $('book').value, bookPage: $('bookPage').value, bookQuestion: $('bookQ').value };
    try { localStorage.setItem('yks-phone-last', JSON.stringify({ subjectId: subjectSel.value, bookId: $('book').value })); } catch (e) {}
    return post(body).then(function (j) {
      show('Gönderildi ✓ Bilgisayarda Hata Defteri\\'ne düştü (' + j.received + '). Sıradaki soruyu ekleyebilirsin.', false);
      // Kitap ve sayfa sıradaki soru için kalır, soru numarası temizlenir
      state.q = []; state.a = []; $('note').value = ''; $('correct').value = ''; $('mine').value = ''; $('help').value = ''; $('hint').value = ''; $('hint').style.display = 'none'; $('bookQ').value = '';
    });
  }

  // Toplu: her fotoğraf ayrı istek (büyük tek istek yerine; yarıda kesilirse gönderilmeyenler telefonda kalır)
  function sendBulk() {
    var total = state.b.length, sent = 0;
    var common = { subjectId: $('bSubject').value, source: $('bSource').value, bulk: true, bookId: $('bBook').value, bookPage: $('bPage').value };
    try { localStorage.setItem('yks-phone-last', JSON.stringify({ subjectId: subjectSel.value, bookId: $('bBook').value })); } catch (e) {}
    function next() {
      if (!state.b.length) return Promise.resolve();
      sendBtn.textContent = 'Gönderiliyor ' + (sent + 1) + '/' + total + '…';
      return post(Object.assign({ question: [state.b[0]] }, common)).then(function () {
        state.b.shift(); sent++; render(); sendBtn.disabled = true;
        return next();
      });
    }
    return next().then(function () {
      show(total + ' soru gönderildi ✓ Bilgisayarda Hata Defteri → Toplu giriş ile bilgilerini tek tek gir.', false);
    }, function (e) {
      throw new Error(sent + '/' + total + ' gönderildi, kalanlar telefonda duruyor. ' + e.message);
    });
  }

  sendBtn.addEventListener('click', function () {
    sendBtn.disabled = true; sendBtn.textContent = 'Gönderiliyor…';
    (mode === 'single' ? sendSingle() : sendBulk())
      .then(function () { window.scrollTo(0, 0); })
      .catch(function (e) { show(e.message + ' — bilgisayar ve telefon aynı Wi-Fi\\'da mı?', true); })
      .finally(function () { render(); });
  });
})();
</script>
</body>
</html>`
