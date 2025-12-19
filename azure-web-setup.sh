#!/bin/bash

# Azure Setup Script for Espa-TV Web App
echo "Setting up Azure services for Espa-TV Web Application..."

# 1. Login to Azure
echo "Step 1: Logging into Azure..."
az login

# 2. Create Resource Group
echo "Step 2: Creating Resource Group..."
az group create --name espa-tv-rg --location eastus

# 3. Create SignalR Service (Free Tier)
echo "Step 3: Creating SignalR Service..."
az signalr create \
  --name espa-tv-signalr \
  --resource-group espa-tv-rg \
  --sku Free \
  --unit-count 1

# 4. Create Cosmos DB Account (Free Tier)
echo "Step 4: Creating Cosmos DB Account..."
az cosmosdb create \
  --name espa-tv-cosmos \
  --resource-group espa-tv-rg \
  --kind GlobalDocumentDB \
  --default-consistency-level Session \
  --enable-free-tier true

# 5. Create Cosmos DB Database
echo "Step 5: Creating Cosmos DB Database..."
az cosmosdb sql database create \
  --account-name espa-tv-cosmos \
  --resource-group espa-tv-rg \
  --name espa-tv-db

# 6. Create Cosmos DB Container
echo "Step 6: Creating Cosmos DB Container..."
az cosmosdb sql container create \
  --account-name espa-tv-cosmos \
  --resource-group espa-tv-rg \
  --database-name espa-tv-db \
  --name devices \
  --partition-key-path '/id'

# 7. Create Storage Account for Functions
echo "Step 7: Creating Storage Account..."
az storage account create \
  --name espatvstorage \
  --resource-group espa-tv-rg \
  --location eastus \
  --sku Standard_LRS \
  --kind StorageV2

# 8. Create Function App
echo "Step 8: Creating Function App..."
az functionapp create \
  --resource-group espa-tv-rg \
  --consumption-plan-location eastus \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name espa-tv-api \
  --storage-account espatvstorage

# 9. Get connection strings and save them
echo "Step 9: Getting connection strings..."

SIGNALR_CONNECTION=$(az signalr key list \
  --name espa-tv-signalr \
  --resource-group espa-tv-rg \
  --query primaryConnectionString \
  -o tsv)

COSMOS_CONNECTION=$(az cosmosdb keys list \
  --name espa-tv-cosmos \
  --resource-group espa-tv-rg \
  --type connection-strings \
  --query connectionStrings[0].connectionString \
  -o tsv)

# Save connection strings to .env file
cat > .env << EOF
SIGNALR_CONNECTION_STRING=$SIGNALR_CONNECTION
COSMOS_DB_CONNECTION_STRING=$COSMOS_CONNECTION
EOF

echo "Setup complete! Connection strings saved to .env file"
echo "SignalR Connection: $SIGNALR_CONNECTION"
echo "Cosmos DB Connection: $COSMOS_CONNECTION"

































