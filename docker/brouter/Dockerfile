FROM eclipse-temurin:11-jre-jammy

WORKDIR /brouter

# Download latest BRouter release
ARG BROUTER_VERSION=1.7.7
RUN apt-get update && apt-get install -y --no-install-recommends wget unzip \
    && wget -q "https://github.com/abrensch/brouter/releases/download/${BROUTER_VERSION}/brouter-${BROUTER_VERSION}.zip" \
    && unzip "brouter-${BROUTER_VERSION}.zip" \
    && rm "brouter-${BROUTER_VERSION}.zip" \
    && apt-get purge -y wget unzip && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# Create directories for segments and profiles
RUN mkdir -p /data/segments /data/profiles

# Copy default profiles from release
RUN cp -r profiles2/* /data/profiles/ 2>/dev/null || true

EXPOSE 17777

# BRouter server: <segmentdir> <profiledir> <customprofiledir> <port> <maxthreads>
CMD ["java", "-Xmx512M", "-Xms128M", "-Xmn32M", \
     "-DmaxRunningTime=300", \
     "-cp", "brouter.jar", \
     "btools.server.RouteServer", \
     "/data/segments", "/data/profiles", "/data/profiles", \
     "17777", "4"]
