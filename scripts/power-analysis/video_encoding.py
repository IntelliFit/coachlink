"""FFmpeg encoding of the rendered analysis video, keeping the original audio track."""
import os
import shutil
import subprocess
from typing import Any, Dict, List


def env_int(name: str, fallback: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.environ.get(name, str(fallback)))
    except (TypeError, ValueError):
        return fallback
    return min(maximum, max(minimum, value))


def require_executable(env_name: str, fallback: str) -> str:
    configured = str(os.environ.get(env_name, fallback)).strip() or fallback
    resolved = shutil.which(configured)
    if not resolved:
        raise RuntimeError(f"Required executable is unavailable: {configured}")
    return resolved


def has_audio_stream(video_path: str, ffprobe_bin: str) -> bool:
    result = subprocess.run(
        [
            ffprobe_bin,
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=index",
            "-of",
            "csv=p=0",
            video_path,
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "Cannot inspect video audio stream")
    return bool(result.stdout.strip())


def get_video_duration_seconds(video_path: str, ffprobe_bin: str) -> float:
    result = subprocess.run(
        [
            ffprobe_bin,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            video_path,
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "Cannot inspect video duration")
    try:
        duration = float(result.stdout.strip())
    except (TypeError, ValueError):
        duration = 0.0
    if duration <= 0:
        raise RuntimeError("Cannot determine video duration")
    return duration


def run_ffmpeg(command: List[str], output_path: str, failure_message: str) -> None:
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        if os.path.exists(output_path):
            os.remove(output_path)
        raise RuntimeError(result.stderr.strip() or failure_message)
    if not os.path.exists(output_path) or os.path.getsize(output_path) <= 0:
        raise RuntimeError(failure_message)


def constrain_output_size(
    output_path: str,
    max_output_bytes: int,
    duration_seconds: float,
    ffmpeg_bin: str,
    preset: str,
) -> bool:
    if os.path.getsize(output_path) <= max_output_bytes:
        return False

    limited_path = f"{output_path}.limited.mp4"
    target_total_bps = max(96_000, int((max_output_bytes * 8 / duration_seconds) * 0.82))
    target_video_bps = max(64_000, target_total_bps - 128_000)
    command = [
        ffmpeg_bin,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        output_path,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-c:v",
        "libx264",
        "-preset",
        preset,
        "-b:v",
        str(target_video_bps),
        "-maxrate",
        str(target_video_bps),
        "-bufsize",
        str(target_video_bps * 2),
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
        limited_path,
    ]
    run_ffmpeg(command, limited_path, "FFmpeg failed to limit analysis video size")
    os.replace(limited_path, output_path)
    return True


def finalize_output_video(input_path: str, rendered_path: str, output_path: str, quality: str) -> Dict[str, Any]:
    ffmpeg_bin = require_executable("POWER_ANALYSIS_FFMPEG_BIN", "ffmpeg")
    ffprobe_bin = require_executable("POWER_ANALYSIS_FFPROBE_BIN", "ffprobe")
    input_has_audio = has_audio_stream(input_path, ffprobe_bin)
    is_original_quality = quality == "original"
    crf = env_int(
        "POWER_ANALYSIS_ORIGINAL_VIDEO_CRF" if is_original_quality else "POWER_ANALYSIS_VIDEO_CRF",
        18 if is_original_quality else 23,
        16 if is_original_quality else 18,
        24 if is_original_quality else 32,
    )
    preset = str(
        os.environ.get(
            "POWER_ANALYSIS_ORIGINAL_VIDEO_PRESET" if is_original_quality else "POWER_ANALYSIS_VIDEO_PRESET",
            "slow" if is_original_quality else "medium",
        )
    ).strip().lower()
    if preset not in {"ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow"}:
        preset = "medium"
    audio_kbps = env_int(
        "POWER_ANALYSIS_ORIGINAL_AUDIO_BITRATE_KBPS" if is_original_quality else "POWER_ANALYSIS_AUDIO_BITRATE_KBPS",
        192 if is_original_quality else 128,
        64,
        320,
    )
    output_max_mb = env_int("POWER_ANALYSIS_OUTPUT_MAX_MB", 50, 1, 200)
    output_max_ratio_percent = env_int("POWER_ANALYSIS_OUTPUT_MAX_RATIO_PERCENT", 100, 50, 100)
    input_size_bytes = os.path.getsize(input_path)
    max_output_bytes = min(
        output_max_mb * 1024 * 1024,
        max(1, input_size_bytes * output_max_ratio_percent // 100),
    )
    duration_seconds = get_video_duration_seconds(input_path, ffprobe_bin)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    command = [
        ffmpeg_bin,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        rendered_path,
        "-i",
        input_path,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0?",
        "-map_metadata",
        "1",
        "-c:v",
        "libx264",
        "-preset",
        preset,
        "-crf",
        str(crf),
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
        output_path,
    ]
    try:
        run_ffmpeg(command, output_path, "FFmpeg failed to encode analysis video")
    except RuntimeError:
        if not input_has_audio:
            raise
        audio_codec_index = command.index("-c:a") + 1
        command[audio_codec_index] = "aac"
        movflags_index = command.index("-movflags")
        command[movflags_index:movflags_index] = ["-b:a", f"{audio_kbps}k"]
        run_ffmpeg(command, output_path, "FFmpeg failed to encode analysis video with audio fallback")

    size_limited = constrain_output_size(
        output_path,
        max_output_bytes,
        duration_seconds,
        ffmpeg_bin,
        preset,
    )

    output_has_audio = has_audio_stream(output_path, ffprobe_bin)
    if input_has_audio and not output_has_audio:
        os.remove(output_path)
        raise RuntimeError("Analysis video lost the original audio stream")

    return {
        "inputSizeBytes": input_size_bytes,
        "outputSizeBytes": os.path.getsize(output_path),
        "outputSizeLimitBytes": max_output_bytes,
        "outputSizeLimited": size_limited,
        "inputHasAudio": input_has_audio,
        "outputHasAudio": output_has_audio,
        "audioPreserved": input_has_audio == output_has_audio,
        "codec": "h264",
        "crf": crf,
        "quality": quality,
    }
