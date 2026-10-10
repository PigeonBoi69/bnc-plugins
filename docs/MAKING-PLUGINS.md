# Making a plugin

BNC Ambient has two kinds of plugin. Each is a single file:

| Kind | File ending | What it does | Made of |
| --- | --- | --- | --- |
| **Visualizer** | `.bncvis` | Adds a new animated visualizer style | A text file: a JSON header plus JavaScript |
| **App style** | `.bnctheme` | Adds a color choice (colors **and** app icon), for one BNC app or several | A zip file: `data.json` plus an icon folder per app |

To install and test what you make, see `INSTALLING-PLUGINS.md`. Working examples are in the shared `Plugins` folder (`Upcoming Apps\Plugins`; an installed app has them in its `sample-plugins` folder).

---

# Part 1: Visualizer plugins (`.bncvis`)

A visualizer plugin is one plain-text file ending in **`.bncvis`**. Write it in Notepad or any code editor. (Older files ending in `.bncplugin` still work; the app calls them visualizers too.)

Read the two examples first: `sparkles.bncvis` and `dot-grid.bncvis`. Each is about 40 lines.

## The file format

A `.bncvis` file has two parts:

1. A **header**: a JSON object inside a `/* @bnc-plugin ... */` comment. It must be the very first thing in the file.
2. **JavaScript** that calls `register({ ... })`.

```js
/* @bnc-plugin
{
  "id": "yourname.my-visualizer",
  "name": "My Visualizer",
  "version": "1.0.0",
  "author": "Your Name",
  "type": "visualizer",
  "apiVersion": 1,
  "description": "One sentence about what it looks like."
}
*/

register({
  draw(ctx, f) {
    // draw one frame here
  },
});
```

### Header fields

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Unique and permanent. Letters, numbers, `.`, `-`, `_`, up to 64 characters. Use `yourname.pluginname`. Installing a file with the same `id` replaces the old one. Visualizers and app styles share the same ids, so don't reuse one. |
| `name` | yes | What people see in the Style list (up to 60 characters). |
| `version` | no | Text such as `1.2.0`. Shown in the plugin list. |
| `author` | no | Shown in the plugin list. |
| `description` | no | Up to 300 characters. |
| `type` | no | `"visualizer"` (the default for `.bncvis`). |
| `apiVersion` | no | The plugin API you wrote for. It is `1` today. Newer apps keep running older plugins; an older app refuses newer ones. |

The file can be at most 512 KB.

## The code

Your code runs once when the plugin loads. Keep any state (particles, positions) in variables at the top. Then call `register` with an object:

```js
register({
  init(api) { },        // optional, runs once after loading
  draw(ctx, f) { },     // required, runs for every frame (about 60 times a second)
});
```

- `ctx` is a normal [`CanvasRenderingContext2D`](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D).
- The canvas is **cleared for you** before each `draw`, and it is transparent, so the blurred album background shows through.
- Your plugin is drawn **behind** the album art and text, and on top of the background.
- Draw in **pixels**. `f.width` and `f.height` are the canvas size in pixels. Use `f.vh` (1% of the height in pixels) so your drawing looks the same on every screen size.
- `api` (in `init`) is `{ canvas, ctx, id }`.

### The frame object `f`

| Property | What it is |
| --- | --- |
| `f.t` | Seconds since the page started. Good for animation. |
| `f.dt` | Seconds since the last frame (about `0.016`). Multiply speeds by this so motion is smooth. |
| `f.width`, `f.height` | Canvas size in pixels. |
| `f.vh` | 1% of `f.height`, in pixels. |
| `f.dpr` | Device pixel ratio (already included in width and height). |
| `f.bands(n)` | **n smoothed levels from 0 to 1**, bass first, treble last (`n` is 1 to 256). The easiest way to react to music. |
| `f.bass`, `f.mid`, `f.treble` | Three smoothed levels from 0 to 1. |
| `f.freq` | Raw spectrum: `Uint8Array(1024)`, values 0-255, bass first. |
| `f.wave` | Raw waveform: `Uint8Array(512)`, values 0-255 with silence at 128. |
| `f.playing` | `true` when audio is coming in (or in the Settings preview). |
| `f.color` | `[r, g, b]` of the colour the user chose (from the album art, or white). |
| `f.colorMode` | `"album"` or `"white"`. |
| `f.rgba(alpha)` | A ready-made colour string, for example `ctx.fillStyle = f.rgba(0.8)`. |
| `f.intensity` | The user's intensity slider, 0.1 to 1. Scale how strong your effects are with it. |
| `f.cover` | Where the album art is: `{ x, y, w, h, cx, cy }` in pixels (`cx`, `cy` is the centre). |
| `f.title`, `f.artist` | The current track name and artist. |

### Good habits

