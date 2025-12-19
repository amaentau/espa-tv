# Azure Setup Script for Espa-TV Web App (PowerShell Version)
Write-Host "Setting up Azure services for Espa-TV Web Application..." -ForegroundColor Green

# 1. Login to Azure
Write-Host "Step 1: Logging into Azure..." -ForegroundColor Yellow
az login

# 2. Create Resource Group
Write-Host "Step 2: Creating Resource Group..." -ForegroundColor Yellow
az group create --name espa-tv-rg --location eastus

# 3. Create SignalR Service (Free Tier)
Write-Host "Step 3: Creating SignalR Service..." -ForegroundColor Yellow
az signalr create `
  --name espa-tv-signalr `
  --resource-group espa-tv-rg `
  --sku Free `
  --unit-count 1

# 4. Create Cosmos DB Account (Free Tier)
Write-Host "Step 4: Creating Cosmos DB Account..." -ForegroundColor Yellow
az cosmosdb create `
  --name espa-tv-cosmos `
  --resource-group espa-tv-rg `
  --kind GlobalDocumentDB `
  --default-consistency-level Session `
  --enable-free-tier true

# 5. Create Cosmos DB Database
Write-Host "Step 5: Creating Cosmos DB Database..." -ForegroundColor Yellow
az cosmosdb sql database create `
  --account-name espa-tv-cosmos `
  --resource-group espa-tv-rg `
  --name espa-tv-db

# 6. Create Cosmos DB Container
Write-Host "Step 6: Creating Cosmos DB Container..." -ForegroundColor Yellow
az cosmosdb sql container create `
  --account-name espa-tv-cosmos `
  --resource-group espa-tv-rg `
  --database-name espa-tv-db `
  --name devices `
  --partition-key-path '/id'

# 7. Create Storage Account for Functions
Write-Host "Step 7: Creating Storage Account..." -ForegroundColor Yellow
az storage account create `
  --name espatvstorage `
  --resource-group espa-tv-rg `
  --location eastus `
  --sku Standard_LRS `
  --kind StorageV2

# 8. Create Function App
Write-Host "Step 8: Creating Function App..." -ForegroundColor Yellow
az functionapp create `
  --resource-group espa-tv-rg `
  --consumption-plan-location eastus `
  --runtime node `
  --runtime-version 18 `
  --functions-version 4 `
  --name espa-tv-api `
  --storage-account espatvstorage

# 9. Get connection strings and save them
Write-Host "Step 9: Getting connection strings..." -ForegroundColor Yellow

$SIGNALR_CONNECTION = az signalr key list `
  --name espa-tv-signalr `
  --resource-group espa-tv-rg `
  --query primaryConnectionString `
  -o tsv

$COSMOS_CONNECTION = az cosmosdb keys list `
  --name espa-tv-cosmos `
  --resource-group espa-tv-rg `
  --type connection-strings `
  --query connectionStrings[0].connectionString `
  -o tsv

# Save connection strings to .env file
$envContent = @"
SIGNALR_CONNECTION_STRING=$SIGNALR_CONNECTION
COSMOS_DB_CONNECTION_STRING=$COSMOS_CONNECTION
"@

$envContent | Out-File -FilePath ".env" -Encoding UTF8

Write-Host "Setup complete! Connection strings saved to .env file" -ForegroundColor Green
Write-Host "SignalR Connection: $SIGNALR_CONNECTION" -ForegroundColor Cyan
Write-Host "Cosmos DB Connection: $COSMOS_CONNECTION" -ForegroundColor Cyan

































