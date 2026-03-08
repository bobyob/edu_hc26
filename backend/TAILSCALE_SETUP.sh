# Tailscale Setup for MyFocusFriend Pi Backend
# Run these commands on your Raspberry Pi 5

# ── Step 1: Install Tailscale ──────────────────────────────────────
curl -fsSL https://tailscale.com/install.sh | sh

# ── Step 2: Start Tailscale and connect to your network ───────────
sudo tailscale up
# This will print a URL — open it in a browser and log in with your Tailscale account
# (Create a free account at tailscale.com if you don't have one)

# ── Step 3: Note your Pi's Tailscale hostname ─────────────────────
tailscale status
# You'll see something like:
#   100.x.x.x   raspberrypi  (your device)
# Your private URL will be: https://raspberrypi.<tailnet-name>.ts.net

# ── Step 4: Start your Flask backend ──────────────────────────────
cd /path/to/myfocusfriend/backend
pip install -r requirements.txt
python app.py
# Flask will start on 0.0.0.0:5000

# ── Step 5: Expose Flask via Tailscale Serve ──────────────────────
# This makes your Flask server accessible at your Pi's .ts.net URL
sudo tailscale serve 5000
# Now https://raspberrypi.<tailnet>.ts.net → your Flask server

# ── Step 6: Set the URL in your frontend ──────────────────────────
# In your frontend folder, create a .env file:
#   VITE_PI_URL=https://raspberrypi.<tailnet-name>.ts.net
# Then restart the frontend dev server.

# ── Step 7: For parents/tutors to access the summary ──────────────
# Parent/tutor installs Tailscale on their device (phone or laptop)
# They join YOUR Tailscale network (you invite them from tailscale.com/admin)
# They can then open: https://raspberrypi.<tailnet>.ts.net/api/parent-summary
# That's it — no port forwarding, no public IP needed.

# ── Auto-start Flask on Pi boot (optional) ────────────────────────
# Create a systemd service:
sudo tee /etc/systemd/system/myfocusfriend.service > /dev/null <<EOF
[Unit]
Description=MyFocusFriend Flask Backend
After=network.target

[Service]
User=pi
WorkingDirectory=/home/pi/myfocusfriend/backend
ExecStart=/usr/bin/python3 /home/pi/myfocusfriend/backend/app.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable myfocusfriend
sudo systemctl start myfocusfriend
