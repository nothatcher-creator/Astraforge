# Alignment correction after song feedback

The user found alignment inaccurate or could not tell whether anything moved.
Reproduced three concrete faults before changing the algorithm:

- A missing early line greedily grabbed a later chorus, reserved its words, and
  blocked every subsequent lyric even when their audio was correctly recognized.
- Matching scattered words inside a different phrase was called a strong match.
- Exact text at a large time displacement was preselected without warning.

Design: retain local recognition and editable review. Build multiple candidates
per line, then choose a non-overlapping ordered sequence across the track using
a prefix-max dynamic program over recognized anchors. Estimated edge words
yield to adjacent anchors without displacing recognized words. Skipping
unmatched lines remains allowed. Penalize
unexpected displacement and intervening recognized words. Require review for
large moves, scattered phrases and all previous uncertain cases.

Default to the larger English Base model, expose model choice clearly, and use
a five-second search window. Offer a first-line expected-start anchor (numeric
or current playhead), applied to both audio preparation and matching. The anchor
only guides analysis; it never edits the project before Apply.

Show signed start/end changes, distinguish line movement from word-only timing,
explain when no changes are available, explicitly require Apply changes, and
report moved/refined/unchanged counts. Identical proposals must not create an
undo entry or claim a lyric moved.

- [x] Reproduce the three matching faults with literal timing regressions.
- [x] Implement sequence selection and conservative review classification.
- [x] Add anchor/audio-range and no-op/word-only behavioral checks.
- [x] Implement model, anchor, delta and explicit-apply UI.
- [x] Run tests, types, production build and independent code review.
- [ ] Publish to the existing Astraforge main branch and verify deployment.
- [ ] Verify anchor/apply/no-change UI on the published editor.
- [ ] Record speech/export evidence and real-song testing limits; package source.

Recognition of sung vocals remains distinct from word matching. A speech fixture
cannot validate the user's song. Request the problematic audio/project to diagnose
remaining recognition or timing errors; do not claim the song is fixed without it.
