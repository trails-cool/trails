FROM eclipse-temurin:11-jre-jammy

WORKDIR /brouter

# Download latest BRouter release
ARG BROUTER_VERSION=1.7.8
RUN apt-get update && apt-get install -y --no-install-recommends wget unzip curl \
    && wget -q "https://github.com/abrensch/brouter/releases/download/v${BROUTER_VERSION}/brouter-${BROUTER_VERSION}.zip" \
    && unzip "brouter-${BROUTER_VERSION}.zip" \
    && mv "brouter-${BROUTER_VERSION}"/* . \
    && rmdir "brouter-${BROUTER_VERSION}" \
    && rm "brouter-${BROUTER_VERSION}.zip" \
    && apt-get purge -y wget unzip && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# Create non-root user and directories for segments and profiles
RUN addgroup --system app && adduser --system --ingroup app app \
    && mkdir -p /data/segments /data/profiles

# Copy default profiles from release and rename JAR for simpler CMD
RUN cp -r profiles2/* /data/profiles/ 2>/dev/null || true \
    && mv brouter-*-all.jar brouter.jar

# Patch profiles to include extra tags in WayTags output for visualization
# Each tag needs its own assign statement to appear in tiledesc WayTags
RUN for f in /data/profiles/*.brf; do \
      if grep -q "dummyUsage" "$f"; then \
        grep -q "maxspeed" "$f" || sed -i '/assign dummyUsage/a assign dummyUsage2 = maxspeed=' "$f"; \
        grep -q "tracktype" "$f" || sed -i '/assign dummyUsage/a assign dummyUsage3 = tracktype=' "$f"; \
      elif grep -q "context:node" "$f"; then \
        sed -i '/---context:node/i assign dummyUsage2 = maxspeed=\nassign dummyUsage3 = tracktype=' "$f"; \
      fi; \
    done

USER app
EXPOSE 17777

# BRouter server: <segmentdir> <profiledir> <customprofiledir> <port> <maxthreads>
CMD ["java", "-Xmx1024M", "-Xms256M", "-Xmn64M", \
     "-DmaxRunningTime=300", \
     "-cp", "brouter.jar", \
     "btools.server.RouteServer", \
     "/data/segments", "/data/profiles", "/data/profiles", \
     "17777", "4"]
