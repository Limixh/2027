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
</style>
</head>
<body>
<main>
  <h1>Soru gönder</h1>
  <div class="sub">YKS 2027 Takip · fotoğraflar doğrudan bilgisayarındaki Hata Defteri'ne gider</div>

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

  <label class="t">Not (isteğe bağlı)</label>
  <textarea id="note" placeholder="ör. Süre yetmedi / şıklar arasında kaldım"></textarea>
  <div style="height:8px"></div>
  <input id="source" type="text" placeholder="Kaynak (ör. 3D TYT Deneme 4)" />

  <div class="msg" id="msg"></div>
</main>
<div class="send"><button id="send" disabled>Gönder</button></div>
<script>
(function () {
  var t = new URLSearchParams(location.search).get('t') || '';
  var state = { q: [], a: [] };
  var $ = function (id) { return document.getElementById(id); };
  var subjectSel = $('subject'), topicSel = $('topic'), msg = $('msg'), sendBtn = $('send');
  var catalog = [];
  var last = {};
  try { last = JSON.parse(localStorage.getItem('yks-phone-last') || '{}'); } catch (e) {}

  fetch('/api/catalog?t=' + encodeURIComponent(t)).then(function (r) { return r.json(); }).then(function (c) {
    catalog = c;
    ['TYT', 'AYT'].forEach(function (exam) {
      var g = document.createElement('optgroup'); g.label = exam;
      c.filter(function (s) { return s.exam === exam; }).forEach(function (s) {
        var o = document.createElement('option'); o.value = s.id; o.textContent = exam + ' ' + s.name; g.appendChild(o);
      });
      subjectSel.appendChild(g);
    });
    if (last.subjectId) { subjectSel.value = last.subjectId; fillTopics(); }
  }).catch(function () { show('Bağlantı kurulamadı. Bilgisayardaki QR kodu yeniden okut.', true); });

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
      Promise.all(files.map(shrink)).then(function (urls) { state[key] = state[key].concat(urls).slice(0, 6); render(); });
      e.target.value = '';
    });
  }
  bind('qCam', 'q'); bind('qGal', 'q'); bind('aCam', 'a'); bind('aGal', 'a');

  function render() {
    ['q', 'a'].forEach(function (key) {
      var box = $(key + 'Thumbs'); box.innerHTML = '';
      state[key].forEach(function (u, i) {
        var d = document.createElement('div');
        d.innerHTML = '<img src="' + u + '" /><button type="button">×</button>';
        d.querySelector('button').onclick = function () { state[key].splice(i, 1); render(); };
        box.appendChild(d);
      });
    });
    sendBtn.disabled = state.q.length === 0;
  }

  function show(text, err) { msg.textContent = text; msg.className = 'msg ' + (err ? 'err' : 'ok'); }

  sendBtn.addEventListener('click', function () {
    sendBtn.disabled = true; sendBtn.textContent = 'Gönderiliyor…';
    var body = { subjectId: subjectSel.value, topicId: topicSel.value, note: $('note').value, source: $('source').value, question: state.q, attempt: state.a };
    try { localStorage.setItem('yks-phone-last', JSON.stringify({ subjectId: subjectSel.value })); } catch (e) {}
    fetch('/api/upload?t=' + encodeURIComponent(t), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Hata'); return j; }); })
      .then(function (j) {
        show('Gönderildi ✓ Bilgisayarda Hata Defteri\\'ne düştü (' + j.received + '). Sıradaki soruyu ekleyebilirsin.', false);
        state = { q: [], a: [] }; $('note').value = ''; render(); window.scrollTo(0, 0);
      })
      .catch(function (e) { show(e.message + ' — bilgisayar ve telefon aynı Wi-Fi\\'da mı?', true); })
      .finally(function () { sendBtn.textContent = 'Gönder'; sendBtn.disabled = state.q.length === 0; });
  });
})();
</script>
</body>
</html>`
