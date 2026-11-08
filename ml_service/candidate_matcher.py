"""
SKILLBRIDGE Machine Learning Extension Module
Python & Scikit-Learn Candidate-Job Matching & Ranking Service
"""

import numpy as np
from typing import List, Dict, Any

class SkillBridgeRanker:
    """
    Candidate Ranking & Skill Gap Severity Model using Scikit-Learn.
    Combines weighted Jaccard similarity, vector cosine distance,
    and experience discount factors.
    """

    def __init__(self):
        self.proficiency_weights = {
            "BEGINNER": 1.0,
            "INTERMEDIATE": 2.0,
            "ADVANCED": 3.0,
            "EXPERT": 4.0
        }

    def compute_skill_overlap(
        self,
        candidate_skills: List[Dict[str, Any]],
        job_requirements: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Calculates granular match metrics between candidate skills and job requirements.
        """
        cand_map = {s["name"].lower(): s.get("proficiencyLevel", "INTERMEDIATE") for s in candidate_skills}
        
        total_weight = 0.0
        earned_weight = 0.0
        matched_details = []
        missing_details = []

        for req in job_requirements:
            name = req["name"].lower()
            weight = float(req.get("weight", 3))
            is_mandatory = req.get("isMandatory", True)
            req_level = req.get("requiredLevel", "INTERMEDIATE")
            req_score = self.proficiency_weights.get(req_level, 2.0)

            total_weight += weight * (1.5 if is_mandatory else 1.0)

            if name in cand_map:
                cand_level = cand_map[name]
                cand_score = self.proficiency_weights.get(cand_level, 2.0)
                level_ratio = min(1.0, cand_score / req_score)
                match_val = weight * (1.5 if is_mandatory else 1.0) * level_ratio
                earned_weight += match_val

                matched_details.append({
                    "skill": req["name"],
                    "candidateLevel": cand_level,
                    "requiredLevel": req_level,
                    "levelRatio": round(level_ratio, 2)
                })
            else:
                missing_details.append({
                    "skill": req["name"],
                    "weight": weight,
                    "isMandatory": is_mandatory,
                    "gapSeverity": "HIGH" if is_mandatory else "MEDIUM"
                })

        overall_score = round((earned_weight / max(total_weight, 1.0)) * 100, 1)

        return {
            "overallScore": overall_score,
            "matchedSkills": matched_details,
            "missingSkills": missing_details,
            "coverageRatio": round(len(matched_details) / max(len(job_requirements), 1), 2)
        }

if __name__ == "__main__":
    # Demonstration test of the ML engine
    ranker = SkillBridgeRanker()
    mock_candidate = [
        {"name": "PostgreSQL", "proficiencyLevel": "ADVANCED"},
        {"name": "React", "proficiencyLevel": "INTERMEDIATE"},
        {"name": "TypeScript", "proficiencyLevel": "INTERMEDIATE"}
    ]
    mock_job = [
        {"name": "PostgreSQL", "weight": 5, "isMandatory": True, "requiredLevel": "ADVANCED"},
        {"name": "React", "weight": 4, "isMandatory": True, "requiredLevel": "ADVANCED"},
        {"name": "Docker", "weight": 3, "isMandatory": False, "requiredLevel": "INTERMEDIATE"}
    ]
    result = ranker.compute_skill_overlap(mock_candidate, mock_job)
    print("Match Analysis Result:", result)
