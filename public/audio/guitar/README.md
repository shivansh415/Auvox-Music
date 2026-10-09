# Guitar recordings

The splash scene plays real recordings from this folder when they exist, and falls back to a synth otherwise.

1. Add short, dry, normalised files (mp3 or ogg, ~2–3 s for single notes):
   - six open strings, low E → high E
   - one riff/strum (a few seconds) for the tap on the guitar body
2. Create `manifest.json` here:

```json
{ "strings": ["e2.mp3", "a2.mp3", "d3.mp3", "g3.mp3", "b3.mp3", "e4.mp3"], "riff": "riff.mp3" }
```

Until `manifest.json` exists, nothing is loaded and the synth is used.
