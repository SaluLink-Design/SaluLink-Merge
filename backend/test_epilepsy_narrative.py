"""
Unit tests for seizure syndrome detection (no API / model required).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from main import detect_epilepsy_seizure_evidence  # noqa: E402

DLAMINI_NOTE = """
Mr. Dlamini reports experiencing three seizure-like episodes over the past four months.
The most recent episode occurred one week ago while at work. According to witnesses,
the patient suddenly lost consciousness, fell to the ground, and developed generalized
stiffening followed by rhythmic jerking movements involving both upper and lower limbs.
The episode reportedly lasted approximately two minutes.

Following the event, the patient was confused, disoriented, and excessively tired for
approximately 30 minutes. He has no recollection of the event itself.

The patient reports occasionally experiencing a brief sensation of déjà vu and a rising
feeling in the stomach immediately before some episodes. He denies chest pain, palpitations,
or symptoms suggestive of syncope.

No history of recent head trauma, meningitis, stroke, or substance abuse.
"""


def test_dlamini_seizure_syndrome():
    evidence = detect_epilepsy_seizure_evidence(DLAMINI_NOTE)
    assert evidence['strong'], f"Expected strong evidence, got {evidence}"
    assert evidence['feature_count'] >= 3
    assert 'seizure_activity' in evidence['features_matched']
    assert 'loss_of_consciousness' in evidence['features_matched']
    print("✅ Dlamini narrative: strong epilepsy syndrome evidence")
    print(f"   Features ({evidence['feature_count']}): {', '.join(evidence['features_matched'])}")


def test_classic_epilepsy_wording():
    note = (
        "Patient experienced seizure with loss of consciousness and tonic-clonic movements "
        "lasting 2 minutes. Postictal confusion noted."
    )
    evidence = detect_epilepsy_seizure_evidence(note)
    assert evidence['strong']
    print("✅ Classic epilepsy wording: strong evidence")


def test_negative_fatigue_only():
    note = "Patient reports persistent fatigue, cold intolerance, and weight gain."
    evidence = detect_epilepsy_seizure_evidence(note)
    assert not evidence['strong']
    print("✅ Hypothyroid-style note: no seizure syndrome")


if __name__ == "__main__":
    test_dlamini_seizure_syndrome()
    test_classic_epilepsy_wording()
    test_negative_fatigue_only()
    print("\nAll epilepsy narrative unit tests passed.")
