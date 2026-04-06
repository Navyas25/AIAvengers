# main.py
from fastapi import FastAPI, UploadFile, File, Form
from typing import List
import shutil
import os
from ai_ranker import rank_resumes_ai
from fastapi.middleware.cors import CORSMiddleware

# ── INITIALIZE APP ──
app = FastAPI(title="ResumeRanker API")

# Enable CORS (allow frontend requests)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Upload folder
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ── TEST ROUTE ──
@app.get("/")
def home():
    return {"message": "ResumeRanker API is running!"}


# ── UPLOAD + RANK ROUTE ──
@app.post("/api/upload")
async def rank_resumes(
    jd_text: str = Form(...),
    resumes: List[UploadFile] = File(...)
):
    if not resumes:
        return {"error": "No resumes uploaded"}

    file_paths = []

    # Save uploaded files
    for file in resumes:
        safe_name = file.filename.replace("/", "_").replace("\\", "_")
        file_path = os.path.join(UPLOAD_FOLDER, safe_name)
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            file_paths.append(file_path)
        except Exception as e:
            print(f"Failed to save {file.filename}: {e}")
            return {"error": f"Failed to save {file.filename}"}

    # Debug log: check what files are saved
    print("Uploaded files saved:", file_paths)
    print("JD Text:", jd_text[:50], "...")  # show first 50 chars

    # Rank resumes
    try:
        results = rank_resumes_ai(jd_text, file_paths)
        print("Ranking results:", results)
        return {"ranked": results}
    except Exception as e:
        print("Error ranking resumes:", e)
        return {"error": "Ranking failed. Check server logs."}