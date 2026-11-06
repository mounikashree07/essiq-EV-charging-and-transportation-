# Deploy essiq to Render

This free deployment runs the frontend and FastAPI together. It uses temporary
SQLite storage, so accounts and profile history may be lost when the service
restarts or is redeployed. The single-instance SQLite setup is for a small demo;
it is not intended for multiple backend instances.

1. Push this project to a GitHub repository.
2. In Render, choose **New → Blueprint**, select the repository, and apply
   `render.yaml`.
3. Enter the Open Charge Map API key as the requested secret environment
   variable. Never put it in frontend files or commit it.
4. Wait for the Docker build and `/health` check to pass, then open the Render
   URL and test signup, login, and logout over HTTPS.

The free service may spin down after inactivity and has ephemeral storage.
Upgrade to a paid service with a persistent disk if account and profile history
must survive restarts. The MongoDB vehicle endpoints are separate from local
SQLite authentication and require a reachable `MONGO_URI` if used.
