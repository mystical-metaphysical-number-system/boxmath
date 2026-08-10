# Running boxmath studio on your Mac

Type each command below into Terminal exactly as written, then press Enter.
If something doesn't match what's described, stop and send a screenshot.

## 1. Install Node

1. Go to **[nodejs.org](https://nodejs.org)**, click the main download
   button, and open the downloaded file.
2. Click through the installer (Continue, Continue, Install) like any other
   Mac app.

Check it worked: open **Terminal** (`Cmd + Space`, type `Terminal`, Enter),
then type:

```
node -v
```

Any version number printed means it worked.

## 2. Get the code

1. On the project's GitHub page (link in Discord), click **`< > Code`**,
   then **Download ZIP**.
2. Double-click the downloaded file in your Downloads folder to unzip it.

## 3. Open the folder in Terminal

In Terminal, type `cd ` (with a space after it), then drag the unzipped
folder from Finder into the Terminal window, then press Enter. This puts
you "inside" the project.

## 4. Install and run

```
npm install
```

Takes a minute, prints a lot of text, then stops. That's normal. Then:

```
npm run dev:studio
```

You'll see a line like:

```
➜  Local:   http://localhost:5173/
```

(If your Mac asks whether to allow incoming connections, click Allow —
that's just your Mac being cautious about your own computer talking to
itself.)

## 5. Open it

Copy the `http://localhost...` address into your browser. Leave both
windows open while you use it — it updates itself automatically.

## 6. When you're done

Click into Terminal and press `Ctrl + C`. Then just close both windows.

## Next time

Open Terminal, `cd ` + drag the folder in again, then just:

```
npm run dev:studio
```

No need to reinstall anything.
