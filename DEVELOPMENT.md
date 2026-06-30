# Developing & Debugging the `makebit` Extension

A maintainer's guide to this MakeCode/PXT micro:bit extension: what was broken,
how it was fixed, and how to develop and debug it with a fast local loop.

Tested on macOS (Apple Silicon), Node v22, micro:bit **V2**.

---

## TL;DR

| | |
|---|---|
| **Symptom** | After adding the extension, MakeCode could no longer download to a micro:bit V2. Error: `Cannot read properties of undefined (reading 'toString')`. |
| **Root cause** | The `cbit_IR` dependency shipped **C++ source** written for micro:bit **V1**. It forced a native (CODAL) build that fails to compile on V2 → no `.hex` is produced → the editor crashes reading the missing result. |
| **Fix** | Remove `cbit_IR` (it was never even used by the code). Keep `neopixel`, restore `TM1650`. Tidy the manifest. |
| **Result** | The extension compiles a **universal hex for both V1 and V2**, so every block (motors, servos, RGB, IR, flame, ultrasonic, 4‑digit display) works again. |
| **Dev loop** | `pxt build` → `pxt deploy`, with serial logs in the MakeCode console. No more push → re-add → bump round‑trip. |

---

## Part 1 — Why the download broke

### The misleading error
`Cannot read properties of undefined (reading 'toString')` is thrown **inside the
MakeCode editor (in the browser), not on the micro:bit**. It does not mean your
TypeScript is wrong. It means:

> The compiler failed to produce a `.hex` file, and the editor's download code
> then tried to read that (missing) result and crashed.

So it is a generic "the build failed" symptom. The real question is always:
*why didn't a `.hex` get built?*

### The actual culprit: C++ in a dependency
The old `pxt.json` declared four dependencies:

```jsonc
"neopixel": "github:microsoft/pxt-neopixel#v0.7.3",  // used (RGB)
"cbit_IR":  "github:zhuning239/cBit_IR",             // NOT used – ships C++
"TM1650":   "github:zhuning239/TM1650"               // used (4-digit display)
```

`cbit_IR`'s file list contained **native source**:
`ir.cpp`, `ReceiverIR.cpp/.h`, `TransmitterIR.cpp/.h`, `RemoteIR.h`, plus
`shims.d.ts` / `enums.d.ts`.

Why that breaks V2:

1. Any extension containing `.cpp`/`.h` forces MakeCode off its fast
   precompiled path and into a **full native CODAL build**.
2. That IR C++ was written for micro:bit **V1** (nRF51 / old DAL runtime).
3. On micro:bit **V2** (nRF52 / CODAL) the old native code does not compile.
4. Failed native build → **no `.hex`** → `toString` crash on download.

The kicker: **`main.ts` never references `cbit_IR` at all** — the obstacle-sensor
`IR()` function is plain TypeScript using `pins.digitalReadPin`. The breaking
dependency was pure dead weight.

`neopixel#v0.7.3` was a red herring — it is V2-compatible and is what MakeCode
pins by default. `TM1650` is pure TypeScript (I²C only), so it was never the
problem either.

---

## Part 2 — The fix (`pxt.json`)

```jsonc
{
    "name": "makebit",
    "version": "3.0.1",                // valid semver (was "3.0"); bump forces a re-fetch
    "supportedTargets": ["microbit"],  // tell the editor it targets micro:bit
    "dependencies": {
        "core": "*",
        "neopixel": "github:microsoft/pxt-neopixel#v0.7.3",  // RGB strip (used)
        "TM1650": "github:zhuning239/TM1650",                // 4-digit display (used)
        "microphone": "*"              // auto-added by `pxt install`; harmless V2 core pkg
    }
    // ... files / testFiles / public unchanged
}
```

What changed and why:

- **Removed `cbit_IR`** — the V1-only C++ that broke the V2 build. *This is the fix.*
- **Removed, then restored `TM1650`** — it provides the clb (4‑digit
  display) blocks. It is pure TypeScript, so it does not reintroduce the failure.
  (Later vendored into `tm1650.ts` and translated, removing the external dependency.)
- **`"3.0"` → `"3.0.1"`** — `"3.0"` is not valid semver. The bump also forces
  MakeCode to re-fetch instead of serving a cached (broken) copy.
- **Added `"supportedTargets": ["microbit"]`** — marks the extension compatible.
- **`"microphone": "*"`** — added automatically by `pxt install` (a micro:bit V2
  core package). Harmless; local builds re-add it if removed.

### Making it take effect in the web editor
The editor pulls extensions from GitHub, so after pushing changes:

1. Commit, push, and (ideally) tag a release, e.g. `v3.0.1`.
2. In your project, **remove and re‑add** the `makebit` extension (or start a
   fresh project) so it fetches the updated `pxt.json`. Cached copies of the old
   version will still fail.

---

## Part 3 — The fast local dev loop

The painful loop is: *edit → push to GitHub → remove/re‑add the extension →
bump version → recompile → flash*. Skip all of that by building the repo
**locally** with the `pxt` CLI.

### One-time setup
```bash
# Prerequisites: Node + npm (this repo was set up with Node v22 / npm 11)
npm install -g pxt              # installs the `pxt` CLI (here: ~/.npm-global/bin/pxt)

cd microbit-car
pxt target microbit            # downloads the micro:bit target into ./node_modules (~minutes)
pxt install                    # fetches GitHub deps (neopixel) into ./pxt_modules
```

Installed here: target `pxt-microbit v8.1.28`, `pxt-core v12.3.24`.
No `arm-none-eabi-gcc` is required **because the extension is now pure TypeScript**
(that toolchain is only needed when an extension ships C++ — exactly what we removed).

