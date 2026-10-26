# 薄肌检测器 HTTP 服务（boji-detector）。
# 构建上下文就是本目录，不需要 coachlink 的源码：
#   npm run push-boji-service-ccr
# 引擎版本固定在下面的提交；升级算法时改 BOJI_DETECTOR_REF 再推镜像。
FROM python:3.11-slim-bookworm

ARG BOJI_DETECTOR_REF=80e53f2ff3573db71a4f1a24d6d293aad916e136

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

# 依赖分成几层安装（每层约 200 MB）：单层 700 MB 时推腾讯云 CCR 会超时。
# 版本全部由 constraints.txt 锁定，后面的层不会改动前面层里的包。
COPY constraints.txt /tmp/constraints.txt
RUN pip install -c /tmp/constraints.txt numpy scipy pillow
RUN pip install -c /tmp/constraints.txt opencv-contrib-python
RUN pip install -c /tmp/constraints.txt mediapipe
RUN pip install -c /tmp/constraints.txt fastapi uvicorn && \
    pip install --no-deps "boji-detector @ https://github.com/SmallHorseBrother/boji-detector/archive/${BOJI_DETECTOR_REF}.tar.gz" && \
    pip check

# 模型在构建时下载并校验 SHA-256，运行时不再访问外网；
# 再真正加载一次模型，缺系统库时构建就失败，而不是上线后 Pod 起不来。
RUN boji fetch-models && boji doctor && \
    python -c "from boji_detector.perception_mp import MediaPipePerceiver; MediaPipePerceiver().close(); print('mediapipe ok')"

RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin boji
USER boji

EXPOSE 8000
CMD ["boji", "serve", "--host", "0.0.0.0", "--port", "8000"]
