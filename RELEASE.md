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

### What's confirmed working (this machine, 2026-06-21)

NSIS installer **builds successfully** after pre-staging tooling. WiX/MSI
still needs validation but the same pre-stage pattern is expected to work.

**Confirmed artifact:**
```
src-tauri\target\release\bundle\nsis\PitchPrompter AI_0.1.0_arm64-setup.exe
   2.26 MB
   SHA256: ed3f2f990fbb6884a47f4b3bf0ca5f73b6862b9379f9e6de65cee48b0fe6ecea
```

Note the `arm64` suffix — this dev machine is ARM64. To produce x64
installers from an ARM64 host, cross-compile with
`rustup target add x86_64-pc-windows-msvc` and pass
`--target x86_64-pc-windows-msvc` to `tauri build`.

### Why pre-staging is required

The Tauri 1.x bundler downloads NSIS + WiX + `nsis_tauri_utils.dll` on
first run via its own HTTP client. That client requires a linked TLS
backend at compile time. In some sandboxed / minimal Rust toolchains, the
default `tauri-cli` binary is built without one and you get:

```
Unknown Scheme: cannot make HTTPS request because no TLS backend is configured
```

Pre-staging the binaries into `%LOCALAPPDATA%\tauri\NSIS` (and
`%LOCALAPPDATA%\tauri\WixTools314`) sidesteps this completely — the
bundler verifies them by hash and skips the download.

### Pre-stage bundler tooling (offline-friendly) — confirmed procedure

```powershell
# NSIS 3.08 — extract so contents sit at the root of $nsis, not inside nsis-3.08\
$nsis = "$env:LOCALAPPDATA\tauri\NSIS"
New-Item -ItemType Directory -Force -Path "$nsis\Plugins\x86-unicode" | Out-Null
$staging = "$env:TEMP\nsis-stage"
Remove-Item -Recurse -Force $staging -ErrorAction SilentlyContinue
Invoke-WebRequest -OutFile "$env:TEMP\nsis-3.zip" `
  "https://github.com/tauri-apps/binary-releases/releases/download/nsis-3/nsis-3.zip"
Expand-Archive -Path "$env:TEMP\nsis-3.zip" -DestinationPath $staging -Force
Get-ChildItem (Join-Path $staging "nsis-3.08") | Copy-Item -Destination $nsis -Recurse -Force

# nsis_tauri_utils plugin — Tauri 1.8 pins v0.4.1 (SHA-verified).
# If your Tauri version asks for a different one, the error log shows the URL.
Invoke-WebRequest -OutFile "$nsis\Plugins\x86-unicode\nsis_tauri_utils.dll" `
  "https://github.com/tauri-apps/nsis-tauri-utils/releases/download/nsis_tauri_utils-v0.4.1/nsis_tauri_utils.dll"

# WiX 3.14 (for MSI) — same shape
$wix = "$env:LOCALAPPDATA\tauri\WixTools314"
New-Item -ItemType Directory -Force -Path $wix | Out-Null
Invoke-WebRequest -OutFile "$env:TEMP\wix314.zip" `
  "https://github.com/wixtoolset/wix3/releases/download/wix3141rtm/wix314-binaries.zip"
Expand-Archive -Path "$env:TEMP\wix314.zip" -DestinationPath $wix -Force
```

**Gotchas observed:**
- The NSIS ZIP has a `nsis-3.08\` top-level folder; Tauri wants those
  files at the **root** of `$nsis`. A naive `Expand-Archive` will leave
  them nested and Tauri will report "NSIS directory is missing some
  files. Recreating it." and try to re-download.
- The `nsis_tauri_utils.dll` version is **SHA-pinned per Tauri release**.
  If the bundler logs "NSIS directory contains mis-hashed files,
  Redownloading them" it will print the exact URL it wants — match that
  version exactly.

### Build installers

```powershell
npm run tauri:build -- --bundles nsis        # NSIS only (confirmed working)
npm run tauri:build -- --bundles msi         # MSI only (needs WiX pre-stage)
npm run tauri:build -- --bundles msi nsis    # both
```

Outputs under `src-tauri\target\release\bundle\`.

---

## Signing (v0.2+)

### Investigation summary (2026-06-21)

| Question | Finding |
|---|---|
| What certificate is required? | A **code-signing certificate** issued by a CA Microsoft trusts. EV (Extended Validation) or OV (Organization Validation). OV is roughly ~$100/year; EV ~$300+/year and requires a hardware token. |
| Is self-signing useful for private testers? | **No.** A self-signed cert satisfies `signtool` but Windows still shows SmartScreen "Unknown publisher" because the cert chain doesn't reach a trusted root. Tester sees identical UX to unsigned. The only benefit is that you can practice the signing pipeline before buying a real cert. We do **not** ship a self-signed binary. |
| Is a real CA cert required for SmartScreen trust? | **Yes.** SmartScreen requires a valid chain to a trusted root. With a standard (non-EV) cert, the warning persists until your *publisher identity* has accumulated download reputation — usually a few hundred installs over weeks. With an EV cert, reputation transfers to the cert immediately, so the warning disappears almost on first install. |
| Can we sign without buying? | Not in a way that helps testers. Microsoft's free signing programs (Trusted Signing / formerly Azure Code Signing) cost ~$10/month + require a Microsoft Partner Network ID, which still costs money. |
| What about Windows SDK's `MakeCert`? | Generates a self-signed cert — same limitation as above. |

**Recommendation for v0.1 → v0.2 transition:**

1. **v0.1 (now):** ship unsigned portable ZIP. Honest SmartScreen warning. Acceptable for 3–5 trusted testers.
2. **v0.2 dev cycle:** purchase an **OV** code-signing cert (~$100/yr from Sectigo or SSL.com — these are the budget reputable issuers). Build NSIS installer + sign it. Acceptable SmartScreen warning that will fade with downloads.
3. **v1:** upgrade to **EV** cert if first-install reputation matters (most likely yes for a "speak on camera before an interview" use case).

**Do not:**
- Buy from random resellers offering "$10 EV certs". They are either fraudulent or revoked within weeks.
- Sign with a self-signed cert and ship it as if it were signed.
- Use someone else's cert under any circumstance.

### How (once a real cert is available)

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
  "src-tauri\target\release\bundle\nsis\PitchPrompter AI_0.2.0_x64-setup.exe"
```

Tauri 1.8 also supports inline signing via `tauri.conf.json`
`tauri.bundle.windows.certificateThumbprint` — use that once the cert
is installed in the local cert store.

### SmartScreen reputation

Even with a valid OV cert, SmartScreen builds reputation over downloads.
Expect the warning to persist for the first few hundred installs and then
disappear. EV certs short-circuit this.

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
