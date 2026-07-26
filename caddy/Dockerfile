FROM caddy:2.11.4-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648

# The Compose health checks use BusyBox wget. Assert that the pinned image provides it
# instead of relying on an implicit property of a floating base image.
RUN command -v wget
