# Deploy File-View on Google Cloud (Always Free)

Google Cloud's **Always Free** tier includes one **e2-micro** VM per month plus a
30 GB persistent disk — perfect for File-View, and far easier to get than
Oracle's ARM capacity.

The same setup script (`deploy/oracle-setup.sh`) works here unchanged — it's a
generic Ubuntu/Debian installer (Docker + firewall + run) and auto-creates swap
for the e2-micro's 1 GB RAM.

---

## 1. Create the free VM

1. Go to <https://console.cloud.google.com> → create/select a **Project**.
   (You'll be asked to enable **Billing** with a card; Always-Free usage within
   limits is not charged.)
2. **Compute Engine → VM instances → Create instance**
   (enable the Compute Engine API if prompted).
3. Configure for the **free tier**:
   - **Name**: `file-view`
   - **Region**: must be one of the free regions — **`us-central1` (Iowa)**,
     `us-west1` (Oregon), or `us-east1` (South Carolina). Pick `us-central1`.
   - **Machine type**: series **E2** → **`e2-micro`** (this is the free one).
   - **Boot disk**: click *Change* → **Ubuntu 22.04 LTS**, disk type
     **Standard persistent disk**, size **30 GB** (free-tier limit).
4. **Firewall**: tick **Allow HTTP traffic** (we'll still add a rule for port
   3000 next).
5. Click **Create**. When it's running, note the **External IP**.

## 2. Open port 3000 (VPC firewall rule)

1. **VPC network → Firewall → Create firewall rule**.
2. Set:
   - **Name**: `allow-fileview`
   - **Direction**: Ingress
   - **Targets**: *All instances in the network*
   - **Source IPv4 ranges**: `0.0.0.0/0`
   - **Protocols and ports**: *Specified protocols and ports* → check **TCP** →
     `3000`
3. **Create**.

## 3. Deploy (one command)

Click **SSH** next to the VM in the console (opens an in-browser terminal — no
key setup needed). Then:

```bash
sudo apt-get update -y && sudo apt-get install -y git
git clone <your-repo-url> file-view
cd file-view
git checkout claude/eloquent-babbage-bw1prb

# (recommended) set a strong admin password + session secret first:
#   nano docker-compose.yml   -> change ADMIN_PASS and SESSION_SECRET

chmod +x deploy/oracle-setup.sh
./deploy/oracle-setup.sh
```

The script installs Docker, adds swap, builds the image and starts the app. When
done it prints:

```
http://<your-external-ip>:3000
```

Open it, sign in with `admin / admin1234`, and **change the password**
(Admins page).

## 4. (Optional) HTTPS with a domain

Point an `A` record at the External IP, add firewall rules for TCP **80** and
**443** (step 2), edit `deploy/Caddyfile` with your domain, then:

```bash
sudo docker compose -f docker-compose.yml -f deploy/docker-compose.caddy.yml up -d --build
```

## Operating it

```bash
sudo docker compose ps                 # status
sudo docker compose logs -f file-view  # logs
sudo docker compose up -d --build      # update after a git pull
tar czf fileview-backup-$(date +%F).tar.gz data/   # backup the database
```

## Notes / gotchas

- Keep the VM in a **free region** and on **e2-micro** with a **≤30 GB standard**
  disk to stay within Always Free.
- e2-micro has 1 GB RAM — the script adds 2 GB swap so the first Docker build
  won't run out of memory. The build just takes a few minutes.
- Page won't load? Re-check the **firewall rule** for TCP 3000 (step 2).
