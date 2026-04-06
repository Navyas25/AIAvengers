from ai_ranker import rank_resumes_ai

jd_text = """
Looking for a Python developer with experience in machine learning,
NLP, and data analysis using pandas and scikit-learn.
"""

resume_files = [
    "resumes/resume1.pdf",
    "resumes/resume2.pdf",
    "resumes/resume3.pdf"
]

results = rank_resumes_ai(jd_text, resume_files)

for r in results:
    print(r)
    print(r)