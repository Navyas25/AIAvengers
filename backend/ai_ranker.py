import os
import json
import re
import PyPDF2
from docx import Document

# ── Optional: Gemini AI (falls back to TF-IDF if no API key) ──
try:
    import google.generativeai as genai
    from dotenv import load_dotenv
    load_dotenv()
    API_KEY = os.getenv("GEMINI_API_KEY", "")
    if API_KEY and API_KEY != "paste_your_api_key_here":
        genai.configure(api_key=API_KEY)
        gemini_model = genai.GenerativeModel("gemini-1.5-flash")
        USE_GEMINI = True
    else:
        USE_GEMINI = False
except ImportError:
    USE_GEMINI = False

# ── TF-IDF fallback ──
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ── Optional sentence-transformers ──
try:
    from sentence_transformers import SentenceTransformer, util as st_util
    _st_model = SentenceTransformer('all-MiniLM-L6-v2')
    USE_ST = True
except Exception:
    USE_ST = False


# ── FILE READER ──
def read_file(file_path: str) -> str:
    try:
        if file_path.endswith(".pdf"):
            text = ""
            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    text += page.extract_text() or ""
            return text.strip()
        elif file_path.endswith(".docx"):
            doc = Document(file_path)
            return "\n".join([p.text for p in doc.paragraphs]).strip()
        elif file_path.endswith(".txt"):
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read().strip()
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
    return ""


# ── ATS PROMPT (your expert version) ──
ATS_SYSTEM_PROMPT = """You are an expert ATS (Applicant Tracking System) and senior HR recruiter.

Your task is to analyze a candidate's resume against a job description and evaluate it professionally.

Return your response STRICTLY in valid JSON format — no markdown, no code fences, no extra text.

Evaluation Criteria:
1. ATS Compatibility (format, readability, keywords)
2. Technical Skills Relevance to the Job Description
3. Experience Quality (projects, internships, impact)
4. Resume Structure & Clarity
5. Keyword Optimization (job-ready skills)

Instructions:
- Give a final score out of 100 based on match to the Job Description
- Be realistic (do NOT give everyone high scores)
- Identify missing skills relevant to the JD
- Suggest actionable improvements
- Recommend suitable job roles

Output ONLY this JSON (no other text):
{{
  "score": 0,
  "ats_score": 0,
  "strengths": ["point1", "point2"],
  "weaknesses": ["point1", "point2"],
  "missing_skills": ["skill1", "skill2"],
  "improvements": ["action1", "action2"],
  "recommended_roles": ["role1", "role2"],
  "extracted_skills": ["skill1", "skill2"]
}}

Job Description:
\"\"\"
{jd_text}
\"\"\"

Resume:
\"\"\"
{resume_text}
\"\"\"
"""


def analyze_with_gemini(jd_text: str, resume_text: str, filename: str) -> dict:
    """Use Gemini to do full ATS analysis of a single resume vs JD."""
    prompt = ATS_SYSTEM_PROMPT.format(jd_text=jd_text, resume_text=resume_text)
    try:
        response = gemini_model.generate_content(prompt)
        raw = response.text.strip()
        # Strip markdown fences if present
        raw = re.sub(r'^```(?:json)?\s*', '', raw)
        raw = re.sub(r'\s*```$', '', raw)
        data = json.loads(raw)
        return {
            "name": filename,
            "score": int(data.get("score", 0)),
            "ats_score": int(data.get("ats_score", 0)),
            "strengths": data.get("strengths", []),
            "weaknesses": data.get("weaknesses", []),
            "missing_skills": data.get("missing_skills", []),
            "improvements": data.get("improvements", []),
            "recommended_roles": data.get("recommended_roles", []),
            "extracted_skills": data.get("extracted_skills", []),
        }
    except Exception as e:
        print(f"Gemini failed for {filename}: {e}")
        return None


def rank_with_tfidf(jd_text: str, resumes_text: list, resume_paths: list) -> list:
    """TF-IDF + optional sentence-transformer fallback."""
    if USE_ST:
        try:
            jd_emb = _st_model.encode(jd_text, convert_to_tensor=True)
            res_emb = _st_model.encode(resumes_text, convert_to_tensor=True)
            scores = st_util.cos_sim(jd_emb, res_emb)[0]
            results = []
            for i, score in enumerate(scores):
                results.append({
                    "name": os.path.basename(resume_paths[i]),
                    "score": int(float(score) * 100),
                })
            return sorted(results, key=lambda x: x["score"], reverse=True)
        except Exception as e:
            print(f"ST failed, falling back to TF-IDF: {e}")

    # Pure TF-IDF
    docs = [jd_text] + resumes_text
    vec = TfidfVectorizer(stop_words='english')
    vecs = vec.fit_transform(docs)
    sims = cosine_similarity(vecs[0], vecs[1:])[0]
    results = []
    for i, s in enumerate(sims):
        results.append({
            "name": os.path.basename(resume_paths[i]),
            "score": int(s * 100),
        })
    return sorted(results, key=lambda x: x["score"], reverse=True)


