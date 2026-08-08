/* ai_inbox.js — AI Resume Analyzer Inbox */

document.addEventListener("DOMContentLoaded", () => {
    console.log("[AI Inbox] Initialized");

    const getApiBase = () => {
        const host = window.location.hostname || "localhost";
        return `http://${host}:8000`;
    };

    const aiDropZone = document.getElementById('aiDropZone');
    const aiFileInput = document.getElementById('aiFileInput');
    const aiBrowseBtn = document.getElementById('aiBrowseBtn');
    const aiFilePreview = document.getElementById('aiFilePreview');
    const aiFileName = document.getElementById('aiFileName');
    const aiFileSize = document.getElementById('aiFileSize');
    const aiFileRemove = document.getElementById('aiFileRemove');
    const aiJdHint = document.getElementById('aiJdHint');
    const aiAnalyzeBtn = document.getElementById('aiAnalyzeBtn');

    const aiIdle = document.getElementById('aiIdle');
    const aiLoading = document.getElementById('aiLoading');
    const aiResultContent = document.getElementById('aiResultContent');

    let aiFile = null;

    // ── FILE EVENTS ──
    if (aiBrowseBtn) aiBrowseBtn.addEventListener('click', (e) => { e.stopPropagation(); aiFileInput.click(); });
    if (aiDropZone) {
        aiDropZone.addEventListener('click', () => aiFileInput.click());
        aiDropZone.addEventListener('dragover', e => { e.preventDefault(); aiDropZone.classList.add('drag-over'); });
        aiDropZone.addEventListener('dragleave', () => aiDropZone.classList.remove('drag-over'));
        aiDropZone.addEventListener('drop', e => {
            e.preventDefault();
            aiDropZone.classList.remove('drag-over');
            if (e.dataTransfer.files[0]) setAiFile(e.dataTransfer.files[0]);
        });
    }

    if (aiFileInput) {
        aiFileInput.addEventListener('change', () => {
            if (aiFileInput.files[0]) setAiFile(aiFileInput.files[0]);
        });
    }

    if (aiFileRemove) aiFileRemove.addEventListener('click', clearAiFile);

    function setAiFile(f) {
        if (!f) return;
        aiFile = f;
        if (aiFileName) aiFileName.textContent = f.name;
        
        const sizeDisp = f.size > 1048576
            ? (f.size / 1048576).toFixed(1) + ' MB'
            : Math.round(f.size / 1024) + ' KB';
        if (aiFileSize) aiFileSize.textContent = sizeDisp;

        if (aiFilePreview) aiFilePreview.style.display = 'flex';
        if (aiDropZone) aiDropZone.style.display = 'none';
        if (aiAnalyzeBtn) aiAnalyzeBtn.disabled = false;
        
        console.log(`[AI Inbox] File added: ${f.name}`);
    }

    function clearAiFile(e) {
        if (e) e.stopPropagation();
        aiFile = null;
        if (aiFileInput) aiFileInput.value = '';
        if (aiFilePreview) aiFilePreview.style.display = 'none';
        if (aiDropZone) aiDropZone.style.display = 'block';
        if (aiAnalyzeBtn) aiAnalyzeBtn.disabled = true;
        showIdle();
    }

    // ── UI STATES ──
    function showIdle() {
        if (aiIdle) aiIdle.style.display = 'flex';
        if (aiLoading) aiLoading.style.display = 'none';
        if (aiResultContent) aiResultContent.style.display = 'none';
    }

    function showLoading() {
        if (aiIdle) aiIdle.style.display = 'none';
        if (aiLoading) aiLoading.style.display = 'flex';
        if (aiResultContent) aiResultContent.style.display = 'none';
    }

    function showResults() {
        if (aiIdle) aiIdle.style.display = 'none';
        if (aiLoading) aiLoading.style.display = 'none';
        if (aiResultContent) aiResultContent.style.display = 'block';
    }

    // ── ACTION ──
    if (aiAnalyzeBtn) {
        aiAnalyzeBtn.addEventListener('click', startAnalysis);
    }

    async function startAnalysis() {
        if (!aiFile) return;

        aiAnalyzeBtn.disabled = true;
        setAnalysisLoading(true);
        showLoading();

        const form = new FormData();
        form.append('resume', aiFile);
        if (aiJdHint) form.append('job_hint', aiJdHint.value.trim());

        try {
            const res = await fetch(`${getApiBase()}/api/analyze`, {
                method: 'POST',
                body: form
            });

            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            
            const data = await res.json();
            renderAiResults(data);
            showResults();
            showAiToast("Analysis Complete ✦", "success");

        } catch (err) {
            console.error("[AI Inbox] Analysis Error:", err);
            showIdle();
            showAiToast("Analysis failed. Backend unreachable.", "error");
        } finally {
            setAnalysisLoading(false);
            aiAnalyzeBtn.disabled = false;
        }
    }

    function setAnalysisLoading(isLoading) {
        const icon = document.getElementById('aiAnalyzeBtnIcon');
        const text = document.getElementById('aiAnalyzeBtnText');
        if (icon) icon.textContent = isLoading ? '⟳' : '✦';
        if (text) text.textContent = isLoading ? 'Reading…' : 'Analyze Resume';
        if (isLoading && icon) icon.style.animation = "spin 2s linear infinite";
        else if (icon) icon.style.animation = "none";
    }

    // ── RENDER ──
    function renderAiResults(d) {
        if (!d) return;

        // Animated count for scores
        animateValue("aiOverallScore", d.score || 0);
        animateValue("aiAtsScore", d.ats_score || 0);

        // Tags
        renderTags('aiExtractedSkills', d.extracted_skills || [], 'ai-skill-tag');
        renderTags('aiMissingSkills', d.missing_skills || [], 'ai-skill-tag');

        // Lists
        renderList('aiStrengths', d.strengths || []);
        renderList('aiWeaknesses', d.weaknesses || []);
        renderList('aiImprovements', d.improvements || []);

        // Roles
        const roles = document.getElementById('aiRoles');
        if (roles) {
            roles.innerHTML = '';
            (d.recommended_roles || []).forEach((r, i) => {
                const chip = document.createElement('span');
                chip.className = 'ai-role-chip';
                chip.style.animationDelay = `${i * 0.1}s`;
                chip.textContent = r;
                roles.appendChild(chip);
            });
            if (roles.innerHTML === '') roles.innerHTML = "No recommendations found";
        }
    }

    function animateValue(id, val) {
        const el = document.getElementById(id);
        if (!el) return;
        let start = 0;
        const target = parseInt(val) || 0;
        const interval = setInterval(() => {
            if (start >= target) {
                el.textContent = target + '%';
                clearInterval(interval);
            } else {
                start += 2;
                el.textContent = start + '%';
            }
        }, 20);
    }

    function renderTags(id, arr, cls) {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '';
        arr.forEach((s, i) => {
            const tag = document.createElement('span');
            tag.className = cls;
            tag.style.animationDelay = `${i * 0.05}s`;
            tag.textContent = s;
            el.appendChild(tag);
        });
        if (arr.length === 0) el.innerHTML = "None detected";
    }

    function renderList(id, arr) {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '';
        arr.forEach((item, i) => {
            const li = document.createElement('li');
            li.style.animationDelay = `${i * 0.08}s`;
            li.textContent = item;
            el.appendChild(li);
        });
        if (arr.length === 0) el.innerHTML = "No data available";
    }

    function showAiToast(msg, type) {
        const t = document.getElementById('toast');
        if (t) {
            t.textContent = msg;
            t.className = `toast ${type} show`;
            setTimeout(() => t.classList.remove('show'), 3000);
        }
    }

});
