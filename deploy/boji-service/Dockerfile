# 薄肌检测器 HTTP 服务（boji-detector）。
# 构建上下文就是本目录，不需要 coachlink 的源码：
#   npm run push-boji-service-ccr
# 引擎版本固定在下面的提交；升级算法时改 BOJI_DETECTOR_REF 再推镜像。
FROM python:3.11-slim-bookworm

ARG BOJI_DETECTOR_REF=e624dc1ad29a6bff4a01711cbc4f862f7948564b

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    BOJI_MODELS_DIR=/opt/boji/models

RUN apt-get update && \
    apt-get install -y --no-install-recommends -o Acquire::Retries=5 \
      ca-certificates \
      libegl1 \
      libgl1 \
      libgles2 \
      libglib2.0-0 \
      libportaudio2 && \
    rm -rf /var/lib/apt/lists/*

RUN pip install "boji-detector[server] @ https://github.com/SmallHorseBrother/boji-detector/archive/${BOJI_DETECTOR_REF}.tar.gz"

# 模型在构建时下载并校验 SHA-256，运行时不再访问外网；
# 再真正加载一次模型，缺系统库时构建就失败，而不是上线后 Pod 起不来。
RUN boji fetch-models && boji doctor && \
    python -c "from boji_detector.perception_mp import MediaPipePerceiver; MediaPipePerceiver().close(); print('mediapipe ok')"

RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin boji
USER boji

EXPOSE 8000
CMD ["boji", "serve", "--host", "0.0.0.0", "--port", "8000"]
