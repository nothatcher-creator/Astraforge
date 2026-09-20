# LyricForge

[Open the live editor](https://nothatcher-creator.github.io/Astraforge/)

A local-first lyric video editor built with React, TypeScript, Web Audio, canvas,
Whisper, and deterministic video encoding. Brand settings live in
`lib/lyricforge/model.ts`; the logo is `public/favicon.svg`.

## Run and develop

Use Node 22.13 or newer and the pnpm version in `package.json`.

```sh
pnpm install
pnpm media:prepare
pnpm dev:pages
```

Open the `/Astraforge/` URL printed by Vite. `pnpm test` runs the timing, history,
catalog and project regressions. `pnpm typecheck` checks application types.
`pnpm build:pages` creates a standalone static site in `dist-pages` and checks
its entry assets and media workers. The original server build remains available
through `pnpm dev` and `pnpm build`.

## GitHub Pages

The repository includes `.github/workflows/pages.yml`. Pushes to `main` and
manual workflow runs install dependencies, prepare the local transcription and
video workers, run tests, build the editor, and deploy to GitHub Pages. In the
repository's **Settings → Pages**, use **GitHub Actions** as the publishing
source. No API keys or server are required for the editor or built-in catalog.

For another repository name, the workflow derives the base path automatically.
For hosting at a domain root, build with `PAGES_BASE_PATH=/ pnpm build:pages`.
The prepared worker binaries are generated during the build and are intentionally
excluded from source control. Run `pnpm media:prepare` after a fresh install.

The original uploaded v3 source ZIP remains in the repository for reference;
the unpacked source at the root is the maintained application.

## Online catalog

Open **Media → Online catalog**, **Effects → Online catalog**, the globe button
on desktop, or **More → Online catalog** on a phone.

- Search live Wikimedia Commons images and videos; preview and import supported
  files directly onto background tracks.
- Preview 20 curated Google Fonts and add them to **Project Fonts** with one
  action. Font bytes and the full font license are included in saved projects.
- Preview 10 editable text motions inspired by Animate.css and four paired
  text transitions using the actual preview/export renderer. Apply to all
  editable lyrics or selected text, then customize or undo.
- Bookmark finds on the current device and add public custom JSON catalogs.
  The format is documented in [docs/catalog-format.md](docs/catalog-format.md).
- Browse original libraries on Mixkit, Pexels, Pixabay, Google Fonts and
  Animate.css. Website cards open the source; native editor templates require
  their original application. Download supported media and import it here.

Source, creator and license details stay with each imported asset. Editable
project archives include `CREDITS.txt`; the catalog also offers a credits text
download. Review an asset's source terms when publishing your video.

Catalog searches, previews and downloads contact the provider directly. They
do not send your song or project. Direct imports need the provider's CORS support;
when unavailable, use **Open original source** and import a downloaded file.
Video support depends on browser codecs; Commons also contains formats that
the editor intentionally filters out. The built-in motions are canvas
adaptations, not dynamically loaded third-party CSS or scripts.

Maintainers can refresh the curated font file and license URLs with
`node scripts/update-font-catalog.mjs`; normal builds use the checked-in list.

## Editing workflow

1. Create a project from the project menu and choose its aspect ratio.
2. Import audio. Waveform, energy, spectrum, and approximate beats are analyzed
   locally in a worker.
3. Detect lyrics, import TXT/LRC/SRT/VTT/ASS/SSA, or paste/type one line per event.
4. Correct lines or individual words. In Sync, play and tap **Set start & next**
   (Enter) for each line. Use the timeline and numeric fields for finer timing.
5. Choose a genre preset; all typography, timing, colors, motion and positions
   remain editable. Import fonts into the Project Fonts picker.
6. Add backgrounds, extra text and reactive layers. Drag objects in the preview,
   trim and move timeline clips, or add keyframes in the inspector.
7. Save locally or export a `.lyricforge` file that bundles the project and media.
8. Export video, audio, subtitles or the editable project. Review the encoded
   video in the export window, then use Save file. The download link remains
   available after rendering.

The first session contains clearly labelled original example lyrics and a
synthesized instrumental. These example lyrics are not a transcription of that
instrumental. Importing a song into the example starts a clean song session.

## Align lyrics you already have

In **Lyrics**, choose **Align existing lyrics** (on a phone: **Align lyrics**).
Choose the audio clip, all unlocked lines or your selected lines, and a search
window around their current times. **Find lyric timings** listens locally,
then matches your original words against recognized words in that window.

The review shows old and proposed timestamps, word match counts, and buttons
to listen before or after. Strong matches start checked. Any missing words,
uncertain spellings and ambiguous repeats require manual selection;
unmatched lines are left alone. Apply only the lines you accept. Undo restores
the entire previous timing in one step. Text, styling, line breaks and clip IDs
are preserved; words and keyframes move with the accepted timing.

This uses nearby speech-recognition matches, not phoneme-level forced alignment.
Unrecognized word timings are interpolated and labeled as estimated in the
review. Singing and distorted vocals can limit recognition. Increase the search
window if the estimated line times are too far away, or select a small section
and use the manual Sync tools. No project audio is uploaded. Audio trims,
offsets and loops are included when preparing the clip for analysis.

## Phone workspace

On screens up to 650 px wide, a compact playback bar and collapsed timeline
leave more room for the preview and lyric list. Tap **Timeline → Show** to open
its tracks while keeping playback visible, or select **Preview** in the bottom
navigation for the full viewer and timeline. Lyrics scroll separately from
their controls.

**Add lyrics** contains Auto Detect, Paste and Import. **Align lyrics** retimes
existing text; the search icon opens lyric search. **More playback controls**
(next to speed) contains frame stepping, Stop, loop selection and volume.

Bottom navigation opens **Preview**, **Lyrics**, **Media** and **Style**;
**More** contains text, presets, effects, elements and the online catalog.
**Expand** gives the editing panel more space while keeping playback available.
Focusing an editing field expands it automatically; **Restore** returns the
preview. Viewports up to 620 px tall prioritize editing and playback, including
when the keyboard reduces the available height. Use **Preview** for the canvas
and timeline in that compact mode.

## Architecture

| System | Source |
| --- | --- |
| Project schema and timing primitives | `lib/lyricforge/model.ts` |
| Editor state and immutable undo history | `store.ts`, `history.ts` |
| Audio scheduling and offline mix | `audio.ts` |
| Waveform, beat and FFT analysis | `public/workers/analysis.js` |
| Manual synchronization | `synchronization.ts` |
| Lyric import and export | `lyrics.ts` |
| Modular transcription providers | `transcription.ts`, `transcription.worker.ts` |
| Shared preview/export rendering | `renderer.ts`, `animation.ts`, `video-pool.ts` |
| Media and imported fonts | `assets.ts` |
| Online providers, validated feeds and imports | `catalog.ts`, `catalog/` |
| Online catalog and live previews | `components/editor/CatalogDialog.tsx`, `CatalogPreview.tsx` |
| Genre presets | `presets.ts` |
| IndexedDB and bundled projects | `project-manager.ts` |
| Native video encoding | `exporter.ts` |
| Software H.264 encoding | `software-exporter.ts` |
| UI components | `components/editor/` |
| Optional browser agent actions | `webmcp.ts` |

All core timing is stored in integer milliseconds. Playback uses the audio
context clock. Export renders each frame at `frameIndex / fps` through the same
renderer, at the selected output resolution. Each renderer owns its video
decoders so preview seeking cannot change an export's source frames. Export
never uses MediaRecorder or records the visible preview.

MP4 uses a native H.264 encoder when available and a local FFmpeg WebAssembly
fallback otherwise. The software path encodes one-second batches to bound raw
frame memory. Compressed segments, the final file and decoded audio still
consume memory. WebM VP9 and AV1 are offered when the browser exposes a working
encoder. Frame rates are 24, 30 and 60 FPS.

## Privacy and providers

No account or API key is needed for local transcription. The default English
Whisper Tiny model downloads from Hugging Face on first use and is cached by the
browser. Inference runs in a worker. Audio and project media are not uploaded.
The optional custom endpoint is used only after the user selects it and starts
detection; the dialog identifies the upload destination. It receives multipart
audio and must return:

```json
{"words":[{"word":"Hello","start":1.2,"end":1.7,"confidence":0.9}]}
```

Provider timestamps are seconds. Confidence is optional and is never invented.
Local Whisper does not supply calibrated confidence. Section and BPM labels are
estimates, not musical ground truth; repeated text suggests a chorus and gaps
suggest instrumental sections. Every result remains editable.

## Practical limits

- Browser media decoding determines support for AAC, FLAC, M4A and MOV. An
  unsupported file produces an actionable error. GIFs can be imported as image
  assets; use MP4 or WebM for reliably timed animation.
- Software H.264 is slower than hardware encoding. Large 4K/60 exports and long
  songs may exceed a device's memory. Imports are limited to 500 MB per media
  file and 750 MB per bundled project.
- Playback speed changes can change pitch. Export always uses the original
  audio rate. Preview volume does not change the exported mix.
- Word timing from pasted lyrics starts as an estimate. The local speech model
  can mishear singing, harsh vocals, layered vocals and instrumentals.
- LRC stores line starts; use SRT/VTT or project files to preserve explicit ends
  and overlaps. ASS imports text and timing; its original styling is not mapped.
- Autosave belongs to the current browser and device. Export a bundled project
  before moving devices or clearing browser storage.

## Verification status

See `QA.md` for the exact verification completed and the remaining acceptance
checks. This implementation has not yet passed both complete user-requested
browser workflows. It must not be represented as fully production-verified.

Third-party runtime notices are in `public/workers/THIRD_PARTY_NOTICES.md`.
