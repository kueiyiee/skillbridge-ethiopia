# SKILLBRIDGE ML Extension (Python & scikit-learn)

This module provides the future machine learning microservice for SKILLBRIDGE.

## Pipeline Architecture
1. **Feature Extraction**:
   - Vectorization of candidate skill profiles vs. employer job specifications.
   - Proficiency scaling (Beginner: 1.0 to Expert: 4.0).
   - Mandatory qualification multiplier (1.5x penalty for mandatory omissions).
2. **Model Formulation**:
   - `SkillBridgeRanker`: Computes weighted Jaccard similarity and normalized gap severity.
   - Extension to train an SVM or Random Forest regressor on real historical placement outcomes.
3. **Execution**:
   ```bash
   pip install -r requirements.txt
   python candidate_matcher.py
   ```
