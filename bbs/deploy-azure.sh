#!/usr/bin/env bash
set -euo pipefail

# Minimal, free-tier Azure deployment for the BBS app (Node.js + Azure Table Storage)
# Requirements: az CLI logged in, Bash (WSL ok), zip, jq (optional), Node 18+ locally

# Usage:
#   ./deploy-azure.sh <resource-group> <region> <storage-name> <app-name>
# Example:
#   ./deploy-azure.sh espa-tv-rg eastus espatvstorage espa-tv

if [ $# -lt 4 ]; then
  echo "Usage: $0 <resource-group> <region> <storage-name> <app-name>"
  exit 1
fi

# Preflight: ensure zip is available (required by config-zip)
if ! command -v zip >/dev/null 2>&1; then
  echo "ERROR: 'zip' is not installed. Install it in WSL with:"
  echo "  sudo apt update && sudo apt install -y zip"
  exit 1
fi

RG="$1"
LOC="$2"
STORAGE_NAME="$3"   # must be globally unique, lower-case, 3-24 alphanumeric
APP_NAME="$4"       # must be globally unique within Azure Web Apps

echo "Creating resource group: $RG ($LOC)"
az group create --name "$RG" --location "$LOC" 1>/dev/null

echo "Creating Storage Account: $STORAGE_NAME (Standard_LRS)"
az storage account create \
  --name "$STORAGE_NAME" \
  --resource-group "$RG" \
  --location "$LOC" \
  --sku Standard_LRS \
  --kind StorageV2 1>/dev/null

CONN_STR=$(az storage account show-connection-string -g "$RG" -n "$STORAGE_NAME" --query connectionString -o tsv)

echo "Ensuring table: bbsEntries"
az storage table create \
  --account-name "$STORAGE_NAME" \
  --name bbsEntries \
  --auth-mode key 1>/dev/null || true

echo "Creating App Service Plan (Free F1)"
az appservice plan create \
  --name bbs-plan \
  --resource-group "$RG" \
  --location "$LOC" \
  --sku F1 \
  --is-linux 1>/dev/null

echo "Creating Web App: $APP_NAME (Node 22)"
# If app already exists, disable AlwaysOn to ensure compatibility with Free (F1) tier
if az webapp show --name "$APP_NAME" --resource-group "$RG" >/dev/null 2>&1; then
  echo "Disabling AlwaysOn for existing app to allow Free Tier update..."
  az webapp config set --name "$APP_NAME" --resource-group "$RG" --always-on false 1>/dev/null 2>&1 || true
fi

az webapp create \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --plan bbs-plan \
  --runtime "NODE|22-lts" 1>/dev/null

echo "Configuring app settings"
# Base settings
az webapp config appsettings set \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --settings \
    STORAGE_CONNECTION_STRING="$CONN_STR" \
    TABLE_NAME="bbsEntries" \
    SCM_DO_BUILD_DURING_DEPLOYMENT=true 1>/dev/null

# Sync settings from config.env if it exists
SCRIPT_DIR="$(dirname "$0")"
if [ -f "$SCRIPT_DIR/config.env" ]; then
  echo "Syncing Brevo & JWT settings from config.env..."
  
  # Read settings into an array, ignoring comments and empty lines
  # We also strip carriage returns (\r) for Windows compatibility
  mapfile -t SETTINGS_ARR < <(grep -v '^#' "$SCRIPT_DIR/config.env" | grep -v '^$' | sed 's/\r//')
  
  if [ ${#SETTINGS_ARR[@]} -gt 0 ]; then
    az webapp config appsettings set \
      --name "$APP_NAME" \
      --resource-group "$RG" \
      --settings "${SETTINGS_ARR[@]}" 1>/dev/null
  fi
else
  echo "⚠️ config.env not found in $SCRIPT_DIR. Skipping additional app settings."
fi

echo "Deploying app (zip)"
pushd "$(dirname "$0")" >/dev/null
TMP_ZIP="bbs_deploy.zip"
rm -f "$TMP_ZIP"
# Exclude dev artifacts, node_modules, and the zip itself
zip -qr "$TMP_ZIP" . -x "node_modules/*" ".git/*" "*.zip" "*.env" "*.env.template"
popd >/dev/null

az webapp deploy \
  --resource-group "$RG" \
  --name "$APP_NAME" \
  --src-path "$(dirname "$0")/bbs_deploy.zip" \
  --type zip 1>/dev/null

URL="https://$APP_NAME.azurewebsites.net"
echo "Deployment complete. App URL: $URL"
echo "Try opening: $URL"