- **Respect `f.intensity` and `f.color`** so your plugin follows the user's settings.
- **Use `f.dt`** for movement: `x += speed * f.dt`.
- **Use `f.vh`** for sizes.
- **Keep it light.** Limit particle counts (a few hundred at most) and avoid creating many new objects each frame.

## What a visualizer can't do

Visualizers run in a **sandbox**:

- no access to files, settings, the clipboard or the rest of the app
- no internet (requests are blocked)
- only the `register` function and the normal browser drawing and maths APIs are available

If `draw` throws an error five frames in a row, the plugin is stopped. A plugin that fails to start, or gets stopped, shows **Problem while running: ...** on its card in the Plugins window (switch it off and on, or reinstall it, to clear the message and try again).

## A complete small example

```js
/* @bnc-plugin
{
  "id": "example.ring",
  "name": "Bass Ring",
  "version": "1.0.0",
  "author": "Example",
  "type": "visualizer",
  "apiVersion": 1,
  "description": "A glowing ring around the album art that swells with the bass."
}
*/

register({
  draw(ctx, f) {
    const radius = f.cover.w * 0.6 + f.bass * f.vh * 10 * f.intensity;
    ctx.lineWidth = f.vh * 0.6;
    ctx.strokeStyle = f.rgba(0.4 + f.bass * 0.6);
    ctx.shadowColor = f.rgba(1);
    ctx.shadowBlur = f.vh * 3;
    ctx.beginPath();
    ctx.arc(f.cover.cx, f.cover.cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  },
});
```

Save it as `ring.bncvis`, then follow `INSTALLING-PLUGINS.md`.

---

# Part 2: App style plugins (`.bnctheme`)

An app style changes an app's **colors** and its **app icon**. In BNC Ambient it recolors the Settings and Plugins windows and swaps the icon (tray icon, window icons, and the Desktop / Start Menu / Startup shortcuts). It shows up in **Settings > App color**.

## One style, several BNC apps (optional)

A style file can carry the look for **more than one BNC app** (BNC Ambient, BNC Docs, and whatever comes later), each with its **own icon**, so one download re-themes your whole set. **It does not have to.** A style can be made for a single app, and an app is free to ignore a style it has nothing for. The rules:

- Every BNC app has an **app id**: BNC Ambient is `bnc-ambient`, BNC Docs is `bnc-docs`.
- A style lists the apps it knows in an `apps` section. Each app reads **only its own entry** and ignores the rest.
- A style that has no entry for an app can still recolor it if the style has **shared colors** (`colors` at the top). It just keeps its own icon.
- A style with **no entry and no shared colors** for an app does nothing in that app. BNC Ambient still lists it in the Plugins window, marked "works with ...", and doesn't offer it as a color.
- A mistake in another app's entry (a missing icon, for example) never breaks the style for the apps that are fine.

## What is inside

A `.bnctheme` file is a **zip file**: `data.json` at the top, and a **folder per app** that holds that app's pictures:

```
my-style.bnctheme
  data.json                  the name, shared colors, and an "apps" section
  bnc-ambient/icon.png       BNC Ambient's app icon
  bnc-docs/icon.png          BNC Docs' app logo
```

Look at `Plugins/red.bnctheme` and the other colors there: each has a BNC Ambient icon (the music note), a BNC Docs logo (the open book) and a BNC Presentation icon (the screen with a bar chart), all in the style's colors. Their unpacked files are in `Plugins/sources/<color>`.

## data.json

```json
{
  "id": "yourname.purple",
  "name": "Purple",
  "version": "1.0.0",
  "author": "Your Name",
  "type": "theme",
  "apiVersion": 1,
  "description": "Purple and dark purple.",
  "colors": {
    "accent": "#a855f7",
    "accentInk": "#1e0a33",
    "swatch": ["#c084fc", "#3b0764"]
  },
  "apps": {
    "bnc-ambient": { "icon": "bnc-ambient/icon.png" },
    "bnc-docs": {
      "icon": "bnc-docs/icon.png",
      "colors": { "accent": "#9333ea" }
    }
  }
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Unique and permanent, same rules as visualizer ids (letters, numbers, `.`, `-`, `_`). The same id is used in every app. |
| `name` | yes | What people see in the color list (up to 60 characters). |
| `colors.accent` | yes, here or in the app's entry | The main color, as `#rrggbb`. Used for buttons, switches, sliders and highlights. |
| `colors.accentInk` | no | The text color used **on top of** the accent (for example on a button). If left out, the app picks near-black for light accents and white for dark ones. |
| `colors.swatch` | no | Two colors, `["#rrggbb", "#rrggbb"]`, for the little circle next to the color list. Defaults to the accent fading to a darker shade. |
| `apps` | no | One entry per app, keyed by app id. See below. |
| `apps.<app id>.icon` | no | The path of that app's icon **inside the zip**, such as `bnc-ambient/icon.png`. Leave it out and the app keeps its own icon. |
| `apps.<app id>.colors` | no | Colors for just this app. They are **laid over** the shared `colors`, so you only list what differs. |
| `icon` | no | An icon used by any app that has no entry of its own (the older, single-app way). A file called `icon.png` at the top is also picked up for this. |
| `version`, `author`, `description` | no | Shown in the plugin list. |
| `type` | no | `"theme"` (the default). |
| `apiVersion` | no | `1`. |

