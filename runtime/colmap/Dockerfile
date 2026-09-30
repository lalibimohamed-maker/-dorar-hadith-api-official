FROM ubuntu:24.04

ARG COLMAP_VERSION=4.2.0
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git cmake ninja-build build-essential pkg-config \
    libboost-filesystem-dev libboost-graph-dev libboost-program-options-dev \
    libboost-system-dev libboost-test-dev libeigen3-dev libflann-dev \
    libfreeimage-dev libglew-dev libgoogle-glog-dev libgflags-dev \
    libceres-dev libsqlite3-dev libmetis-dev libqt6opengl6-dev \
    qt6-base-dev qt6-tools-dev libcgal-dev libcurl4-openssl-dev \
    libgmp-dev libmpfr-dev && \
    rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch "$COLMAP_VERSION" https://github.com/colmap/colmap.git /src/colmap && \
    cmake -S /src/colmap -B /src/colmap/build -G Ninja \
      -DCMAKE_BUILD_TYPE=Release -DGUI_ENABLED=OFF -DCUDA_ENABLED=OFF && \
    cmake --build /src/colmap/build && \
    cmake --install /src/colmap/build && \
    colmap -h >/dev/null

CMD ["colmap","-h"]
