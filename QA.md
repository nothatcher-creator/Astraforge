# Verification record

## v5 existing-lyric alignment and portrait workspace

Local checks passed: 37 regression tests, TypeScript, media worker preparation
and the complete Pages production build/artifact verifier. The new alignment
regression was run against the previous code and failed before implementation.
A review regression also failed before the fix that makes every partial match
require explicit selection, even when its first and last words match.
The suite covers first/last word anchors, exact millisecond word timestamps,
repeated phrases, bounded search, partial matches, original text preservation,
locked and unselected lines, stale proposals, one-step undo, overlapping
recognizer results, trimmed/looped source timing, and aligned project archives.

The user's phone screenshot exposed fixed preview/timeline rows and lyric
controls consuming the scrollable area. The update collapses the timeline,
compacts transport, groups lyric creation actions, and gives lyric events their
own scroll area. Device-level visual, touch and keyboard checks remain separate
from these code checks. The earlier blocked local portrait fixture is not used.

### Published alignment checks, September 20, 2026

The GitHub Actions build and Pages deployment passed for `ee201d3`. Tested the
published editor in cloud Chrome with the public 11-second JFK speech fixture
from the Transformers.js documentation dataset:

- Imported the WAV and pasted three lines with deliberately even initial
  timing. Stopping local alignment left all three texts and timestamps intact.
- Whisper Tiny recognized all 22 words. Review displayed three strong matches,
  original/proposed timestamps, independent checkboxes and working audition.
- Cleared the selection and accepted only line three. Only that line changed
  (7333–11000 ms became 8280–10720 ms). One Undo restored its original timing;
  Redo restored the aligned timing. All original punctuation and clip IDs stayed.
- Reopened alignment and accepted all three lines. Final intervals were
  0–2320, 2320–8280 and 8280–10720 ms. Applied Metal, saved, and reloaded the
  page; the audio, text, style and aligned intervals restored successfully.
- The Words panel exposed editable millisecond timing after reopening. The
  last line contained eight word intervals from 8280 through 10720 ms.
- Full preview playback reached the 11000 ms project end.

- Exported the aligned Metal project to MP4: 7,360,413 bytes, H.264 at
  1920 × 1080 / 30 FPS, with 48 kHz stereo AAC. FFprobe reported 11.000000 s
  video and 11.029333 s total including audio padding (within one video frame).
  FFmpeg decoded the full downloaded file without errors. The download-event
  wait timed out; the actual downloaded file in the shared directory provides
  the evidence. This validates encoding, not perceptual lyric/vocal accuracy.

This speech fixture does not establish recognition accuracy for sung or
distorted vocals. The user subsequently reported inaccurate or unclear alignment
on their song. Real-phone visual, keyboard and gesture acceptance remains
outstanding.

## v5.1 alignment correction

The user's song feedback prompted new reproductions. Before the correction,
tests failed for a missing early line stealing a later chorus and blocking
subsequent lines, scattered common words classified as a strong phrase, and a
large unanchored move preselected for application. Sequence selection replaces
greedy reservation; these cases now pass. Anchor ranges and identical/word-only
proposals are covered too. A review regression verifies that estimated edge
words yield to adjacent recognized words instead of displacing them. All 43 tests, TypeScript, media preparation and the
Pages production build pass locally.

The UI exposes Base/Tiny model selection, a first-line expected-start anchor,
signed start/end changes, an explicit Apply changes step, and a result that
distinguishes line movement from karaoke-only refinement or unchanged timing.

### Published correction checks, September 21, 2026

GitHub Actions build and Pages deployment succeeded for `624f513`
(run `35567144347`). Repeated the published-browser alignment workflow with
the same public 11-second speech fixture and three manually pasted lines:

- Confirmed English Base and a ±5-second search as the visible defaults.
- Set the first-line expected start to 0.500 s. The search shift updated;
  Use playhead returned it to 0.000 s. The project's text and timing did not
  change while configuring or analyzing.
- Base recognized all 22 words. Review showed three strong matches, signed
  start/end deltas and “Suggestions ready. Nothing has moved yet.” Before
  Apply, project timing was still 0–3667, 3667–7333 and 7333–11000 ms.
- Apply changes moved the intervals to 0–1980, 3380–7320 and 7320–10380 ms.
  All original text, punctuation and clip IDs remained intact. The result
  explicitly reported “3 lyric lines moved · 0 unchanged.”
