# Deploy essiq to Render

This deployment runs the frontend and FastAPI together and stores accounts and
profile history on a persistent disk. The single-instance SQLite setup is for a
small demo; it is not intended for multiple backend instances.

1. Push this project to a GitHub repository.
2. In Render, choose **New → Blueprint**, select the repository, and apply
   `render.yaml`.
3. Enter the Open Charge Map API key as the requested secret environment
   variable. Never put it in frontend files or commit it.
4. Wait for the Docker build and `/health` check to pass, then open the Render
   URL and test signup, login, and logout over HTTPS.

The Render Starter service and persistent disk may incur charges. Check
Render's current pricing before confirming. The MongoDB vehicle endpoints are
separate from local SQLite authentication and require a reachable `MONGO_URI`
if used.
