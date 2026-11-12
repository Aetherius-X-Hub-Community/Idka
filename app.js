const STARTING_CHIPS = 100000;
const $ = (id) => document.getElementById(id);
const store = {
  get(key, fallback) { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
};
let chips = Math.min(STARTING_CHIPS, Math.max(0, Number(store.get('voxforge_chips', STARTING_CHIPS)) || 0));
let selectedFile = null;
let recorder = null;
let recordingChunks = [];
let recordingStream = null;
let recordingStarted = 0;
let recordingTimer = null;

function toast(message) {
  const el = $('toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
}
function setPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${page}`));
  document.querySelectorAll('.nav-item[data-page], .subnav button[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  document.querySelectorAll('.subnav button[data-page]').forEach(b => b.classList.toggle('active-sub', b.dataset.page === page));
  const labels = {studio:'Main services',downloads:'Downloads',voices:'Voices',history:'History',settings:'Settings',information:'Information',report:'Report bug'};
  $('breadcrumbPage').textContent = labels[page] || page;
  $('sidebar').classList.remove('open');
  if (page === 'voices') renderVoices();
  if (page === 'downloads') renderDownloads();
}
document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => setPage(b.dataset.page)));
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => setPage(b.dataset.go)));
function toggleDropdown(buttonId, panelId) {
  const button = $(buttonId), panel = $(panelId);
  const open = panel.classList.toggle('open');
  button.classList.toggle('expanded', open);
  button.setAttribute('aria-expanded', String(open));
}
$('helpToggle').addEventListener('click', () => toggleDropdown('helpToggle', 'helpSubnav'));
$('mainToggle').addEventListener('click', () => toggleDropdown('mainToggle', 'mainSubnav'));
$('preferencesToggle').addEventListener('click', () => toggleDropdown('preferencesToggle', 'preferencesSubnav'));
$('mobileMenu').addEventListener('click', () => $('sidebar').classList.toggle('open'));
$('workspaceButton').addEventListener('click', () => {
  const panel = $('workspaceDetails');
  const open = panel.classList.toggle('open');
  $('workspaceButton').classList.toggle('expanded', open);
  $('workspaceButton').setAttribute('aria-expanded', String(open));
});

function updateChips() {
  $('chipBalance').textContent = chips.toLocaleString('en-US');
  $('workspaceChipBalance').textContent = chips.toLocaleString('en-US');
  store.set('voxforge_chips', chips);
  updateScriptStats();
}
function updateScriptStats() {
  const value = $('scriptText').value;
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const chars = [...value].length;
  $('wordCount').textContent = `${words.toLocaleString()} / 10,000 words`;
  $('charCount').textContent = chars.toLocaleString();
  $('chipCost').textContent = chars.toLocaleString();
  $('wordCount').style.color = words > 10000 ? 'var(--danger)' : '';
  $('cloneButton').disabled = !selectedFile || words === 0 || words > 10000 || chars > chips;
}
$('scriptText').addEventListener('input', updateScriptStats);
$('chipInfo').addEventListener('click', () => toast('Each character, space and symbol costs 1 chip.'));
$('resetButton').addEventListener('click', () => {
  if (confirm('Reset your chip balance to 100,000?')) { chips = STARTING_CHIPS; updateChips(); toast('Chip balance reset.'); }
});

function setSelectedFile(file) {
  if (!file) return;
  if (!file.type.startsWith('audio/')) { toast('Please choose an audio file.'); return; }
  selectedFile = file;
  $('selectedAudio').classList.remove('hidden');
  $('audioName').textContent = file.name;
  $('audioMeta').textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB · Ready to save`;
  $('voiceName').value = file.name.replace(/\.[^.]+$/, '').slice(0,40);
  $('saveVoiceButton').disabled = false;
  updateScriptStats();
}
$('audioFile').addEventListener('change', e => setSelectedFile(e.target.files[0]));
$('removeAudio').addEventListener('click', () => {
  selectedFile = null; $('audioFile').value = ''; $('selectedAudio').classList.add('hidden'); $('saveVoiceButton').disabled = true; updateScriptStats();
});
$('dropZone').addEventListener('dragover', e => { e.preventDefault(); $('dropZone').style.borderColor = 'var(--accent)'; });
$('dropZone').addEventListener('dragleave', () => $('dropZone').style.borderColor = '');
$('dropZone').addEventListener('drop', e => { e.preventDefault(); $('dropZone').style.borderColor = ''; setSelectedFile(e.dataTransfer.files[0]); });

$('recordButton').addEventListener('click', async () => {
  if (recorder && recorder.state === 'recording') { recorder.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { toast('Audio recording is not supported in this browser.'); return; }
  try {
    recordingStream = await navigator.mediaDevices.getUserMedia({audio:true});
    recordingChunks = [];
    recorder = new MediaRecorder(recordingStream);
    recorder.ondataavailable = e => { if (e.data.size) recordingChunks.push(e.data); };
    recorder.onstop = () => {
      clearInterval(recordingTimer); recordingStream.getTracks().forEach(t => t.stop());
      const blob = new Blob(recordingChunks, {type: recorder.mimeType || 'audio/webm'});
      setSelectedFile(new File([blob], `voice-sample-${Date.now()}.webm`, {type:blob.type}));
      $('recordButton').textContent = '● Record'; $('recordStatus').textContent = 'Recording ready to use.';
    };
    recorder.start(); recordingStarted = Date.now();
    $('recordButton').textContent = '■ Stop recording'; $('recordStatus').textContent = 'Recording… 00:00';
    recordingTimer = setInterval(() => {
      const seconds = Math.floor((Date.now()-recordingStarted)/1000);
      $('recordStatus').textContent = `Recording… ${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
    }, 500);
  } catch { toast('Microphone permission was not granted.'); }
});

// IndexedDB stores the actual audio blobs; localStorage is used for small metadata and chip balance.
function openDB() {
  return new Promise((resolve,reject) => {
    const req = indexedDB.open('voxforge_assets',1);
    req.onupgradeneeded = () => req.result.createObjectStore('audio',{keyPath:'id'});
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}
async function saveAudioAsset(id, file) {
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const tx = db.transaction('audio','readwrite'); tx.objectStore('audio').put({id,blob:file});
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}
async function deleteAudioAsset(id) {
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const tx = db.transaction('audio','readwrite'); tx.objectStore('audio').delete(id);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}
async function getAudioAsset(id) {
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const req = db.transaction('audio','readonly').objectStore('audio').get(id);
    req.onsuccess = () => resolve(req.result?.blob || null); req.onerror = () => reject(req.error);
  });
}
$('saveVoiceButton').addEventListener('click', async () => {
  if (!selectedFile) return;
  const name = $('voiceName').value.trim() || 'Untitled voice';
  const voices = store.get('voxforge_voices',[]);
  const id = `voice-${Date.now()}`;
  try {
    await saveAudioAsset(id, selectedFile);
    voices.unshift({id,name,fileName:selectedFile.name,size:selectedFile.size,createdAt:new Date().toISOString()});
    store.set('voxforge_voices',voices);
    renderCounts(); renderVoices(); toast('Voice sample saved to your library.');
  } catch { toast('Could not save this recording. Device storage may be full.'); }
});
function renderCounts() {
  $('voiceCount').textContent = store.get('voxforge_voices',[]).length;
  $('downloadCount').textContent = store.get('voxforge_downloads',[]).length;
}
function renderVoices() {
  const voices = store.get('voxforge_voices',[]);
  $('voicesEmpty').style.display = voices.length ? 'none' : 'flex';
  $('voicesList').innerHTML = '';
  voices.forEach(v => {
    const row = document.createElement('div'); row.className='saved-item';
    row.innerHTML = `<div class="item-icon">♬</div><div class="item-copy"><b></b><small></small></div><button class="button button-secondary use-voice">Use</button><button class="button button-danger delete-voice">Delete</button>`;
    row.querySelector('b').textContent=v.name;
    row.querySelector('small').textContent=`${v.fileName} · ${new Date(v.createdAt).toLocaleDateString()}`;
    row.querySelector('.use-voice').addEventListener('click',async()=>{
      const blob=await getAudioAsset(v.id);
      if (!blob) return toast('The saved audio file could not be found.');
      setSelectedFile(new File([blob],v.fileName,{type:blob.type})); $('voiceName').value=v.name; setPage('studio'); toast('Voice sample selected.');
    });
    row.querySelector('.delete-voice').addEventListener('click',async()=>{
      if (!confirm(`Delete "${v.name}" from your voice library?`)) return;
      store.set('voxforge_voices',voices.filter(x=>x.id!==v.id)); await deleteAudioAsset(v.id); renderCounts(); renderVoices();
    });
    $('voicesList').appendChild(row);
  });
}
function renderDownloads() {
  const downloads=store.get('voxforge_downloads',[]);
  $('downloadsEmpty').style.display=downloads.length?'none':'flex';
  $('downloadsList').innerHTML='';
  downloads.forEach(d=>{
    const row=document.createElement('div');row.className='saved-item';
    row.innerHTML=`<div class="item-icon">♫</div><div class="item-copy"><b></b><small></small></div>`;
    row.querySelector('b').textContent=d.name;row.querySelector('small').textContent=`${d.characters} characters · ${new Date(d.createdAt).toLocaleString()}`;
    $('downloadsList').appendChild(row);
  });
}
$('cloneButton').addEventListener('click', () => {
  toast('Voice engine is not connected yet. This is the interface-only milestone.');
});
$('bugForm').addEventListener('submit',e=>{
  e.preventDefault();
  const reports=store.get('voxforge_bug_reports',[]);
  reports.unshift({title:$('bugTitle').value.trim(),details:$('bugDetails').value.trim(),createdAt:new Date().toISOString()});
  store.set('voxforge_bug_reports',reports); $('bugForm').reset(); $('bugFeedback').textContent='Bug report saved in this browser.'; toast('Bug report saved locally.');
});
updateChips();renderCounts();