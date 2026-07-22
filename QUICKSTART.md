# Quick Start (the short version)

For full details, troubleshooting, and how everything works, see
`README.md`. This file is just the fastest path to a running app.

## 1. Install Python requirements

```bash
cd roadscan-ai
python3 -m venv venv
```

Activate it:
- **Mac/Linux**: `source venv/bin/activate`
- **Windows**: `venv\Scripts\activate`

Then:
```bash
pip install -r requirements.txt --break-system-packages
```
(If `--break-system-packages` gives an "unrecognized argument" error, just
drop it and run `pip install -r requirements.txt` instead - that flag is
only needed on some Linux systems.)

## 2. Check everything installed correctly

```bash
cd backend
python3 check_setup.py
```

This tells you exactly what's wrong, in plain English, if anything is
missing - **fix everything it flags before moving on.** Don't skip this
step; it catches almost every common setup problem in one go.

## 3. Build the React dashboard

```bash
cd ../frontend-react
npm install
npm run build
cd ../backend
```

## 4. Start the server

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Open **http://localhost:8000** in your browser. If it loads, you're running.

## 5. To use it from your phone (camera + GPS)

Plain `http://` will NOT work for camera/location on a phone - browsers
block this. You need HTTPS. Easiest way:

```bash
# in a separate terminal, while the server above is still running
ngrok http 8000
```

Open the `https://...ngrok-free.app` link it gives you - **on your
phone**, not the laptop's IP address.

## Still stuck?

Run `python3 check_setup.py` again and copy the **exact text** it prints
under any ✗ mark - that's the single most useful thing to share for help,
much more useful than "it's not working."
