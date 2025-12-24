# Reacher API Gateway

Central entry point for all Reacher API requests. Validates JWT tokens, routes requests to microservices, and handles cross-cutting concerns like logging and rate limiting.

## Quick Start

### Prerequisites
- Node.js v16+
- Redis (for token blacklist)

### Setup

```bash
npm install
```

### Environment Variables

Create `.env` file:

```env
NODE_ENV=development
PORT=5000
JWT_SECRET=your-secret-key-here
REDIS_HOST=localhost
REDIS_PORT=6379

# Service URLs (will be implemented)
AUTH_SERVICE_URL=http://localhost:5001
USER_SERVICE_URL=http://localhost:5002
PRODUCT_SERVICE_URL=http://localhost:5003
SERVICE_PROVIDER_SERVICE_URL=http://localhost:5004
MESSAGE_SERVICE_URL=http://localhost:5005
TRUST_SERVICE_URL=http://localhost:5006
```

### Running

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

Server listens on `http://localhost:5000` (or custom `PORT`).

## API Endpoints

### Public (No Auth Required)
- `POST /api/auth/signup` — Create new user
- `POST /api/auth/login` — Login and receive JWT

### Protected (JWT Required)
- `GET /api/users` — List users
- `GET /api/products` — Search products
- `GET /api/services` — Search services
- `GET /api/messages` — List messages
- `GET /api/trust` — View trust reports

## Architecture

```
[Frontend] → [Gateway] → [Auth Service]
                      → [User Service]
                      → [Product Service]
                      → [Message Service]
                      → [Trust Service]
                      ...
```

- **Gateway** validates JWT and forwards requests to appropriate microservices
- **Redis** maintains token blacklist for logout functionality
- Each service handles its own business logic and database

## Testing

```bash
npm test
```

## Deployment

See root `README.md` for deployment instructions.

## Environment / Deployment Configuration

The gateway resolves upstream service URLs from environment variables (for example `AUTH_SERVICE_URL`). Use environment-appropriate values — do not hard-code `127.0.0.1` for cloud deployments.

Recommended values per environment:

- Local development (gateway and auth running on same host):
    - `AUTH_SERVICE_URL=http://127.0.0.1:5001`

- Docker Compose (services on the same Docker network, use service name):
    - `AUTH_SERVICE_URL=http://auth-service:5001`
    - Example (in `docker-compose.yml` for gateway service):
        ```yaml
        environment:
            - AUTH_SERVICE_URL=http://auth-service:5001
        ```

- Kubernetes (use service DNS):
    - `AUTH_SERVICE_URL=http://auth-service:5001`
    - In k8s manifests set the env var in the `Deployment` and ensure a `Service` named `auth-service` exists in the same namespace.

- Cloud / Production (internal load balancer or private hostname):
    - `AUTH_SERVICE_URL=https://auth.internal.yourdomain.com`
    - Configure this value in your platform's environment variable settings (ECS task definition, App Service settings, Kubernetes ConfigMap/Secret, etc.).

Why this matters
- `127.0.0.1` refers to the local loopback inside the process' network namespace. In containers or VMs, `127.0.0.1` is the container/VM itself and will not reach other services.
- Use service names (Docker Compose) or cluster DNS (Kubernetes) or internal hostnames (cloud) so the gateway can route reliably in each environment.

Best practices
- Keep environment variables out of source control; store them in `.env` (local) and in your CI/CD / hosting platform for production.
- Use TLS (HTTPS) between services in production.
- Add timeouts, retries and circuit-breakers for upstream calls.
- Use readiness/liveness probes (k8s) or health checks so the gateway only routes to healthy upstream instances.

Local dev convenience
- While developing, you can point the gateway to a local auth process (`http://127.0.0.1:5001`) or to a Docker Compose service (`http://auth-service:5001`) depending on how you run the stack.

