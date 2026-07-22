FROM caddy:2.9.1-alpine@sha256:cf1bd22f2415bc99b785ece1df2c49d32985ac4ac42d84df335be17350593693

# The Compose health checks use BusyBox wget. Assert that the pinned image provides it
# instead of relying on an implicit property of a floating base image.
RUN command -v wget
