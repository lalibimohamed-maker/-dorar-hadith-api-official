FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV VIRTUAL_ENV=/opt/dinullah-venv
ENV PATH=/opt/dinullah-venv/bin:/opt/bin:$PATH
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl file git python3 python3-venv python3-pip \
    ffmpeg tesseract-ocr imagemagick libgl1 libglib2.0-0 \
    libvulkan1 vulkan-tools && \
    rm -rf /var/lib/apt/lists/*

RUN python3 -m venv "$VIRTUAL_ENV" && \
    "$VIRTUAL_ENV/bin/pip" install --no-cache-dir --upgrade pip wheel && \
    "$VIRTUAL_ENV/bin/pip" install --no-cache-dir \
      "paddlepaddle==3.2.0" \
      "paddleocr==3.7.0" \
      "open3d==0.20.0" \
      "pycolmap==4.2.0" \
      "realesrgan==0.3.0" \
      "usd-core==26.8" \
      "opentimelineio==0.18.1"

RUN npm --version >/dev/null 2>&1 || true

RUN python3 - <<'PY'
import importlib
for name in ("paddle","paddleocr","open3d","pycolmap","realesrgan","pxr","opentimelineio"):
    importlib.import_module(name)
    print("IMPORT_OK", name)
PY

RUN ffmpeg -version | head -n 1 && \
    tesseract --version | head -n 1 && \
    magick -version | head -n 1 && \
    python3 -c 'import open3d,pycolmap,paddle,opentimelineio; print("PYTHON_RUNTIME_OK", open3d.__version__, pycolmap.__version__, paddle.__version__, opentimelineio.__version__)'

WORKDIR /runtime-data
CMD ["bash", "-lc", "echo 'Dinullah media runtime ready'; ffmpeg -version | head -n 1; tesseract --version | head -n 1; magick -version | head -n 1; python3 -c 'import open3d, pycolmap, paddle, pxr, opentimelineio; print("OpenUSD/Open3D/COLMAP/Paddle/OTIO runtime OK")'"]
