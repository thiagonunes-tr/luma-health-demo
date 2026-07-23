# Luma Health — Vercel frontend

This directory contains the Vercel-ready frontend. Authentication, MFA, email delivery, user persistence, and the 24-hour demo reset remain on the Cloudflare Worker.

## Import into Vercel

1. Import the GitHub repository `thiagonunes-tr/luma-health-demo`.
2. Keep the repository root as the project root.
3. The root `vercel.json` selects this Vite package and its output automatically.
4. Deploy. No environment variables are required for the frontend.

Requests under `/api/*` are securely proxied to the existing Cloudflare Worker, so authentication cookies remain first-party on the Vercel domain.
