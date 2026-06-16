# Deploy File-View on Oracle Cloud (Always Free)

A step-by-step guide to run File-View for free, forever, on an Oracle Cloud
"Always Free" VM with a persistent disk (so your SQLite data is never lost).

---

## 1. Create the free VM

1. Sign in to <https://cloud.oracle.com> → **Compute → Instances → Create instance**.
2. **Image & shape**:
   - Shape: **VM.Standard.A1.Flex** (Ampere/ARM — Always Free, pick e.g. 1 OCPU
     / 6 GB; up to 4 OCPU / 24 GB is free). If A1 is out of capacity, use
     **VM.Standard.E2.1.Micro** (AMD, also Always Free).
   - Image: **Oracle Linux 9** or **Ubuntu 22.04** — both work with the setup
     script.
3. **SSH keys**: upload your public key (or let Oracle generate one and download
   the private key).
4. The boot volume is a persistent disk — that is where `./data` will live, so
   your database survives reboots and redeploys. ✅
5. Click **Create** and wait for it to reach **Running**. Note the
   **Public IP address**.

## 2. Open the port in the OCI console (required!)

The OS firewall is not enough — Oracle's virtual network blocks everything by
default.

1. Go to **Networking → Virtual Cloud Networks →** your VCN **→ Security Lists →**
   the default security list.
2. **Add Ingress Rule**:
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: **TCP**
   - Destination Port Range: **3000** (or **80, 443** if you use the Caddy/HTTPS
     option)
3. Save.

## 3. Connect and deploy (one command)

SSH into the VM (`opc` is the default user on Oracle Linux, `ubuntu` on Ubuntu):

```bash
ssh opc@<your-vm-public-ip>      # or: ssh ubuntu@<your-vm-public-ip>
```

Then:

```bash
# install git if needed:  sudo dnf install -y git   (or: sudo apt install -y git)
git clone <your-repo-url> file-view
cd file-view
git checkout claude/eloquent-babbage-bw1prb

# (recommended) set a strong admin password + session secret first:
#   edit docker-compose.yml -> ADMIN_PASS / SESSION_SECRET

chmod +x deploy/oracle-setup.sh
./deploy/oracle-setup.sh
```

The script installs Docker, opens the OS firewall, builds the image and starts
the app. When it finishes it prints the URL:

```
http://<your-vm-public-ip>:3000
```

Sign in with `admin / admin1234` and **change the password immediately**
(Admins page).

> Note: the ARM (A1) shape builds the `better-sqlite3` native module from
> source inside the container — the bundled build tools handle this
> automatically, it just takes a little longer on the first build.

## 4. (Optional) HTTPS with your own domain

If you own a domain, point an `A` record at the VM's public IP, then:

1. Open ports **80** and **443** in the OCI Security List (step 2) and they are
   handled by the setup script's firewall step (`APP_PORT=80 ... ` not needed —
   just add them, or rerun firewall opening for 80/443).
2. Edit `deploy/Caddyfile` and replace `yourdomain.com` with your domain.
3. Start with the Caddy overlay:

```bash
sudo docker compose -f docker-compose.yml -f deploy/docker-compose.caddy.yml up -d --build
```

Caddy automatically obtains a free Let's Encrypt certificate. Your site is then
available at `https://yourdomain.com`.

## 5. Operating it

```bash
sudo docker compose ps                 # status
sudo docker compose logs -f file-view  # logs
sudo docker compose down               # stop
sudo docker compose up -d --build      # update after a git pull

# back up the database (everything is in ./data)
tar czf fileview-backup-$(date +%F).tar.gz data/
```

## Troubleshooting

- **Page won't load** → 95% of the time the OCI **Ingress rule** (step 2) is
  missing, or the OS firewall didn't open the port (the script handles the OS
  side; rerun it if unsure).
- **`docker: permission denied`** → log out and back in so your user picks up
  the `docker` group, or prefix commands with `sudo`.
- **A1 capacity error on create** → try a different availability domain/region,
  or use the E2.1.Micro shape.
