# Muse S Athena brainwaves in Biofeedback Path Cockpit

Brainwaves lets a Muse S Athena drive an experimental visual game without a heart-rate sensor, Hume band or cadence sensor. The optional Python launcher connects to the headband through the existing [Autonomic Telemetry bridge](https://github.com/patrickiben/autonomic-telemetry/tree/main/bridge), including its Athena transport. It serves a local copy of the Body app and relays the bridge's gated EEG features to that page. It does not copy or replace the Muse protocol implementation.

The EEG feedback is a game proxy based on a personal spectral reference. It is **not a validated measure of clarity, calm, focus or mental health**. Eye closure, muscle tension, headband contact and movement can affect the signal even when software gates pass. Use the initial reference with your eyes open and the same posture you intend to keep while playing.

## Install once on your Mac

Use Python 3.10 or newer. Keep both complete repositories beside one another; if Body Signal Labs is already cloned, reuse that checkout:

```sh
git clone https://github.com/patrickiben/body-signal-labs.git
git clone https://github.com/patrickiben/autonomic-telemetry.git
cd body-signal-labs
python3 -m venv .venv-eeg
.venv-eeg/bin/python -m pip install -r ../autonomic-telemetry/bridge/requirements.txt
```

Installing the existing bridge requirements needs internet access. Subsequent local use needs neither an account nor a cloud relay. The built `biofeedback-path-cockpit.html` is included in Body Signal Labs. If working from changed source, rebuild it with `python3 build.py` first.

If your Autonomic checkout is elsewhere, use its absolute path for both the requirements file and `--autonomic-root`. The selected checkout must include `bridge/server.py`, `bridge/features.py` and `bridge/muse.py`; an old static export is insufficient.

## Connect and calibrate

From the Body Signal Labs directory:

```sh
.venv-eeg/bin/python brainwave_bridge.py --open
```

For a checkout in another folder:

```sh
.venv-eeg/bin/python brainwave_bridge.py \
  --autonomic-root /absolute/path/to/autonomic-telemetry --open
```

1. Keep the Terminal window open. The launcher prints a fresh private address and, with `--open`, opens it in your browser. Starting the launcher does not scan or connect to a wearable.
2. Turn on your Muse S Athena and fit its contacts securely. If another app is holding its Bluetooth connection, disconnect it in that app first.
3. In Biofeedback Path Cockpit choose **Ride → Brainwaves**, then **Connect**, scan and select your Muse. Allow Bluetooth for Terminal or the app running Python if macOS asks. You do not need to pair in macOS Bluetooth settings first.
4. Keep your eyes open and sit still for **20 distinct eligible EEG samples** (about 20 seconds) of calibration after eligible EEG starts arriving. Warm-up, stale data and rejected windows do not count toward that reference, so elapsed wall time can be longer.
5. Follow the displayed source and quality labels while playing. Invalid or missing EEG withholds feedback; ambient scenery does not prove a live connection. Recalibrate after changing the fit or posture substantially.

Use Disconnect to release the Muse, then press Control-C in Terminal to stop the bridge. No firmware change, factory reset or sensor history deletion is required.

## Local access and limits

The default address is `127.0.0.1:8765`, available only on this Mac. `--port 8766` selects another port if needed. `--open` is optional: you can copy the printed address yourself. Each run has a new random private path; keep that link private because it grants access to this run's controls and signals.

The app and `/api/state`, `/api/events` and `/api/control` share the same local origin and private path. The launcher retains the upstream request checks, rejects unknown Host headers, and serves only an explicit list of built Body pages and documentation. It exposes no app source, Python files or directory listing, and adds no cross-origin proxy. The relay is in memory; it does not automatically save raw EEG.

The public GitHub Pages app and a directly opened HTML file cannot start Python or use this local Muse connection by themselves. Open the launcher-served address for brainwaves. Other standalone app features continue to work without the launcher.

`--host 0.0.0.0` explicitly permits other devices on your local network to reach the server. Use the Mac's local IPv4 address with the same printed port and private path. This optional transport uses unencrypted HTTP; use a trusted private network and do not expose the port through a router. Mac-only use is the default.

Muse Classic and Athena handling comes from the chosen Autonomic checkout. This launcher does not establish hardware or firmware compatibility; no physical Muse test is claimed by its automated checks. See Autonomic's [device notes](https://github.com/patrickiben/autonomic-telemetry/blob/main/docs/DEVICES.md) for the upstream test scope.

## Troubleshooting and synthetic transport test

- If the checkout is missing, pass the complete repository folder with `--autonomic-root`.
- If Bleak is missing, install that checkout's `bridge/requirements.txt` with the same Python interpreter used to run the launcher. The error prints the command.
- If scanning fails, turn Bluetooth on and allow the Python host app in macOS System Settings → Privacy & Security → Bluetooth. Keep the headband nearby and disconnect competing apps.
- If calibration stalls, inspect the quality message, improve contact and keep your eyes open and still. Receiving packets alone is insufficient; the extractor requires eligible EEG from at least two standard channels and its motion/timing gates.
- If the launcher restarts, open its new private link. An older tab belongs to the previous session.

An explicit simulation checks discovery, transport and source labels without Bluetooth:

```sh
python3 brainwave_bridge.py --simulate --open
```

Select the synthetic Muse after Connect. The unchanged upstream simulator sends a single EEG channel and does **not** satisfy the multi-channel calibration gates. It is a transport check, not a pretend successful calibration or proof of device compatibility. Both the launcher and page label simulated data as synthetic. Use the app's **Try demo** option for a separately labeled preview of brainwave-driven scenery.

Run the automated HTTP checks against your installed bridge checkout:

```sh
AUTONOMIC_ROOT=/absolute/path/to/autonomic-telemetry \
  python3 -m unittest discover -s tests -p test_brainwave_bridge.py -v
```

These checks cover early configuration injection, private paths, allowed files, Host/Origin denial, same-session event delivery and explicit synthetic start. They never scan or connect to physical hardware. Without the optional checkout, HTTP integration checks explicitly skip while standalone launcher checks still run.

All 14 launcher checks passed against Autonomic Telemetry commit `6c3ce294a1623649593f2871b364a9053c719ec0` on November 4, 2026. This is software and synthetic-transport validation, not a physical Athena test.