## The icons

- A **PNG image**, **square**, at least **32 x 32**. **256 x 256** or **512 x 512** is ideal.
- A round or rounded-square icon with a transparent background looks best.
- Use the style each app already uses: BNC Ambient's icon is a circle with a music note, BNC Docs' is a rounded square with an open book. Keep the shape and change the colors.
- It becomes the tray icon, the window icons and the shortcut icons, so keep it simple and readable when small.
- Paths use `/` and may contain letters, numbers, dots, dashes, spaces and folders, never `..`.

## Making the .bnctheme file

**Easy way:** put `data.json` and the icon folders in one folder, then run this in PowerShell from the app folder:

```powershell
.\tools\pack-theme.ps1 -Folder .\my-style
```

It checks that `data.json` is valid and that every icon it mentions exists, then creates `my-style.bnctheme` next to the folder. Add `-Out C:\somewhere\name.bnctheme` to choose where it goes.

**By hand:** select **everything inside** the folder (`data.json` and the app folders, not the folder itself), right-click, **Send to > Compressed (zipped) folder**, then rename the `.zip` to `.bnctheme` (turn on *File name extensions* in File Explorer's View menu to see the ending). `data.json` must be at the top of the zip; zipping the whole folder instead also works, since one wrapper folder is accepted.

## Notes

- A style plugin contains **no code**, only colors and pictures, so it can't do anything harmful.
- Shortcut and taskbar icons may keep the old picture for a while because of Windows' icon cache (signing out and in refreshes it).
- If a style is switched off or removed, the app goes back to its normal (cyan) look.
- The file can be at most 5 MB.
- **Older styles still work.** A file with a top-level `icon.png` and `colors` but no `apps` section is read as "one icon for every app".

---

# Part 3: For app developers - supporting styles in another BNC app

Want BNC Docs (or any future BNC app) to read these style files? It takes one small module.

1. Copy **`bnctheme.js`** and **`zip.js`** from the BNC Ambient folder into your app (they are plain Node.js, no packages needed).
2. In the app's main process, read a style file and ask for **your app's id**:

```js
const fs = require('fs');
const { parseTheme } = require('./bnctheme');

const style = parseTheme(fs.readFileSync('red.bnctheme'), 'bnc-docs');  // throws a readable Error if the file is bad

if (style.appliesHere) {
  style.name;        // "Red (sample)"
  style.accent;      // "#ff4d5a"   the main color
  style.accentRgb;   // "255, 77, 90"   handy for rgba(...) in CSS
  style.accentInk;   // "#2a0508"   text color to put on top of the accent
  style.swatch;      // ["#ff4040", "#6e0a16"]   two colors for a preview circle
  style.iconPng;     // Buffer with this app's PNG, or null when the style has no icon for this app
  style.apps;        // ["bnc-ambient", "bnc-docs"]   every app the style knows (for display)
}
```

3. **If `appliesHere` is `false`**, the style has nothing for your app: skip it (BNC Ambient lists it as "not for this app").
4. **Colors**: write them into your CSS variables (BNC Docs uses variables in `src/styles/app.css`), for example `--accent`, `--accent-rgb`, `--accent-ink`.
5. **Icon**: turn `iconPng` into whatever your app needs (for Electron, `nativeImage.createFromBuffer(style.iconPng)` for the window and tray; wrap it in an `.ico` for shortcuts).
6. **Where to keep styles**: each app keeps its own folder of installed styles (BNC Ambient uses `%APPDATA%\bnc-ambient\plugins`). The same `.bnctheme` file can be installed into each app. Use the same plugin ids so the same style means the same thing everywhere.
7. **You don't have to use everything.** Reading only `accent` and ignoring the icon is fine, and so is not supporting styles at all.

New apps: pick a short lowercase **app id** (such as `bnc-console`) and tell style authors, who then add `apps."bnc-console"` entries. Nothing else needs to change.

---

## Sharing a plugin

Just send the file (`.bncvis` or `.bnctheme`). Give it a unique `id`, bump `version` when you change it, and describe it in `description`. A style that includes icons for several apps works in all of them.

## Future plugin types

`type` exists so more kinds of plugin can be added later. Today only `"visualizer"` and `"theme"` are accepted.
