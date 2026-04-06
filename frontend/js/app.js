/* app.js — ResumeRanker Main Logic */

document.addEventListener("DOMContentLoaded", () => {
    console.log("[Ranker] Initialized");

    // ── API CONFIG ──
    const getApiBase = () => {
        const host = window.location.hostname || "localhost";
        return `http://${host}:8000`;
    };

    const checkApiStatus = async () => {
        const dot = document.getElementById('apiStatus');
        const text = dot?.querySelector('.status-text');
        try {
            const res = await fetch(`${getApiBase()}/api/health`);
            if (res.ok) {
                dot.classList.add('online');
                dot.classList.remove('offline');
                if (text) text.textContent = "API Live";
            } else {
                throw new Error();
            }
        } catch (e) {
            dot.classList.add('offline');
            dot.classList.remove('online');
            if (text) text.textContent = "API Down";
        }
    };

    // Health check every 10 seconds
    checkApiStatus();
    setInterval(checkApiStatus, 10000);

    // ── ELEMENTS ──
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    const fileCount = document.getElementById('fileCount');
    const rankBtn = document.getElementById('rankBtn');
    const jdInput = document.getElementById('jdInput');
    const progressSection = document.getElementById('progressSection');
    const progressBar = document.getElementById('progressBar');
    const progressPct = document.getElementById('progressPct');

    let uploadedFiles = [];

    // ── FILE HANDLING ──
    if (dropZone) {
        dropZone.addEventListener('click', () => fileInput.click());
        
        dropZone.addEventListener('dragover', e => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files) {
                addFiles([...e.dataTransfer.files]);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files) {
                addFiles([...fileInput.files]);
            }
        });
    }

    function addFiles(newFiles) {
        newFiles.forEach(f => {
            if (!uploadedFiles.find(u => u.name === f.name && u.size === f.size)) {
                uploadedFiles.push(f);
            }
        });
        renderFiles();
        checkReady();
    }

    function renderFiles() {
        if (!fileList) return;
        fileList.innerHTML = '';

        uploadedFiles.forEach((f, i) => {
            const item = document.createElement('div');
            item.className = 'file-item';

            const ext = f.name.split('.').pop().toLowerCase();
            const icon = ext === 'pdf' ? '📄' : (ext === 'docx' || ext === 'doc') ? '📃' : '📝';
            const size = f.size > 1048576
                ? (f.size / 1048576).toFixed(1) + ' MB'
                : Math.round(f.size / 1024) + ' KB';

            item.innerHTML = `
                <span class="file-icon">${icon}</span>
                <span class="file-name" title="${f.name}">${f.name}</span>
                <span class="file-size">${size}</span>
                <button class="file-remove" data-index="${i}">✕</button>
            `;

            item.querySelector('.file-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                removeFile(i);
            });

            fileList.appendChild(item);
        });

        if (fileCount) {
            if (uploadedFiles.length > 0) {
                fileCount.style.display = 'inline-block';
                fileCount.textContent = uploadedFiles.length + ' file' + (uploadedFiles.length > 1 ? 's' : '');
            } else {
                fileCount.style.display = 'none';
            }
        }
    }

    function removeFile(idx) {
        uploadedFiles.splice(idx, 1);
        renderFiles();
        checkReady();
    }

    // ── READINESS ──
    function checkReady() {
        if (!rankBtn || !jdInput) return;
        const jdText = (jdInput.value || "").trim();
        const hasJD = jdText.length > 5;
        const hasFiles = uploadedFiles.length > 0;
        
        rankBtn.disabled = !(hasJD && hasFiles);
        
        const hint = document.querySelector('.rank-hint');
        if (hint) {
            if (!hasFiles && !hasJD) hint.textContent = "Add a JD and at least 1 resume to begin";
            else if (!hasJD) hint.textContent = "Please provide a Job Description";
            else if (!hasFiles) hint.textContent = "Please upload at least one resume";
            else hint.textContent = "Ready to rank!";
        }
    }

    if (jdInput) {
        jdInput.addEventListener('input', checkReady);
        jdInput.addEventListener('change', checkReady);
    }

    // ── RANKING ──
    if (rankBtn) {
        rankBtn.addEventListener('click', startRanking);
    }

    async function startRanking() {
        if (rankBtn.disabled) return;
        
        rankBtn.disabled = true;
        setBtnLoading(true);
        showProgress(true);

        const formData = new FormData();
        formData.append("jd_text", jdInput.value);
        uploadedFiles.forEach(file => {
            formData.append("resumes", file);
        });

        try {
            const res = await fetch(`${getApiBase()}/api/upload`, {
                method: "POST",
                body: formData
            });

            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            
            const data = await res.json();
            if (!data.ranked) throw new Error("Invalid response from server");

            showResults(data.ranked);
            showToast(`Successfully ranked ${data.ranked.length} candidates`, "success");

        } catch (err) {
            console.error("[Ranker] Error:", err);
            showToast("Connection failed. Ensure backend is running.", "error");
        } finally {
            setBtnLoading(false);
            rankBtn.disabled = false;
        }
    }

    function setBtnLoading(isLoading) {
        const icon = document.getElementById('rankBtnIcon');
        const text = document.getElementById('rankBtnText');
        if (icon) icon.textContent = isLoading ? '⟳' : '⚡';
        if (text) text.textContent = isLoading ? 'Ranking…' : 'Rank Resumes';
        if (isLoading && icon) icon.style.animation = "spin 1s linear infinite";
        else if (icon) icon.style.animation = "none";
    }

    function showProgress(show) {
        if (!progressSection) return;
        progressSection.style.display = show ? 'block' : 'none';
        if (show) {
            let p = 0;
            progressBar.style.width = '0%';
            const inv = setInterval(() => {
                p += 5;
                if (progressBar) progressBar.style.width = p + '%';
                if (progressPct) progressPct.textContent = p + '%';
                if (p >= 100) clearInterval(inv);
            }, 100);
        }
    }

    function showResults(results) {
        const board = document.getElementById('leaderboard');
        if (!board) return;
        board.innerHTML = '';

        document.getElementById('metaTotal').textContent = results.length;
        document.getElementById('metaTop').textContent = results[0].score + '%';

        results.forEach((r, i) => {
            const card = document.createElement('div');
            card.className = `resume-card rank-${i+1}`;
            card.style.animationDelay = `${i * 0.1}s`;

            card.innerHTML = `
                <div class="rank-num">${i + 1}</div>
                <div class="card-info">
                    <div class="card-name">${r.name}</div>
                    <div class="card-meta" style="font-size:0.7rem; color:#475569; margin-top:4px;">
                        ${r.extracted_skills ? r.extracted_skills.slice(0,3).join(', ') + '...' : ''}
                    </div>
                </div>
                <div class="card-score-wrap">
                    <div class="score-num">${r.score}%</div>
                </div>
            `;
            board.appendChild(card);
        });

        const section = document.getElementById('results');
        if (section) {
            section.style.display = 'block';
            setTimeout(() => section.scrollIntoView({ behavior: 'smooth' }), 100);
        }
    }

    window.clearResults = function() {
        const resSection = document.getElementById('results');
        if (resSection) resSection.style.display = 'none';
        showProgress(false);
        uploadedFiles = [];
        renderFiles();
        if (jdInput) jdInput.value = '';
        checkReady();
        showToast("Cleared all data", "success");
    };

    function showToast(msg, type = '') {
        const t = document.getElementById('toast');
        if (!t) return;
        t.textContent = msg;
        t.className = 'toast ' + type + ' show';
        setTimeout(() => t.classList.remove('show'), 3000);
    }

    // Run initial check
    checkReady();
});