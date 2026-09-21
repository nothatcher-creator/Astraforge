# Phone workspace and existing lyric alignment

Goal: make portrait editing usable and retime existing lyrics against nearby recognized audio without replacing text.

Design: keep the existing on-device Whisper provider. Render the selected audio clip's audible timeline region to mono 16 kHz, including trim/offset/loop, then recognize words. A separate alignment worker matches normalized lyric tokens in an adjustable window around existing times, keeps monotonic matches per track and interpolates missing words. First/last word anchors and coverage determine whether a proposal is preselected or needs review. These are match indicators, not speech confidence probabilities. Review shows before/after timing, audition, per-line checkboxes, cancel, and one undoable application. Locked, unmatched and stale lines remain unchanged. No audio upload is introduced.

Phone design: collapse timeline by default in editing panels, retain an explicit timeline toggle, keep the full timeline in Preview, use one compact playback row with timecode, put advanced transport controls in a menu, combine lyric actions into one row with an Add lyrics menu, make search collapsible, and give the lyric list its own scroll area. Expanded editor keeps playback available. The preview remains the same renderer.

## Implementation plan (native execution)

- [x] Add behavioral regressions in tests/alignment.test.mjs: literal word timing, repeated phrases, missing boundary words, no matches, narrow search, offsets/loops, locked lines, stale source and one-step undo. Wire through scripts/test.mjs. Run and inspect the initial failures.
- [x] Implement lib/lyricforge/alignment.ts (pure alignment and guarded apply), alignment-audio.ts (timeline window/mapping), alignment.worker.ts and alignment-client.ts (cancellable worker orchestration). Tests should assert literal timestamps and preserved text/style/keyframes, not source strings.
- [x] Add components/editor/AlignmentDialog.tsx with audio clip selection, lyric scope, local model, +/- time window, transcript progress, reviewed proposals, audio audition and apply/cancel. Preserve all selected lyric identities. Add the aligned timing source to model/project validation and verify an editable project round trip.
- [x] Connect Lyrics and Sync alignment actions through Editor/Dialogs. Add compact lyric actions and accessible phone transport menu. Update PhoneWorkspace and phone.css with a reversible timeline toggle and larger remaining canvas area. Keep desktop editing unchanged.
- [x] Run the complete regression suite, typecheck, media preparation and Pages production artifact verification. Inspect the actual published UI, execute alignment using a deterministic speech fixture, confirm original lyric text, undo, save/reopen and render timing. Record limits honestly; no alternate routes around the earlier blocked local portrait fixture.
- [x] Bump version to 0.5.0, update README/QA, publish to the authorized Astraforge repository with a non-forced commit, and verify GitHub deployment. The source download is superseded by the v0.5.1 correction package.

Publication and speech-fixture/1080p MP4 evidence are recorded in QA.md.
The subsequent user-reported alignment problem is tracked in
2026-09-20-alignment-correction.md. Real-phone visual, keyboard and gesture
acceptance remains outstanding; desktop checks do not establish those results.

Review focus: repeated chorus chooses nearby occurrence; partial matches require opt-in; source trim and loop are reflected in timestamps; stale/locked clips cannot be changed; small-screen actions do not consume the lyric scrolling area. Real-phone visual/keyboard/gesture testing is separate from desktop verification.
