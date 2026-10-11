FROM caddy:2.11.7-alpine@sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f

# The Compose health checks use BusyBox wget. Assert that the pinned image provides it
# instead of relying on an implicit property of a floating base image.
RUN command -v wget
