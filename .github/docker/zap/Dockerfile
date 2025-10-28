
FROM owasp/zap2docker-stable:2.14.0

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8090/core/other/version || exit 1

RUN useradd -m -u 1000 zap && chown -R zap:zap /zap
USER zap


USER root

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl=7.* ca-certificates=* \
  && rm -rf /var/lib/apt/lists/* \
  && useradd -m -u 1000 zaprunner \
  && mkdir -p /zap \
  && chown -R zaprunner:zaprunner /zap

USER zaprunner

HEALTHCHECK --interval=1m --timeout=10s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080 || exit 1
