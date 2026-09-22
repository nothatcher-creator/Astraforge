# Whole-song alignment correction

The user's existing lyrics may have evenly estimated times far from the vocals.
A narrow nearby search cannot find them. Partially accepted suggestions can also
cross untouched lines, so sorting by current time corrupts the original sequence
on the next attempt.

## Scope and decisions

- Add an explicit whole-song search that reads the selected audio clip and
  matches in source order. Keep nearby refinement and timeline-order matching.
- Default to whole-song search when most editable lines are estimated.
- Match one printed word against two adjacent recognized words when the combined
  spelling is exact, including the alright/all right variant. Preserve text and
  the entire recognized interval. Never concatenate across a long audio gap.
- Keep partial, fuzzy, repeated and scattered matches reviewable. Whole-song
  mode intentionally allows distant complete unique phrases to be suggested.
- Expose Base/Tiny/Small models, distinct review/not-found/already-aligned counts,
  and select-all suggestions. Collapse settings during review on small screens.
- Preserve lock, selection, audio source, stale-report and undo safeguards.

## Verification

Regression cases cover the reproduced failures and boundary conditions. Run the
full test suite, TypeScript, media preparation and production Pages build. Use
the private uploaded song to compare coverage, without publishing its data or
claiming candidate matches establish accurate synchronization. Review the diff
before publishing and exercise the published UI through recognition, selection,
apply, undo and persistence. Return a separate clearly labeled timing-review copy.
