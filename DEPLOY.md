# Deploying File-View to the cloud

File-View is a standard Node.js + SQLite app with a Docker image, so it runs on
almost any cloud. The one thing to get right everywhere: **SQLite stores data in
a file (`/app/data`), so the host must give you a persistent disk/volume** — or
your users, shares and access records vanish on every redeploy/restart.

A strong `SESSION_SECRET` and a non-default `ADMIN_PASS` should always be set
before exposing the app publicly.

---

## Render (blueprint included)

A ready-to-use `render.yaml` is in this repo.

1. Push this repository to GitHub.
2. In Render: **New +** → **Blueprint** → select your repo.
3. Render reads `render.yaml`, provisions the web service **and a 1 GB
   persistent disk** mounted at `/app/data`, and generates `SESSION_SECRET`.
4. Set **`ADMIN_PASS`** in the service's *Environment* tab (it is marked
   `sync: false` so it is never committed to git).
5. Deploy. The app boots, auto-creates the admin, and is reachable at the
   `…onrender.com` URL Render gives you.

> The persistent disk requires the **Starter** instance type (paid). The free
> tier has no disk and would lose data on each deploy.

---

## Railway

1. Push to GitHub and create a **New Project → Deploy from GitHub repo**.
   Railway builds from the `Dockerfile` automatically.
2. Add a **Volume** mounted at `/app/data`.
3. Add variables: `SESSION_SECRET` (random), `ADMIN_PASS`, `PORT=3000`.
4. Deploy. Use the generated public domain.

---

## Fly.io

```bash
fly launch --no-deploy          # detects the Dockerfile; creates fly.toml
fly volumes create file_view_data --size 1
# In fly.toml add a [mounts] section:
#   [mounts]
#   source = "file_view_data"
#   destination = "/app/data"
fly secrets set SESSION_SECRET=$(openssl rand -hex 32) ADMIN_PASS='YourStrongPass'
fly deploy
```

Make sure `fly.toml` exposes internal port **3000**.

---

## Oracle Cloud — Always Free (recommended free option)

A free-forever VM with a persistent disk — ideal for SQLite. A one-command
setup script and full step-by-step walkthrough are in
**[`deploy/ORACLE.md`](deploy/ORACLE.md)**:

```bash
git clone <your-repo-url> file-view && cd file-view
git checkout claude/eloquent-babbage-bw1prb
chmod +x deploy/oracle-setup.sh
./deploy/oracle-setup.sh
```

The same script also works on Google Cloud / AWS free-tier VMs.

## Google Cloud — Always Free (e2-micro)

Often easier to get than Oracle's ARM capacity. Full walkthrough in
**[`deploy/GCP.md`](deploy/GCP.md)** — create a free `e2-micro` VM in
`us-central1`, open TCP 3000, then run the same `deploy/oracle-setup.sh`.

## Any VM (AWS EC2 / GCP / Azure / DigitalOcean)

The simplest, fully self-controlled option:

```bash
# on the VM (Docker + Docker Compose installed)
git clone <your-repo-url> file-view && cd file-view
git checkout claude/eloquent-babbage-bw1prb

# edit docker-compose.yml: set ADMIN_PASS and SESSION_SECRET
docker compose up -d --build
```

The app listens on port 3000 and the database persists in `./data` on the VM.
Put **HTTPS** in front of it with a reverse proxy — e.g. Caddy:

```
# Caddyfile
yourdomain.com {
    reverse_proxy localhost:3000
}
```

`caddy run` then handles TLS certificates automatically.

---

## Post-deploy checklist

- [ ] Signed in and **changed the admin password** (Admins page).
- [ ] `SESSION_SECRET` is a long random value (not the default).
- [ ] Persistent disk/volume is mounted at `/app/data` and survives a redeploy.
- [ ] App is served over **HTTPS**.
