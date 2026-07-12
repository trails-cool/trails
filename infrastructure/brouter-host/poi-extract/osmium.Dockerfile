# Minimal osmium-tool image for the POI extract pipeline. The BRouter host runs
# a non-root `trails` user with no sudo, so osmium can't be apt-installed on the
# host — poi-extract.sh runs it in this container instead (docker-group rights
# are available). Big files are bind-mounted, so I/O is native; the container
# adds no meaningful CPU/throughput overhead on Linux.
#
# Built on first use by poi-extract.sh (tag: trails-osmium:local). Self-hosters
# get identical behavior without touching system packages.
FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends osmium-tool \
    && rm -rf /var/lib/apt/lists/*

ENTRYPOINT ["osmium"]
