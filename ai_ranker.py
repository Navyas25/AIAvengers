# ai_ranker.py
from sentence_transformers import SentenceTransformer, util
import PyPDF2
from docx import Document
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import os

# Load AI model (only once)
model = SentenceTransformer('all-MiniLM-L6-v2')


# ── FILE READER ──
def read_file(file_path):
    try:
        if file_path.endswith(".pdf"):
            text = ""
            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    text += page.extract_text() or ""
            return text

        elif file_path.endswith(".docx"):
            doc = Document(file_path)
            return "\n".join([p.text for p in doc.paragraphs])

        elif file_path.endswith(".txt"):
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
    return ""


# ── RANKING FUNCTION ──
def rank_resumes_ai(jd_text, resume_paths):
    resume_texts = []
    for path in resume_paths:
        text = read_file(path)
        if not text.strip():
            print(f"Warning: {path} is empty or unreadable")
        resume_texts.append(text)

    # --- AI Embedding similarity ---
    try:
        jd_emb = model.encode(jd_text, convert_to_tensor=True)
        resume_embs = model.encode(resume_texts, convert_to_tensor=True)
        scores = util.cos_sim(jd_emb, resume_embs)[0].tolist()

        results = []
        for path, score in zip(resume_paths, scores):
            results.append({
                "name": os.path.basename(path),
                "score": round(score * 100, 1)  # 0-100%
            })

        # Sort descending
        results.sort(key=lambda x: x["score"], reverse=True)
        return results

    except Exception as e:
        print("AI model failed, using fallback TF-IDF:", e)

    # --- Fallback TF-IDF ---
    vectorizer = TfidfVectorizer(stop_words="english")
    corpus = [jd_text] + resume_texts
    tfidf = vectorizer.fit_transform(corpus)
    cosine_scores = cosine_similarity(tfidf[0:1], tfidf[1:]).flatten()

    results = []
    for path, score in zip(resume_paths, cosine_scores):
        results.append({
            "name": os.path.basename(path),
            "score": round(score * 100, 1)
        })
    results.sort(key=lambda x: x["score"], reverse=True)
    return results