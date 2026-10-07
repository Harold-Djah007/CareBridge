# CareBridge on Render

The repository-root `render.yaml` deploys the production Docker image, Render Postgres 17 and a private Redis-compatible Key Value service. All three use Frankfurt. Paid instance plans are selected; inspect the current charges in Render before provisioning. The web service is initially limited to one instance because Socket.IO room broadcasts are process-local.

## Deploy

1. In Render, choose **New → Blueprint**, connect `Harold-Djah007/CareBridge`, and select `rebuild/carebridge-premium-v6`. Use the repository-root `render.yaml`.
2. Review the three services and paid plans. Enter the secret fields Render prompts for: live Flutterwave key; SMTP host/user/password/from; Coturn REST URL/shared secret; and your first administrator's email/password. Use at least 10 characters with a letter and a number for the administrator password. Do not use the local demonstration accounts.
3. Deploy. Render supplies the public HTTPS URL and connects PostgreSQL/Redis internally. The service starts from `server/data/production.json`, which contains no demonstration or local records, and creates the first administrator with a hashed password only when the database is empty.
4. Log in through the **Operations** portal with the administrator credentials you entered. Enrol MFA, change the bootstrap password through Settings, then remove `CAREBRIDGE_BOOTSTRAP_ADMIN_PASSWORD` from the service environment. A redeploy never resets existing accounts. Configure staff, beds, stock and hospital settings in this fresh installation.
5. Copy the generated `FLW_SECRET_HASH` from Render privately into Flutterwave's webhook settings and set its webhook URL to `https://YOUR-SERVICE.onrender.com/api/payments/webhook`. For a custom domain, update `APP_URL`, `CLIENT_URL` and the webhook URL to match before testing payments.
6. Run the live service and handover checks in `PRODUCTION_RELEASE.md`. Verify backup retention and restore for the Render database before accepting real records. The generated backup encryption key supports the project's separate encrypted-export workflow; a key alone does not schedule exports.

`/api/ready` is the Render HTTP health check. It reports unavailable when PostgreSQL or Redis is unavailable. Docker health checks follow `PORT`, including Render's configured port 10000. The frontend and API share one HTTPS origin; no separate static site or frontend API URL is needed. Auto-deployment is initially disabled so changes are released deliberately after checks pass.

The web service's filesystem is ephemeral. PostgreSQL holds application records; do not use local JSON persistence in this deployment. Render does not replace the external payment, SMTP or Coturn services. Missing required service settings deliberately prevent production startup.

## Post-deploy verification

From a trusted workstation, configure `CAREBRIDGE_BASE_URL`, `CAREBRIDGE_SMOKE_EMAIL`, `CAREBRIDGE_SMOKE_PASSWORD` and `CAREBRIDGE_SMOKE_ROLE=admin` privately, then run:

```powershell
npm run smoke:production
```

Once MFA is enabled, the current password-only smoke helper cannot complete that login. Use a designated restricted test account for its basic authenticated path and verify the administrator path manually with MFA.

See Render's [Blueprint reference](https://render.com/docs/blueprint-spec), [Docker deployment guide](https://render.com/docs/docker) and [WebSocket support](https://render.com/docs/websocket). This describes a prepared deployment, not proof that a live Render service has been provisioned.
