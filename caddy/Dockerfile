FROM caddy:2.11.9-alpine@sha256:003a97808e781aa9f7e75cc2f43d34d461099031faf5e20faefb9f61126836f0

# The Compose health checks use BusyBox wget. Assert that the pinned image provides it
# instead of relying on an implicit property of a floating base image.
RUN command -v wget
