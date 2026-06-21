# Release process

How to cut a PitchPrompter AI release.

## v0.1 — Private tester portable ZIP

### 1. Validate

```powershell
npm run typecheck
npm run build
cd src-tauri ; cargo check ; cd ..
```

All three must be green. No warnings expected.

### 2. Build the release EXE

```powershell
npm run tauri:build
```

First run: ~8–10 minutes (cold Rust cache). Incremental: ~40 s.

Output:

```
src-tauri\target\release\PitchPrompter AI.exe   (~8 MB, unsigned)
```

Smoke-test it: double-click, verify the main window opens, click around,
close. No crash, no console window in release mode.

### 3. Assemble the tester folder

```powershell
$root = (Resolve-Path .).Path
$rel  = "$root\release\pitchprompter-ai-v0.1-private-test"
Remove-Item "$root\release" -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $rel | Out-Null

Copy-Item "$root\src-tauri\target\release\PitchPrompter AI.exe" $rel

# These five docs are authored under release/.../ — copy from source of truth:
Copy-Item "$root\release-templates\README.txt"            $rel
Copy-Item "$root\release-templates\TESTING.md"            $rel
Copy-Item "$root\release-templates\KNOWN_LIMITATIONS.md"  $rel
Copy-Item "$root\release-templates\FEEDBACK_TEMPLATE.md"  $rel
Copy-Item "$root\release-templates\CHANGELOG.md"          $rel
```

> For v0.1 the templates were authored directly in `release/.../` rather
> than `release-templates/`. v0.2 should move them to `release-templates/`
> so the build script becomes deterministic. Tracked in `ROADMAP.md`.

### 4. Zip it

```powershell
Compress-Archive `
  -Path "$rel\*" `
  -DestinationPath "$root\release\PitchPrompter-AI-v0.1-private-test-windows-x64.zip" `
  -Force
```

### 5. Verify

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::OpenRead(
  "$root\release\PitchPrompter-AI-v0.1-private-test-windows-x64.zip"
).Entries | Select-Object Name,Length
```

Expected contents (exactly 6 files):

- `PitchPrompter AI.exe`
- `README.txt`
- `TESTING.md`
- `KNOWN_LIMITATIONS.md`
- `FEEDBACK_TEMPLATE.md`
- `CHANGELOG.md`

### 6. Publish

For private testers, recommended hosts (in order):

1. **GitHub Release** (private repo or pre-release flag) — versioned URL,
   simple to revoke. Replace `[DOWNLOAD_ZIP_URL]` in `site/index.html`.
2. **Cloudflare R2** — flat S3-style storage, signed URLs work great for
   private distribution.
3. **OneDrive / Dropbox shared link** — fast, but URL leakage = public
   access.

Avoid email attachments — many corporate scanners block unsigned EXEs.

---

## v0.2 — MSI / NSIS installer

### Pre-stage bundler tooling (offline-friendly)

Tauri's bundler downloads tooling on first run from GitHub. If your build
host can't reach GitHub (corp network, CI sandbox), pre-stage:

```powershell
# WiX 3.14 (for MSI)
$wix = "$env:LOCALAPPDATA\tauri\WixTools314"
New-Item -ItemType Directory -Force -Path $wix | Out-Null
curl.exe -fsSLo "$env:TEMP\wix314.zip" `
  "https://github.com/wixtoolset/wix3/releases/download/wix3141rtm/wix314-binaries.zip"
Expand-Archive -Path "$env:TEMP\wix314.zip" -DestinationPath $wix -Force

# NSIS 3.08 + nsis_tauri_utils plugin (for NSIS)
$nsis = "$env:LOCALAPPDATA\tauri\NSIS"
New-Item -ItemType Directory -Force -Path "$nsis\Plugins\x86-unicode" | Out-Null
curl.exe -fsSLo "$env:TEMP\nsis-3.zip" `
  "https://github.com/tauri-apps/binary-releases/releases/download/nsis-3/nsis-3.zip"
Expand-Archive -Path "$env:TEMP\nsis-3.zip" -DestinationPath $nsis -Force
Move-Item "$nsis\nsis-3.08\*" $nsis -Force ; Remove-Item "$nsis\nsis-3.08" -Recurse
curl.exe -fsSLo "$nsis\Plugins\x86-unicode\nsis_tauri_utils.dll" `
  "https://github.com/tauri-apps/nsis-tauri-utils/releases/download/nsis_tauri_utils-v0.4.2/nsis_tauri_utils.dll"
```

### Build installers

```powershell
npm run tauri:build -- --bundles msi nsis
```

Outputs under `src-tauri\target\release\bundle\`.

---

## Signing (v0.2+)

### Why

Removes the Windows SmartScreen "Unknown publisher" warning. Required for
practically any distribution beyond a tight circle.

### What

Use an EV (Extended Validation) code-signing certificate from a CA (e.g.
DigiCert, Sectigo, GlobalSign). EV certs build reputation faster than
standard certs.

### How

```powershell
# Sign the EXE
signtool sign `
  /fd SHA256 `
  /tr http://timestamp.digicert.com `
  /td SHA256 `
  /f mycert.pfx `
  /p $env:CERT_PASS `
  "src-tauri\target\release\PitchPrompter AI.exe"

# Sign the MSI / NSIS installer too
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 `
  /f mycert.pfx /p $env:CERT_PASS `
  "src-tauri\target\release\bundle\msi\PitchPrompter AI_0.1.0_x64_en-US.msi"
```

Tauri 1.6 also supports inline signing via `tauri.conf.json`
`tauri.bundle.windows.certificateThumbprint` — use that once the cert
is installed in the local cert store.

### SmartScreen reputation

Even with a valid EV cert, SmartScreen builds reputation over downloads.
Expect the warning to persist for the first few hundred installs and then
disappear.

---

## Versioning

- `package.json` → `version`
- `src-tauri/Cargo.toml` → `[package] version`
- `src-tauri/tauri.conf.json` → `package.version`
- `release/...-vX.Y-...` folder name
- `release/...-vX.Y-...-windows-x64.zip` file name
- `CHANGELOG.md` entry

A single `npm run bump <version>` script is a v0.2 polish item.

---

## Checklist before sending to testers

- [ ] All three validations green
- [ ] Release EXE smoke-launched locally
- [ ] ZIP contents are exactly the six expected files
- [ ] `CHANGELOG.md` mentions any behavior change
- [ ] `KNOWN_LIMITATIONS.md` is current
- [ ] Landing page `[DOWNLOAD_ZIP_URL]` and `[FEEDBACK_FORM_URL]` filled in
- [ ] No `.env`, `.pfx`, or stray cert files in the repo
- [ ] Tester contact channel monitored