- Running alignment again reused recognition, reported “No timing changes
  found,” labeled all three lines Already aligned, and disabled Apply changes
  with zero selected lines. It did not create a spurious history entry.
- A single Undo restored all three original intervals; Redo restored the
  aligned intervals. Saving and reloading restored the aligned project.

The Base and Tiny fixtures produce different timestamps; these checks validate
matching, review, application and persistence, not perceptual timing accuracy.
The user's problematic song has not been supplied, so its remaining recognition
errors cannot yet be reproduced. Real-phone visual/touch checks also remain
outstanding. The v5 MP4 evidence above still applies to the unchanged renderer;
no additional MP4 render was performed for this matcher-only correction.


## v4 catalog and GitHub Pages update

Passed locally: **26 automated tests**, `pnpm typecheck`, `pnpm media:prepare`,
and `pnpm build:pages` including the static artifact verifier.

The automated suite now covers catalog feed validation, download response types
and size limits, Commons attribution parsing, imported-asset credits in project
archives, and effects applied to selected or all editable lyrics. It checks that
locked lyrics, separate titles and visualizers retain their styles. Static
asset resolution is checked under both `/Astraforge/` and a domain root.

The GitHub Pages build is separate from the original server deployment and uses
the same editor components and renderer. Its artifact verifier checks the
subpath, JavaScript/CSS entry files, analysis and transcription workers, ONNX
runtime, and all H.264 encoder parts. The clean GitHub Actions build and Pages
deployment both passed for commit `34edde6`.

### Published editor checks, September 14–19, 2026

Tested the actual application at
`https://nothatcher-creator.github.io/Astraforge/` in the cloud Chrome browser:

- Imported and decoded the 7.381-second synthetic-speech test WAV. Waveform
  analysis and approximate BPM worked under the repository subpath.
- Local Whisper Tiny downloaded, transcribed the audio, and produced three
  editable lyric lines with word timing. Applying the Metal preset worked.
- A separate manual project imported the WAV and pasted four lyric lines.
- Downloaded Bebas Neue through the catalog and applied it to the lyrics. It
  appeared in the font picker and in the rendered video.
- Previewed and applied the editable Bounce in text effect.
- Wikimedia Commons returned 12 live image results. Previewed and imported
  `Lake Tekapo 01.jpg` (12.0 MB, 4568 × 2886) by Krzysztof Golik, CC BY-SA 4.0,
  onto a background track.
- Saved and reloaded the project. Audio, four lyrics, the downloaded font and
  background image all restored. Full preview playback reached the project end.
- Rendered H.264 MP4 at 1920 × 1080 / 30 FPS. The 3,719,387-byte file played
  through in the review player and arrived in the shared download directory.
  `ffprobe` confirmed H.264 video and 48 kHz stereo AAC audio; total duration was
  7.402667 seconds, within one 30 FPS frame of the 7.381-second project.
  An external FFmpeg decode of the entire downloaded file completed without
  errors. This checks codec, resolution, duration and decodability, not sample-
  accurate audio/lyric alignment on a representative sung performance.
- Exported and downloaded a 12,451,775-byte editable project. Its archive
  preserved all three asset byte lengths, all four lyric events, source
  attribution, and the complete font license in `CREDITS.txt`.
- Created and saved an empty project, reloaded to clear the previous in-memory
  assets, and imported the downloaded project file. The font, audio, image and
  all four original lyric texts restored successfully.

Download-event waits and direct video-element property reads timed out in the
browser automation layer. The downloaded files were independently found in the
documented shared directory and inspected; successful export is supported by
those files and the visible review player, not by a download-event assertion.

The local portrait fixture was blocked by the cloud browser's URL policy on
September 19. No alternate route was used to bypass that restriction. The new
catalog and existing portrait layout still need the phone checks below.

### Earlier desktop test setup

Updated 2026-09-13. Tests use a 7.365-second synthesized speech WAV, a custom
TrueType font, a PNG background and a two-second H.264 video with burned-in
source timestamps. This is not a sung rock or metal performance; these results
do not establish transcription accuracy for music or long-session performance.

## Earlier desktop verification (v2)

- TypeScript compilation (no emit) and 17 automated regression tests.
- Exact millisecond subtitle import/export, line/word retiming, splits/merges,
  word corrections, undo/redo, keyframe interpolation, section estimates,
  manual tap order, locked selections and no-op edits.
