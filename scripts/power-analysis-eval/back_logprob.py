"""Second way to ask the rounded-back question: one word per frame, real token probabilities.

The JSON arm in back_frames.py gets a number the model chose to write. vision-demos
instead reads P(label) at the answer position of every frame and averages over the
pull; our gateway exposes the same information through logprobs, so this reproduces it
with qwen3.8-flash. The wording of the labels follows vision-demos deadlift/config.py.

usage:
  python back_logprob.py requests --run <name> [--repeats 2]    writes requests_logprob.json
  (send it with vlm_ask.mts to answers_logprob.json)
  python back_logprob.py score --run <name>                     writes score_logprob.json
"""
import argparse
import json
import math
import os
import statistics
from typing import Any, Dict, List, Optional

import clips as cl

WARN_AT = 0.7
MAX_TOKENS = 3
SYSTEM = "You grade barbell lifting form. Answer with exactly one word."
PROMPT = (
    "A person is performing a barbell lift. Judge the shape of the lifter's spine, not how far the torso leans forward. "
    "straight: neutral spine, the back is flat from hips to neck. A flat back can lean far forward and is still straight. "
    "rounded: flexed spine, the back bows outward into a hump and the shoulders roll forward. "
    "Answer with one word: straight or rounded."
)


def build_requests(root: str, repeats: int) -> None:
    with open(os.path.join(root, "manifest.json"), encoding="utf-8") as handle:
        manifests = json.load(handle)
    requests = []
    for manifest in manifests:
        for item in manifest["frames"]:
            for repeat in range(repeats):
                requests.append(
                    {
                        "id": f"{manifest['clip']}/rep{item['rep']}/{item['frame']}/r{repeat}",
                        "images": [os.path.join(root, "frames", manifest["clip"], item["file"])],
                        "system": SYSTEM,
                        "prompt": PROMPT,
                        "maxTokens": MAX_TOKENS,
                        "logprobs": True,
                    }
                )
    with open(os.path.join(root, "requests_logprob.json"), "w", encoding="utf-8") as handle:
        json.dump(requests, handle, ensure_ascii=False, indent=2)
    print("requests", len(requests))


def p_rounded(answer: Dict[str, Any]) -> Optional[float]:
    """P(rounded) renormalized over the top tokens that begin one of the two words."""
    rounded = straight = 0.0
    for item in answer.get("firstTokenLogprobs") or []:
        token = item["token"].strip().lower()
        if not token:
            continue
        if "rounded".startswith(token) or token.startswith("round"):
            rounded += math.exp(item["logprob"])
        elif "straight".startswith(token) or token.startswith("straight"):
            straight += math.exp(item["logprob"])
    total = rounded + straight
    return rounded / total if total > 0 else None


def score(root: str) -> None:
    with open(os.path.join(root, "manifest.json"), encoding="utf-8") as handle:
        labels = {item["clip"]: item["label"] for item in json.load(handle)}
    with open(os.path.join(root, "answers_logprob.json"), encoding="utf-8") as handle:
        answers = json.load(handle)
    frames: Dict[str, List[float]] = {}
    tokens = {"prompt": 0, "completion": 0}
    latencies: List[int] = []
    for answer in answers:
        tokens["prompt"] += answer["promptTokens"] or 0
        tokens["completion"] += answer["completionTokens"] or 0
        latencies.append(answer["latencyMs"])
        value = p_rounded(answer)
        if value is not None:
            frames.setdefault(answer["id"].rsplit("/", 1)[0], []).append(value)
    reps: Dict[str, List[float]] = {}
    per_frame = {}
    for key, values in sorted(frames.items()):
        mean = statistics.fmean(values)
        per_frame[key] = {"pRounded": round(mean, 3), "repeatSpread": round(max(values) - min(values), 3)}
        reps.setdefault(key.rsplit("/", 1)[0], []).append(mean)
    rows = []
    for key, values in sorted(reps.items()):
        clip, rep = key.split("/")
        mean = statistics.fmean(values)
        rows.append(
            {
                "clip": clip,
                "rep": rep,
                "label": labels[clip],
                "pRounded": round(mean, 3),
                "verdict": "rounded" if mean >= WARN_AT else "not_flagged",
                "frameMin": round(min(values), 3),
                "frameMax": round(max(values), 3),
                "frames": len(values),
            }
        )
    result = {
        "rows": rows,
        "perFrame": per_frame,
        "calls": len(answers),
        "tokens": tokens,
        "latencyMsMedian": round(statistics.median(latencies)) if latencies else None,
    }
    with open(os.path.join(root, "score_logprob.json"), "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=2)
    for row in rows:
        print(row)
    print("calls", result["calls"], "tokens", tokens, "latencyMsMedian", result["latencyMsMedian"])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["requests", "score"])
    parser.add_argument("--run", default="smoke")
    parser.add_argument("--repeats", type=int, default=2)
    args = parser.parse_args()
    root = os.path.join(cl.OUT, "back", args.run)
    if args.action == "requests":
        build_requests(root, args.repeats)
    else:
        score(root)


if __name__ == "__main__":
    main()
