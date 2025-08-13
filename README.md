# CIRISGUI

This sub-project provides a unified user interface and API runtime for the CIRIS agent.

## Structure

- **apps/agui** – Next.js 14 frontend using the CIRIS SDK
- **apps/ciris-api** – Wrapper around the Python API runtime
- **docker/** – Dockerfiles and compose setup
- **scripts/start.sh** – Local development bootstrap

## Development

1. Install dependencies using `pnpm install` within `apps/agui` and `poetry install` in `apps/ciris-api`.
2. Run `./scripts/start.sh` to launch both the API (port 8080) and web UI (port 3000).

Environment variables:
- `OPENAI_API_KEY` – required by the agent runtime.
- `CIRIS_API_BASE_URL` – base URL for the API (used by the frontend).

## Production

Build the Docker images and start using `docker-compose` inside the `docker/` directory.
