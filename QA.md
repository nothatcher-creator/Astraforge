# Verification record

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
runtime, and all H.264 encoder parts. Browser verification of this deployment is
recorded below once performed; previous browser results are not a claim that
the new catalog or phone layout has been tested on a physical device.

Updated 2026-09-13. Tests use a 7.365-second synthesized speech WAV, a custom
TrueType font, a PNG background and a two-second H.264 video with burned-in
source timestamps. This is not a sung rock or metal performance; these results
do not establish transcription accuracy for music or long-session performance.

## Passed

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

Browser download waits timed out for both bundled projects and MP4 output;
files remained unconfirmed in the browser's shared download directory. The
browser URL policy blocks its internal download-manager page. No browser
security settings were changed and no unconfirmed file was used as a completed
artifact. A persistent explicit Save file link is now provided after export.

Consequently, completed OS-level downloads, opening a downloaded bundled project,
and external ffprobe/audio checks are not yet verified. The embedded MP4 player
verifies the actual encoded video, not the editor canvas. Both complete requested
workflows must not be claimed as fully passed until downloaded files can also
be checked.

Also still required:

- Native WebCodecs MP4/WebM paths on browsers that expose those codecs.
- Tablet/Android landscape, pinch gestures and long projects on real devices.
- Browser keyframe editing and a complete bundled-file import round trip.
- Transcription accuracy on representative sung material and harsh vocals.
- Optional WebMCP actions: modelContext was unavailable in the test browser.
