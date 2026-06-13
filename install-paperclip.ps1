# -------------------------------------------------------------------------
# 1️⃣  Ensure we are in the workspace root
# -------------------------------------------------------------------------
Set-Location "C:\Users\Jad_K\Documents\workspaces\paperclip"

# -------------------------------------------------------------------------
# 2️⃣  Build everything fresh (server, UI, CLI)
# -------------------------------------------------------------------------
Write-Host "🚧 Building all packages (this may take a minute)…"
pnpm build

# -------------------------------------------------------------------------
# 3️⃣  Package the server & CLI tarballs (same version, no bump needed)
# -------------------------------------------------------------------------
Write-Host "📦 Packing server tarball..."
node scripts/pack-server.mjs        # → server/paperclipai-server-0.3.1-jk.1.tgz

Write-Host "📦 Packing CLI tarball..."
pnpm run build:npm                # → builds cli/dist/index.js
Set-Location "C:\Users\Jad_K\Documents\workspaces\paperclip\cli"
npm pack                          # → actually creates the .tgz file!
node -e "import fs from 'fs'; fs.renameSync('package.dev.json', 'package.json')" # restore package.json
Set-Location "C:\Users\Jad_K\Documents\workspaces\paperclip"

# -------------------------------------------------------------------------
# 4️⃣  **COMPLETELY DELETE** the global Paperclip installation
# -------------------------------------------------------------------------
Write-Host "🧹 Removing existing global Paperclip folder…"
Remove-Item -Recurse -Force "$env:APPDATA\npm\node_modules\paperclipai"

# Give the filesystem a moment to finish the delete (especially on Windows)
Start-Sleep -Seconds 2

# -------------------------------------------------------------------------
# 5️⃣  Clean the npm cache (optional but ensures no stale tarball entries)
# -------------------------------------------------------------------------
Write-Host "🧹 Cleaning npm cache…"
npm cache clean --force

# -------------------------------------------------------------------------
# 6️⃣  Install the freshly‑built tarballs globally
# -------------------------------------------------------------------------
Write-Host "🚀 Installing new global packages…"
$packages = @(
    "C:\Users\Jad_K\Documents\workspaces\paperclip\server\paperclipai-server-0.3.1-jk.1.tgz",
    "C:\Users\Jad_K\Documents\workspaces\paperclip\cli\paperclipai-0.3.1-jk.1.tgz"
)
npm install -g $packages

# -------------------------------------------------------------------------
# 7️⃣  Verify that the DEBUG line is present in the compiled CLI
# -------------------------------------------------------------------------
Write-Host "🔍 Verifying compiled CLI contains the debug log…"
$debugPath = "$env:APPDATA\npm\node_modules\paperclipai\dist\checks\secrets-check.js"
if (Test-Path $debugPath) {
    $found = Select-String -Path $debugPath -Pattern "\[DEBUG\] process\.platform"
    if ($found) {
        Write-Host "✅ DEBUG line found in $debugPath"
    } else {
        Write-Host "⚠️ DEBUG line NOT found – something went wrong with the build"
    }
} else {
    Write-Host "❌ Compiled file not found at $debugPath"
}

# -------------------------------------------------------------------------
# 8️⃣  Run the doctor command to see the platform debug output
# -------------------------------------------------------------------------
Write-Host "🩺 Running paperclipai doctor (should show platform logs)…"
paperclipai doctor