- Project archive tests preserve media bytes, font references, words and
  keyframes, and reject missing media and broken project references.
- Browser imported and decoded the WAV, with waveform and approximate BPM.
- Local Whisper Tiny returned its spoken text with word timestamps and applied
  three fully editable lyric lines. A line correction, Undo and Redo worked;
  a separate word correction and 50 ms word-start edit worked.
- Metal preset, imported StudioSerif font, custom size and progressive karaoke
  fill applied. The font appeared in Project Fonts.
- Image and video layers, track reordering, a four-second video start offset,
  and an additional title with a Rise entrance rendered in the preview.
- Full preview playback completed. Reloading restored the automatic project,
  audio, text, font, styles and media layers from IndexedDB.
- Automatic project rendered to H.264 MP4 at 1920 × 1080 / 30 FPS using the
  local FFmpeg fallback. The generated 10.2 MB video decoded and played through
  in the in-app review player. DOM media metadata reported 7.366667 seconds,
  within 2 ms of the 7.365-second project. At output playback time 5.560935,
  the background showed source frame 46 / 1.533 seconds, consistent with
  frame sampling and its four-second clip offset.
- Manual workflow imported the WAV, pasted four lines, and tapped all starts
  while playing at 0.25×. Selection advanced in the original line order.
  Recorded starts were 161, 1848, 3749 and 5704 ms. Karaoke preset and full
  preview playback worked. Preset Undo/Redo restored the previous styles.
- Dragging a lyric moved it from 1848–3749 to 2233–4134 ms; Undo restored it.
  Trimming the last lyric shortened its end from 7365 to 6980 ms; Undo restored
  the original end.
- The manual project rendered to 1280 × 720 / 30 FPS H.264 MP4 (5.6 MB).
  The encoded video decoded and played through; media metadata again reported
  7.366667 seconds. This also exercised proportional rendering at a different
  export resolution.
- Cancelling an in-progress software export returned to a usable export dialog,
  retained the project, and allowed rendering to restart.
- Full-screen preview's explicit exit control returned to the editor.

## Portrait workspace update

The previous checks above were completed before the portrait update. For this
update, all 19 automated regression tests and TypeScript checking pass. The two
new regression cases verify that scrolling and the narrower phone track labels
preserve millisecond seeking, and that Fit includes the end of a ten-minute song
at phone and desktop widths. The production build also passes.

A 390 × 844 browser baseline reproduced the old overlay panels, small transport
controls and 174 px track labels. After implementing the new layout, the preview
reload was blocked by the cloud browser URL policy (ERR_BLOCKED_BY_CLIENT).
The updated layout has therefore not been visually or interactively verified
in the browser. This is a test-environment limitation, not a passing result.

Remaining phone acceptance checks:

- At 320, 360, 390 and 430 px widths, switch all bottom tabs and More tools;
  ensure the canvas, timeline and panels do not overlap or overflow.
- Paste lyrics, edit text and word times, tap-sync during playback, use Expand
  and Restore, and open the keyboard without losing the focused field.
- Use Fit, seek, scroll, drag and trim clips; verify Undo and track menus.
- Pick Metal, import a font/background and edit title properties on the phone.
- Save, reopen and export; check the complete export dialog and encoded output.
- Rotate portrait → landscape → portrait, then check the desktop layout.
- On real Android/iOS hardware, verify safe areas, keyboard resizing, pinch,
  vertical timeline scrolling, pointer cancellation and fullscreen fallback.

`tests/fixtures/portrait.html` is a viewport fixture for future authorized local
browser QA. It is not included in the production public directory. Viewport
simulation alone does not establish real-device touch or keyboard behavior.

## Current limitations and remaining acceptance checks

The v4 checks above resolve the earlier unconfirmed MP4/project downloads and
bundled-project reopening. They do not establish every combination of browser,
device, codec, song length and media format, or certify the entire original
production specification. No browser security settings were changed.

Also still required:

- Explicit native/software encoder coverage and WebM on supported browsers.
- Tablet/Android landscape, pinch gestures and long projects on real devices.
- Browser keyframe editing with catalog styles and additional video layers.
- Transcription accuracy on representative sung material and harsh vocals.
- Additional WebMCP actions beyond the read, preset, save and dialog actions
  exercised during the v4 checks.