### The inner loop
```bash
pxt build      # compile + type-check in seconds. Fast feedback, no browser, no hardware.
pxt deploy     # build, then flash the connected micro:bit
```

A successful `pxt build` writes to `built/`:

| File | Meaning |
|---|---|
| `built/binary.hex` | **Universal hex** (~1.3 MB) — runs on V1 **and** V2 |
| `built/mbcodal-binary.hex` | micro:bit **V2** (CODAL) build (~960 KB) |
| `built/mbdal-binary.hex` | micro:bit **V1** (DAL) build (~690 KB) |

Seeing `mbcodal-binary.hex` build is the proof the V2 download bug is gone.

### Repo hygiene
All build output is git-ignored (see `.gitignore`): `built/`, `node_modules/`
(~540 MB), `pxt_modules/`, and the tooling `package.json` / `package-lock.json`
that `pxt target` drops in. The tracked extension is still just `pxt.json`,
`main.ts`, `test.ts`, `README.md`.

---

## Part 4 — The test harness (`test.ts`)

`test.ts` is listed under `"testFiles"` in `pxt.json`. That means:

- It **is** compiled when you open/build this repo **as a project** (what `pxt build`
  does, and what the editor does when you open the repo directly).
- It **is ignored** when someone consumes `makebit` **as a dependency** in their
  own project.

So `test.ts` is the perfect place for a runnable demo / hardware bring-up. The
current one:

- **on start:** opens USB serial, enables the TM1650 display, inits the RGB strip,
  shows red as a "ready" cue.
- **forever:** counts on the 4‑digit display + serial, rotating the RGB color each
  tick — an "is it alive?" indicator that needs no motors.
- **Button A:** sweeps both drive motors full‑reverse → full‑forward, logging each
  speed (put the wheels off the ground first). Gating motors behind a button keeps
  the car from bolting off the bench.

It exercises display + RGB + motors with serial logging, so you can see exactly
what reaches each chip.

---

## Part 5 — Debugging with serial

The MakeCode **simulator cannot drive this hardware** (it has no model for the
PCA9685 motor driver or the TM1650 display). On-device **serial logging** is the
practical debugger. In code:

```ts
serial.redirectToUSB()              // micro:bit serial → USB (test.ts already does this)
serial.writeValue("counter", n)     // name:value  → graphs nicely in the editor console
serial.writeLine("A: motor sweep")  // free text
```

### Where to read it
**Recommended — the MakeCode editor console (zero install, live graphs):**
1. In the editor, **Connect / Pair device** (WebUSB).
2. **"⋯" menu → Show console Device.**
3. `writeValue` pairs render as live graphs + numbers. Ideal for sensor values.

**Terminal alternative (no install):** the board appears as a USB serial device
at **115200 baud**:
```bash
ls /dev/cu.usbmodem*                       # find the device (e.g. /dev/cu.usbmodem145202)
screen /dev/cu.usbmodem145202 115200       # quit: Ctrl-A, then K, then y
# or, nicer:  brew install tio && tio /dev/cu.usbmodem145202
```

### Why not `pxt console`?
On macOS, `pxt console` needs an optional native `serialport` addon that this
target install does not wire up (`pxt npminstallnative` reconciles npm without
actually adding it). Don't fight it — use the editor console or `screen`.

---

## Part 6 — Day-to-day cheat sheet

```bash
# edit main.ts / test.ts, then:
pxt build                                  # fast compile + type check
pxt deploy                                 # flash the connected board
screen /dev/cu.usbmodem*  115200           # watch serial   (or use the editor console)

# when ready to publish to extension users:
git add -A && git commit -m "..."          # commit
git push                                    # push
git tag v3.0.2 && git push --tags          # tag a release; bump the version in pxt.json too
```

Two equally valid workflows:

- **Local CLI (above):** fastest inner loop; great for compile errors and quick flashes.
- **In-editor GitHub authoring:** open `https://makecode.microbit.org/#github:<you>/microbit-car`,
  edit + test in the browser, then commit/bump from the editor's GitHub panel.
  Use this when you want the GUI and built-in version bumping.

---

## Part 7 — Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Cannot read properties of undefined (reading 'toString')` on download | A dependency fails to compile (often C++ on V2) → no hex | Remove/replace the offending dependency; rebuild. |
| A block disappeared after editing deps | You removed the extension that defined it | Re-add it in `pxt.json` (e.g. `TM1650` provides the 4‑digit display blocks). |
| Updated extension but the editor still shows the old one | Cached version | Bump `version` in `pxt.json`; remove + re-add the extension. |
| Display/motors dead but program runs | Peripheral power off (these share a battery-fed rail), or wrong I²C wiring | Turn on the battery pack; check SDA=P20 / SCL=P19. |
| `pxt console`: "console support not installed" | Native serial addon missing on macOS | Use the editor console or `screen … 115200`. |
| `pxt build` wants `arm-none-eabi-gcc` | An extension reintroduced C++ | Keep the extension pure TypeScript, or install the ARM toolchain. |

---

## Appendix — files in this repo

| File | Role |
|---|---|
| `pxt.json` | Extension manifest: name, version, dependencies, target. **The fix lives here.** |
| `main.ts` | The extension itself (`makerobo` namespace): motors, servos, RGB, IR, flame, ultrasonic. |
| `tm1650.ts` | 4-digit display driver (`TM1650` namespace). Vendored from zhuning239/TM1650 (MIT), translated to English. |
| `test.ts` | Local demo / bring-up harness. Compiled as a project, ignored as a dependency. |
| `README.md` | Shown to extension users in the editor. |
| `Makefile` | Thin wrappers: `make build` / `make deploy` / `make test`. |
| `.gitignore` | Excludes local build output and `pxt` tooling. |
