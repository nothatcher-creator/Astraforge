# LyricForge online catalogs

Open **Online catalog → Add catalog** to load a public HTTPS JSON feed. Its server
must allow cross-origin reads (CORS). Catalogs contain asset metadata and bounded
text animation recipes; the editor does not execute scripts or CSS from a feed.
Imported feeds and bookmarks are saved on the current device.

```json
{
  "version": 1,
  "items": [
    {
      "id": "my-studio-soft-rise",
      "kind": "animation",
      "title": "Soft rise",
      "provider": "My studio",
      "creator": "Your name",
      "description": "A gentle entrance for reflective lyrics.",
      "sourceUrl": "https://example.com/soft-rise",
      "license": "CC0",
      "tags": ["soft", "acoustic"],
      "recipe": {
        "entrance": "Rise",
        "idle": "Float",
        "exit": "Fade",
        "animationDuration": 800,
        "intensity": 0.4,
        "easing": "ease-out"
      }
    }
  ]
}
```

Use a stable, unique `id` for each item. Reimporting a feed updates matching IDs.
A feed supports up to 500 items and 2 MB of JSON. Replace the example URLs and
credits with the actual source and terms for your work.

## Asset entries

`kind` can be `image`, `video`, or `font`. Include `downloadUrl`, `filename` and
`mime`, in addition to the common fields above. All URLs must be HTTPS, without
embedded credentials. `thumbnail`, `licenseUrl`, `size` (bytes), `width`, and
`height` are optional. File type, extension and kind must match.

| Kind | MIME types | Import limit |
| --- | --- | --- |
| image | image/jpeg, image/png, image/webp, image/gif | 60 MB |
| video | video/mp4, video/webm, video/quicktime | 150 MB |
| font | font/ttf, font/otf, font/woff, font/woff2 | 12 MB |

Direct downloads must permit CORS and return the declared MIME type or a binary
content type. HTML landing pages are not downloadable assets. Browser codec
support still applies. For fonts, `licenseUrl` should point to the full plain
text license; the importer saves that text with the project. Upload fonts only
when their terms permit redistribution.

The editor downloads asset bytes, decodes them locally, and adds them through
the same media and font systems used for manual imports. Save an editable
project to bundle those bytes and a `CREDITS.txt` containing source details.

## Text effects and transitions

`animation` and `transition` entries need a `recipe`. A transition is a paired
entrance/exit on a text layer, not a transition between video clips.

Supported properties:

- `entrance`, `idle`, `exit`, `emphasis`: names in `ANIMATIONS` in
  `lib/lyricforge/model.ts`, including Fade, Pop, Bounce, Slide, Zoom, Blur In,
  Blur Out, Typewriter, Word Reveal, Character Reveal, Stretch, Shake, Pulse,
  Flicker, Glitch, Neon Flicker, Spin, Wave, Float, Rise and Fall.
- `animationDuration`: 50–10,000 milliseconds.
- `intensity`: 0–2; `delay`: 0–10,000 milliseconds; `direction`: −1 to 1.
- `easing`: linear, ease-in, ease-out, or ease-in-out.
- `glow`: 0–100.

Effects preview in the same canvas renderer used by the editor and video export.
Applying a recipe is undoable; its properties remain editable. The default scope
updates unlocked lyric lines and future lyric defaults. Locked lyrics and other
layers retain their appearance. Selection scope changes only selected, unlocked
text and lyric clips.

## Website entries

`kind: "website"` needs the common metadata and `sourceUrl`. It opens the original
website. This is useful for sources requiring their own download flow or native
template software. After Effects/Premiere templates cannot run in LyricForge;
render them in their original application and import the resulting video.
