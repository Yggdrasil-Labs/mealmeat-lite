FROM caddy:2.11.6-alpine@sha256:d44355d3c2149dc580ce2cac735955d1c08d3d00882c30489c241aa51a5c10d9

# The Compose health checks use BusyBox wget. Assert that the pinned image provides it
# instead of relying on an implicit property of a floating base image.
RUN command -v wget
