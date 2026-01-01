# Vercel Integration

## Purpose

Vercel provides the hosting and deployment infrastructure for p2pmentor. It is our one central dependency for serving the web application and running serverless functions. It is not a dependency for the persistence or verification of public application data.

## What Vercel Does

Vercel hosts p2pmentor as a Next.js application and provides:

* **Web interface hosting**: Serves the Next.js frontend and API routes
* **Serverless functions**: Runs Next.js API routes as serverless functions
* **Environment variable management**: Secure storage and injection of configuration
* **Scheduled tasks**: Cron jobs for periodic data aggregation

## What Vercel Does Not Do

Vercel does **not** act as a source of truth for application data.

* No database storage for public records
* No persistence of public application data beyond ephemeral caching
* No control over the data layer (Arkiv handles that)

If Vercel disappeared, the public data would still exist on Arkiv and could be read by any compatible client.

## Serverless Functions

All Next.js API routes (`/app/api/*`) run as serverless functions on Vercel:

* Functions scale automatically with traffic
* Each function invocation is independent
* No persistent server state between requests
* Functions read from Arkiv, format data, and return responses

This aligns with our serverless architecture: we do not rely on a private backend database. Arkiv functions as the data layer.

## Environment Variables

Configuration is managed through Vercel's environment variable system:

* Set in Vercel dashboard (Settings → Environment Variables)
* Injected at build time and runtime
* Separate values for production, preview, and development environments

Key variables include:

* `ARKIV_PRIVATE_KEY`: Private key used by serverless functions to submit Arkiv transactions on behalf of the application (not for custody of user funds)
* `ARKIV_RPC_URL`: Arkiv RPC endpoint
* `JITSI_BASE_URL`: Jitsi instance URL
* `NEXT_PUBLIC_*`: Public variables accessible in browser

See [Architecture Overview](/docs/architecture/overview) for complete environment variable documentation.

## Scheduled Tasks

Vercel cron jobs run periodic tasks defined in `vercel.json`:

* **Daily aggregates**: `/api/cron/daily-aggregates` runs daily at midnight UTC
* **Weekly retention**: `/api/cron/weekly-retention` runs weekly on Mondays at midnight UTC

These tasks read from Arkiv, compute metrics, and write aggregated results back to Arkiv. They do not use a private database. This ensures that derived data remains verifiable and does not introduce a secondary source of truth.

## Deployment

Deployments happen automatically on:

* Push to main branch (production)
* Pull requests (preview deployments)
* Manual deployments from Vercel dashboard

Each deployment:

* Builds the Next.js application
* Runs build-time checks
* Deploys serverless functions
* Updates environment variables if changed

## Architecture Alignment

Vercel's serverless model aligns with our architecture principles:

* **No persistent database**: Functions are stateless
* **Ephemeral compute**: Each request is independent
* **Clear separation**: Vercel serves the interface, Arkiv stores the data

Our servers (Vercel functions) are used only to:

* Serve the web interface
* Format and display public data
* Coordinate interactions with external services

The data itself lives on Arkiv, not on Vercel.

## Related Documentation

* [Serverless & Verifiable by Design](/docs/philosophy/serverless-and-trustless) - Architectural principles
* [Architecture Overview](/docs/architecture/overview) - Complete system architecture
* [Jitsi Integration](/docs/architecture/integrations/jitsi-integration) - Video meeting coordination

