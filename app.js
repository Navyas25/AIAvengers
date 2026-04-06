document.addEventListener("DOMContentLoaded", () => {

  // ── ELEMENTS ──
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const fileList = document.getElementById('fileList');
  const fileCount = document.getElementById('fileCount');
  const rankBtn = document.getElementById('rankBtn');
  const jdInput = document.getElementById('jdInput');

  let uploadedFiles = [];

  // ── FILE HANDLING ──
  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    addFiles([...e.dataTransfer.files]);
  });

  fileInput.addEventListener('change', () => addFiles([...fileInput.files]));

  function addFiles(newFiles) {
    newFiles.forEach(f => {
      if (!uploadedFiles.find(u => u.name === f.name)) {
        uploadedFiles.push(f);
      }
    });
    renderFiles();
    checkReady();
  }

  function renderFiles() {
    fileList.innerHTML = '';
    uploadedFiles.forEach((f, i) => {
      const item = document.createElement('div');
      item.className = 'file-item';

      const ext = f.name.split('.').pop().toLowerCase();
      const icon = ext === 'pdf' ? '📄' : ext === 'txt' ? '📝' : '📃';
      const size = f.size > 1048576
        ? (f.size / 1048576).toFixed(1) + ' MB'
        : Math.round(f.size / 1024) + ' KB';

      item.innerHTML = `
        <span class="file-icon">${icon}</span>
        <span class="file-name">${f.name}</span>
        <span class="file-size">${size}</span>
        <button class="file-remove" data-index="${i}">✕</button>
      `;

      item.querySelector('.file-remove').addEventListener('click', () => removeFile(i));

      fileList.appendChild(item);
    });

    if (uploadedFiles.length > 0) {
      fileCount.style.display = '';
      fileCount.textContent = uploadedFiles.length + ' file' + (uploadedFiles.length > 1 ? 's' : '');
    } else {
      fileCount.style.display = 'none';
    }
  }

  function removeFile(idx) {
    uploadedFiles.splice(idx, 1);
    renderFiles();
    checkReady();
  }

  function checkReady() {
    rankBtn.disabled = !(uploadedFiles.length > 0 && jdInput.value.trim().length > 10);
  }

  jdInput.addEventListener('input', checkReady);

  // ── RANK BUTTON ──
  rankBtn.addEventListener('click', startRanking);

  async function startRanking() {
    rankBtn.disabled = true;
    setBtnLoading(true);

    showProgress();

    const formData = new FormData();
    formData.append("jd_text", jdInput.value);

    uploadedFiles.forEach(file => {
      formData.append("resumes", file);
    });

    try {
      const res = await fetch("http://127.0.0.1:8000/api/upload", {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (!data.ranked) throw new Error("Invalid response from backend");

      showResults(data.ranked);

      showToast(`✓ ${data.ranked.length} resumes ranked`, "success");

    } catch (err) {
      console.error(err);
      showToast("❌ Backend error. Make sure FastAPI is running", "error");
    }

    setBtnLoading(false);
    rankBtn.disabled = false;
  }

  // ── BUTTON UI ──
  function setBtnLoading(isLoading) {
    document.getElementById('rankBtnIcon').textContent = isLoading ? '⟳' : '⚡';
    document.getElementById('rankBtnText').textContent = isLoading ? 'Ranking…' : 'Re-Rank';
  }

  // ── PROGRESS BAR ──
  function showProgress() {
    const prog = document.getElementById('progressSection');
    prog.style.display = 'block';

    const bar = document.getElementById('progressBar');
    const pctEl = document.getElementById('progressPct');

    let progress = 0;

    const interval = setInterval(() => {
      progress += 10;
      bar.style.width = progress + '%';
      pctEl.textContent = progress + '%';

      if (progress >= 100) clearInterval(interval);
    }, 150);
  }

  // ── DISPLAY RESULTS ──
  function showResults(results) {
    const board = document.getElementById('leaderboard');
    board.innerHTML = '';

    document.getElementById('metaTotal').textContent = results.length;
    document.getElementById('metaTop').textContent = results[0].score + '%';

    results.forEach((r, i) => {
      const card = document.createElement('div');
      card.className = 'resume-card';

      card.innerHTML = `
        <div class="rank-num">${i + 1}</div>
        <div class="card-info">
          <div class="card-name">${r.name}</div>
        </div>
        <div class="card-score-wrap">
          <div class="score-num">${r.score}%</div>
        </div>
      `;

      board.appendChild(card);
    });

    document.getElementById('results').style.display = 'block';
    document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
  }

  // ── CLEAR SESSION ──
  window.clearResults = function () {
    document.getElementById('results').style.display = 'none';
    document.getElementById('progressSection').style.display = 'none';

    uploadedFiles = [];
    renderFiles();

    jdInput.value = '';
    checkReady();

    setBtnLoading(false);

    showToast("Session cleared", "success");
  };

  // ── TOAST NOTIFICATIONS ──
  function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast ' + type;
    t.classList.add('show');

    setTimeout(() => t.classList.remove('show'), 3000);
  }

});