# ── SINGLE RESUME ANALYZER (AI Inbox) ──
ANALYZE_SYSTEM_PROMPT = """You are an expert ATS (Applicant Tracking System) and senior HR recruiter.

Your task is to analyze a candidate's resume and evaluate it professionally.

Return your response STRICTLY in valid JSON — no markdown, no code fences, no extra text.

Evaluation Criteria:
1. ATS Compatibility (format, readability, keywords)
2. Technical Skills Relevance
3. Experience Quality (projects, internships, impact)
4. Resume Structure & Clarity
5. Keyword Optimization (job-ready skills)

Instructions:
- Give a final score out of 100
- Be realistic (do NOT give everyone high scores)
- Identify missing skills
- Suggest actionable improvements
- Recommend suitable job roles
- Extract key skills from resume

{job_context}

Output ONLY this JSON (no other text):
{{
  "score": 0,
  "ats_score": 0,
  "strengths": ["point1", "point2"],
  "weaknesses": ["point1", "point2"],
  "missing_skills": ["skill1", "skill2"],
  "improvements": ["action1", "action2"],
  "recommended_roles": ["role1", "role2"],
  "extracted_skills": ["skill1", "skill2"]
}}

Resume:
\"\"\"
{resume_text}
\"\"\"
"""

# Common tech skills for keyword-based extraction fallback
TECH_SKILLS_POOL = [
    "Python","Java","JavaScript","TypeScript","C++","C#","Go","Rust","Kotlin","Swift","PHP","Ruby","Scala","R",
    "React","Vue","Angular","Next.js","Node.js","Django","Flask","FastAPI","Spring","Express",
    "MySQL","PostgreSQL","MongoDB","Redis","SQLite","Cassandra","DynamoDB",
    "AWS","GCP","Azure","Docker","Kubernetes","Terraform","Jenkins","CI/CD",
    "TensorFlow","PyTorch","scikit-learn","Pandas","NumPy","NLP","LLM","RAG","BERT","GPT",
    "Git","GitHub","Linux","REST","GraphQL","gRPC","Kafka","RabbitMQ",
    "HTML","CSS","SASS","Tailwind","Bootstrap",
    "Agile","Scrum","JIRA","Figma","Postman","Swagger",
]

def extract_skills_fallback(resume_text: str) -> list:
    text_lower = resume_text.lower()
    found = []
    for skill in TECH_SKILLS_POOL:
        if skill.lower() in text_lower:
            found.append(skill)
    return found

def suggest_missing_skills(found: list) -> list:
    """Return high-demand skills not found in resume."""
    priority = ["Docker","Kubernetes","AWS","CI/CD","PostgreSQL","Redis","TypeScript","FastAPI","Git"]
    return [s for s in priority if s not in found][:8]


def analyze_single_resume(file_path: str, job_hint: str = "") -> dict:
    """Single-resume analysis for the AI Inbox endpoint."""
    text = read_file(file_path)
    if not text.strip():
        return {
            "score": 0, "ats_score": 0,
            "strengths": [], "weaknesses": ["Could not extract text from file"],
            "missing_skills": [], "improvements": ["Use a text-based PDF or DOCX file"],
            "recommended_roles": [], "extracted_skills": []
        }

    if USE_GEMINI:
        job_context = f"Job role hint from recruiter: {job_hint}" if job_hint else ""
        prompt = ANALYZE_SYSTEM_PROMPT.format(
            resume_text=text[:6000],   # Stay within token limits
            job_context=job_context
        )
        try:
            response = gemini_model.generate_content(prompt)
            raw = response.text.strip()
            raw = re.sub(r'^```(?:json)?\s*', '', raw)
            raw = re.sub(r'\s*```$', '', raw)
            data = json.loads(raw)
            return {
                "score":             int(data.get("score", 0)),
                "ats_score":         int(data.get("ats_score", 0)),
                "strengths":         data.get("strengths", []),
                "weaknesses":        data.get("weaknesses", []),
                "missing_skills":    data.get("missing_skills", []),
                "improvements":      data.get("improvements", []),
                "recommended_roles": data.get("recommended_roles", []),
                "extracted_skills":  data.get("extracted_skills", []),
            }
        except Exception as e:
            print(f"Gemini analysis failed: {e} — falling back to keyword extraction")

    # Fallback: keyword extraction
    extracted = extract_skills_fallback(text)
    missing   = suggest_missing_skills(extracted)
    score     = min(len(extracted) * 5, 75)   # rough heuristic
    ats_score = 60 if len(text) > 400 else 35

    return {
        "score":             score,
        "ats_score":         ats_score,
        "strengths":         [
            "Resume text successfully extracted",
            f"{len(extracted)} technical skills identified",
            "Add your Gemini API key for deep AI analysis"
        ],
        "weaknesses":        ["Full AI analysis requires Gemini API key in .env file"],
        "missing_skills":    missing,
        "improvements":      [
            "Set GEMINI_API_KEY in backend/.env for full ATS analysis",
            "Quantify achievements with metrics",
            "Add a strong professional summary",
        ],
        "recommended_roles": ["Software Engineer", "Backend Developer", "Full-Stack Developer"],
        "extracted_skills":  extracted,
    }

def rank_resumes_ai(jd_text: str, resume_paths: list) -> list:
    resumes_text = []
    for path in resume_paths:
        text = read_file(path)
        resumes_text.append(text if text.strip() else "empty resume")

    if USE_GEMINI:
        print("Using Gemini AI for analysis...")
        results = []
        for path, text in zip(resume_paths, resumes_text):
            filename = os.path.basename(path)
            result = analyze_with_gemini(jd_text, text, filename)
            if result:
                results.append(result)
            else:
                # Fallback for this individual file
                results.append({
                    "name": filename,
                    "score": 0,
                    "ats_score": 0,
                    "strengths": [],
                    "weaknesses": ["Could not be analyzed"],
                    "missing_skills": [],
                    "improvements": [],
                    "recommended_roles": [],
                    "extracted_skills": [],
                })
        return sorted(results, key=lambda x: x["score"], reverse=True)
    else:
        print("No Gemini key found, using TF-IDF/SentenceTransformer...")
        return rank_with_tfidf(jd_text, resumes_text, resume_paths)