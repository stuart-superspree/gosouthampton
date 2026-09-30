# Deploy: GitHub, then Railway

These steps put the demo online at its own Railway address. They take about 15 minutes the first time.

**This is a new, separate service.** It doesn't touch the cruise demo in `southampton-cruise-deploy`. That one stays live as it is.

## What gets deployed

| File | What it does |
|---|---|
| `Dockerfile` | Builds a small web server image (about 25 MB): Caddy 2.11.4 plus the `site` folder. There's no Node or npm install at run time. It also refreshes the offline lists during the build and checks the Caddyfile, so a broken config fails the build instead of the live site. |
| `railway.json` | Tells Railway to build from the Dockerfile, and to wait until the home page answers before sending visitors to a new version. |
| `Caddyfile` | The web server rules: the port Railway gives it, compression, security headers, caching, and tap links (`/t/...`). |
| `.dockerignore` | Keeps tests, notes and other files out of the image. |
| `publish-to-github.bat` | A double-click helper that sends this folder to GitHub (optional; see step 2). |

The `.gitignore` file keeps `node_modules` and `tests/out` off GitHub. Test evidence stays on your computer.

## What you need

- A GitHub account.
- A Railway account. Sign in with GitHub, which makes step 3 simpler.
- Either **Git for Windows** (https://git-scm.com/download/win) or **GitHub Desktop** (https://desktop.github.com). You only need one.

## Step 1: Make an empty repository on GitHub

1. Go to https://github.com/new.
2. Repository name: `southampton-routeloop-city`. Private is fine.
3. Leave **Add a README**, **.gitignore** and **licence** all unticked. The repository must be empty.
4. Click **Create repository**, then copy the URL it shows. It looks like `https://github.com/YOUR-NAME/southampton-routeloop-city.git`.

If you use GitHub Desktop (option B below), skip this step. Desktop creates the repository for you.

## Step 2: Send the folder to GitHub

Pick **one** of these.

**Option A: double-click `publish-to-github.bat`** (needs Git for Windows)

1. Double-click `publish-to-github.bat` in the `southampton-routeloop-city` folder.
2. If Git doesn't know you yet, it asks for your name and email. Use the email on your GitHub account.
3. Paste the repository URL from step 1 and press Enter.
4. A browser window may ask you to sign in to GitHub. Approve it.
5. When it says **Done**, refresh the repository page on GitHub. You should see the files, including `Dockerfile` and the `site` folder.

**Option B: GitHub Desktop**

1. In GitHub Desktop: **File**, then **Add local repository**, then choose the `southampton-routeloop-city` folder.
2. It says the folder isn't a repository yet. Click **create a repository**, then **Create repository**.
3. Click **Publish repository**. Untick **Keep this code private** only if you want it public.

**Option C: the command line**

Run these from inside the folder:

```bash
git init -b main
git add -A
git commit -m "Southampton RouteLoop city centre demo"
git remote add origin https://github.com/YOUR-NAME/southampton-routeloop-city.git
git push -u origin main
```

## Step 3: Deploy on Railway

1. Go to https://railway.com and click **New Project**, then **Deploy from GitHub repo**.
2. If the repository isn't in the list, click **Configure GitHub App** and give Railway access to `southampton-routeloop-city`.
3. Pick the repository. Railway starts building straight away.
   - The build log should show it using the **Dockerfile**.
   - Near the end you should see a line from `caddy validate` saying the configuration is valid.
4. Open the service, then **Variables**. Add `PORT` with the value `8080`.
   - This isn't strictly needed, because Railway sets a port itself.
   - Fixing it at 8080 means the domain in the next step always points at the right port.
5. Open **Settings**, then **Networking**, then **Generate Domain**. If it asks for a port, enter `8080`.
6. Wait for the deployment to show **Active**, then open the domain. You should see the welcome screen: "Southampton awaits."

## Step 4: Check it works (five minutes)

Replace `YOUR-DOMAIN` with the address from step 3.

| Open | You should see |
|---|---|
| `https://YOUR-DOMAIN/` | The welcome screen |
| `https://YOUR-DOMAIN/?demo=1` | A **Demo panel** button at the top right. Use its Tap simulator on the Bargate: you get "Stamp earned at Bargate". |
| `https://YOUR-DOMAIN/t/k7Qx2` | The Bargate in browse mode: "You're browsing. Tap the Loop here to collect a stamp." |
| `https://YOUR-DOMAIN/admin/` | The demo admin |
| `https://YOUR-DOMAIN/?demo=1&date=2026-12-05` | The Snow Windows Trail on the home screen |
| `https://YOUR-DOMAIN/?reset=1&demo=1` | A clean start for the next person |

**Offline check on a phone:**

1. Open the site once on mobile data.
2. Turn on flight mode.
3. Reload. The app should still open, with an offline banner.

The demo panel and chip simulator only appear with `?demo=1`. Real tags would carry secured URLs like `https://YOUR-DOMAIN/t/k7Qx2?e=...&c=...`. In this demo those are made by the Tap simulator.

## Updating the demo later

1. Change what you need. Content is in `site/data` and `site/strings`.
2. Send it to GitHub the same way as before: double-click `publish-to-github.bat` again, or **Commit** then **Push** in GitHub Desktop.
3. Railway sees the push and redeploys by itself, usually within two minutes. Watch it on the **Deployments** tab.

Visitors with the app open see **Update ready** and choose when to refresh. Nobody is reloaded in the middle of a walk.

## If something goes wrong

| What you see | What to do |
|---|---|
| The build log says Railpack or Nixpacks instead of Dockerfile | Check that `Dockerfile` (capital D) and `railway.json` are at the top of the repository, not inside a subfolder. |
| "Application failed to respond" | In **Variables**, make sure `PORT` is `8080`. In **Settings**, then **Networking**, make sure the domain's port is also `8080`. Then redeploy. |
| The deploy fails at the health check | Open **Deploy Logs**. Caddy prints the reason on the first lines. |
| A phone still shows the old version | Close the tab and open it again, or use `?reset=1`. The service worker keeps the last version for offline use until the new one is accepted. |
| The build fails pulling `caddy` or `node` images | That's a temporary Docker Hub limit. Click **Redeploy** a few minutes later. |
| `publish-to-github.bat` sends to the wrong GitHub address | The helper prints the address before sending. To change it, open a terminal in the folder and run `git remote set-url origin` followed by the right URL. In GitHub Desktop, use **Repository**, then **Repository settings**. |

## Custom domain (optional)

1. In Railway: **Settings**, then **Networking**, then **Custom Domain**. Enter something like `routeloop.example.co.uk`.
2. Railway shows a CNAME target. Add that CNAME record at your DNS provider.
3. When it goes green, the site is live on your domain with HTTPS. Tag URLs should then use this domain.

## Running it on your own computer

You need either Docker Desktop or Node.

**With Docker Desktop**, this is the same image Railway runs:

```bash
docker build -t routeloop-city .
docker run --rm -p 8080:8080 routeloop-city
```

Then open http://localhost:8080.

**Without Docker**, if Node 20 or later is installed:

```bash
npm start
```

Then open http://localhost:8080/?demo=1.
