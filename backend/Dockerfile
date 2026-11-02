FROM maven:3.9-eclipse-temurin-21 AS dependencies
WORKDIR /workspace
COPY pom.xml ./
RUN --mount=type=cache,target=/root/.m2 mvn --batch-mode dependency:go-offline

FROM dependencies AS source
COPY src ./src

FROM source AS test
CMD ["mvn", "--batch-mode", "verify"]

FROM source AS build
RUN --mount=type=cache,target=/root/.m2 mvn --batch-mode -DskipTests package

FROM eclipse-temurin:21-jre-jammy AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system studio && useradd --system --gid studio studio \
    && mkdir /app/storage && chown studio:studio /app/storage
COPY --from=build /workspace/target/studio-backend-*.jar /app/app.jar
USER studio
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=6 \
  CMD curl --fail --silent http://localhost:8080/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
