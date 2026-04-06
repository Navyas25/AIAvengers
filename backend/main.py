from fastapi import FastAPI, UploadFile, File, Form
from typing import List, Optional
import shutil
import os
from ai_ranker import rank_resumes_ai, analyze_single_resume
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="ResumeRanker API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Explicitly exposing for preflight
    expose_headers=["*"],
)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.get("/")
def home():
    return {"message": "ResumeRanker API v2 is running!", "status": "ok"}

@app.get("/api/health")
def health_check():
    """Connectivity check for frontend indicator."""
    return {"status": "ok", "version": "2.0"}

@app.post("/api/upload")
async def rank_resumes(
    jd_text: str = Form(...),
    resumes: List[UploadFile] = File(...)
):
    file_paths = []
    for file in resumes:
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file_paths.append(file_path)

    results = rank_resumes_ai(jd_text, file_paths)
    return {"ranked": results}

@app.post("/api/analyze")
async def analyze_resume(
    resume: UploadFile = File(...),
    job_hint: Optional[str] = Form("")
):
    """Single-resume AI Inbox analyzer — returns full ATS breakdown."""
    file_path = os.path.join(UPLOAD_FOLDER, resume.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(resume.file, buffer)

    result = analyze_single_resume(file_path, job_hint or "")
    return result

