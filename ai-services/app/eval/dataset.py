"""Tiny gold-set used for retrieval and answer evaluation.

Replace with your own annotated CSV/JSON file. Each example contains:
- question
- expected_keywords: substrings that must appear in retrieval/answer
- relevant_doc_ids: optional list of chunk doc_ids that should rank in top-K
- ground_truth: free-text reference answer (for RAGAS faithfulness only)
"""
GOLD = [
    {
        "question": "What is the BTech CSE fee at COEP Pune?",
        "expected_keywords": ["coep", "fee"],
        "relevant_doc_ids": [],
        "ground_truth": "Approximate annual fees for BTech CSE at COEP Pune.",
    },
    {
        "question": "List top engineering colleges in Maharashtra by NIRF.",
        "expected_keywords": ["nirf", "maharashtra"],
        "relevant_doc_ids": [],
        "ground_truth": "Includes IIT Bombay, COEP, VJTI etc.",
    },
    {
        "question": "Are SC/ST scholarships available for engineering students in India?",
        "expected_keywords": ["scholarship", "sc", "st"],
        "relevant_doc_ids": [],
        "ground_truth": "Yes, multiple central + state schemes exist.",
    },
]
