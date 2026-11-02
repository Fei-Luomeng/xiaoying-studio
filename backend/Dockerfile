FROM maven:3.9-eclipse-temurin-21 AS source
WORKDIR /workspace
COPY pom.xml ./
COPY src ./src

FROM source AS test
# Resolve only the lifecycle we use, and retain the cache in the test image.
# A BuildKit cache mount alone is not available to the running test container.
RUN --mount=type=cache,target=/root/.m2,sharing=locked \
    mvn --batch-mode -DskipTests test-compile \
    && cp -a /root/.m2/repository /opt/maven-repository
CMD ["mvn", "--batch-mode", "-Dmaven.repo.local=/opt/maven-repository", "verify"]

FROM source AS build
RUN --mount=type=cache,target=/root/.m2,sharing=locked mvn --batch-mode -DskipTests package

FROM eclipse-temurin:21-jre-jammy AS runtime
WORKDIR /app
# The official Temurin image already contains curl; no extra apt downloads.
RUN groupadd --system studio && useradd --system --gid studio studio \
    && mkdir /app/storage && chown studio:studio /app/storage
COPY --from=build /workspace/target/studio-backend-*.jar /app/app.jar
USER studio
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=6 \
  CMD curl --fail --silent http://localhost:8080/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
