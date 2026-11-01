# Vision-model evaluation for power analysis

Offline only: nothing here is imported by the worker or the analyzer, and no production data is written. Results live in `D:\CodexWork\coachlink-motion-analysis\vlm-eval\` (`report.md` has the conclusion).

## Plate location: Hough against a model seed

1. `make_clips.sh <samples> <vlm-eval>/clips` builds the production-format and synthetic oblique clips.
2. `plate_hough.py` runs the baseline and records why it failed.
3. `reference_track.py` and `plate_reference.py` build the reference numbers.
4. `plate_frames.py` exports de-identified frames and the model requests.
5. `vlm_ask.mts` sends them to `getCoachlinkVisionLlm` and saves replies, tokens and latency. Run it from the main checkout, which holds `node_modules` and the local config.
6. `plate_seeded.py` runs each arm. Answers are reused, so arms cost no extra model calls:
   - no flags: the seed plus the existing `follow_plate`
   - `--variant keep --keep-following`
   - `--variant keep_ellipse --keep-following --ellipse-mask`
   - `--variant template --template`
   - `--variant template_moving --template --moving-gate`
7. `plate_report.py` writes the comparison.

## Rounded back

Needs labelled clips; see `labels.example.csv` for the format.

1. `back_frames.py --labels <csv> --run <name>` exports frames and the JSON-answer requests.
2. `vlm_ask.mts` with those requests, then `back_score.py --run <name>`.
3. `back_logprob.py requests --run <name>`, `vlm_ask.mts`, then `back_logprob.py score --run <name>` for per-frame token probabilities.
