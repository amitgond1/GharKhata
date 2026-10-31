# GharKhata — Hindi / Hinglish guide

**Ghar banane ka har kharcha, ek jagah.** GharKhata mein ghar ke construction ya renovation ke bills, payments, suppliers, labour, materials aur progress ko ek jagah manage kar sakte hain.

[English README](README.md) · [Documentation](docs/README.md) · [Render deployment](docs/DEPLOYMENT.md#render-with-mongodb-atlas)

## App mein kya milta hai

- Project ka planned budget, recorded cost, paid amount aur outstanding hisaab.
- Bills, partial payments, supplier advances, credit notes aur refunds.
- Vendors/contractors, agreements, workers, attendance aur wage approval.
- Material stock, site photos, progress diary, tasks aur reminders.
- Project team permissions, private attachments, audit history aur CSV/PDF reports.
- Mobile layout, Hindi/English core labels, dark mode aur installable PWA.

App paisa transfer nahi karti. Payment entry aapke kiye gaye payment ka record hai. Kuch explanatory text abhi English mein hai. Offline shell aur device-local expense drafts available hain; full offline ledger aur automatic sync abhi nahi hain.

## Windows par local setup

Node.js **22.12+**, npm aur MongoDB **8+ replica set** chahiye. Atlas bhi use kar sakte hain.

```powershell
git clone https://github.com/amitgond1/GharKhata.git
cd GharKhata
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run db:start
```

Agar `.env` pehle se hai, uski settings preserve karein. MongoDB wala terminal khula rakhein. Doosre terminal mein:

```powershell
cd GharKhata
npm.cmd run dev
```

App kholein: **http://127.0.0.1:5173**. API **http://127.0.0.1:4000** par chalti hai. Dono ke liye `127.0.0.1` use karein. Account banakar apna project shuru karein, ya **Explore the live demo** se fictional data dekhein.

macOS/Linux par `npm.cmd` ki jagah `npm` aur copy ke liye `cp .env.example .env` use karein. MongoDB helper ko Unix par PATH mein `mongod` chahiye; Windows par default executable `C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe` hai. Alag installation ke liye `MONGOD_PATH` set karein.

## MongoDB Atlas connect karna

1. Apne Atlas cluster par **Connect → Drivers → Node.js** kholein.
2. Database user banayein aur apna current IP Network Access mein allow karein.
3. Connection string root `.env` ke `MONGODB_URI` mein rakhein. Asli username/password bharein aur database name `gharkhata` rakhein. Password ke special characters percent-encode karein.
4. Connection check karein:

```powershell
npm.cmd run check:atlas
```

Check pass hone par `npm.cmd run dev` chalayein. Atlas use karte waqt `db:start` chalane ki zaroorat nahi hai. App successful connection par apni collections initialize karti hai; iske liye database user ke paas zaroori permissions honi chahiye.

Password ya actual connection string README, screenshots ya GitHub par upload na karein. `.env.example` aur `.env.production.example` mein sirf templates hain; real `.env` Git se excluded hai.

## Render par deploy karna

Repository ke root mein [render.yaml](render.yaml) diya hai. Isse frontend aur API ek HTTPS URL par serve honge.

1. Render mein **New → Blueprint** kholein aur is GitHub repository ko connect karein.
2. Real Atlas URI ko `MONGODB_URI` environment variable mein bharein.
3. Render ke outbound IP ranges ko Atlas Network Access mein allow karein.
4. Blueprint ka **paid Starter service aur persistent upload disk** configuration review karke deploy karein.
5. Live URL par account, project, expense, payment, receipt upload aur report verify karein.

Render ka URL allowed origin ke liye automatically use hota hai. Custom domain ke liye exact HTTPS `APP_ORIGIN` set karein, bina trailing slash ke. Reset/invitation emails ke liye SMTP separately configure karein. Puri instructions aur backup/restore steps [deployment guide](docs/DEPLOYMENT.md) mein hain.

## Tests aur current status

Local replica set aur app start karne ke baad:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

31 October 2026 ki local checking mein **35 server tests**, **7 browser workflows** aur production build pass hue. Offline shell, private-cache exclusion aur PDF export bhi verify hue. Latest dependency security audit network timeout ki wajah se verify nahi hua.

Public hosting, real Atlas connection, external email/S3 aur physical Android/iPhone behavior ko apne deployment par verify karna baaki hai. Detailed scope [verification report](docs/VERIFICATION.md) mein hai.

## Aage ke feature ideas

Quick-entry favourites, Excel import, family summaries, complete Hindi walkthroughs, receipt/voice drafts, offline sync aur warranty diary proposed ideas hain. Inhe working features na samjhein. Priority aur user-pilot plan [app review](docs/APP_REVIEW.md) mein diya hai.
