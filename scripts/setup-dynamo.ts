import {
  DynamoDBClient,
  CreateTableCommand,
  ListTablesCommand,
  CreateTableCommandInput,
  UpdateTimeToLiveCommand,
  DescribeTimeToLiveCommand,
  TimeToLiveStatus,
} from "@aws-sdk/client-dynamodb";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

// Get configuration from environment variables or use defaults
const endpoint = process.env.DYNAMODB_ENDPOINT || "http://localhost:8000";
const region = process.env.DYNAMODB_REGION || "us-east-1";
const tableName = process.env.DYNAMODB_TABLE || "Users";

const client = new DynamoDBClient({
  region,
  endpoint,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "fakeMyKeyId",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "fakeSecretAccessKey",
  },
});

const tableParams: CreateTableCommandInput = {
  TableName: tableName,
  AttributeDefinitions: [
    { AttributeName: "userId", AttributeType: "S" },
    { AttributeName: "sk", AttributeType: "S" },
  ],
  KeySchema: [
    { AttributeName: "userId", KeyType: "HASH" }, // Partition key
    { AttributeName: "sk", KeyType: "RANGE" }, // Sort key
  ],
  ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  // Add a Global Secondary Index to query by sort key pattern
  GlobalSecondaryIndexes: [
    {
      IndexName: "SKIndex",
      KeySchema: [
        { AttributeName: "sk", KeyType: "HASH" },
        { AttributeName: "userId", KeyType: "RANGE" },
      ],
      Projection: {
        ProjectionType: "ALL",
      },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    },
  ],
};

/**
 * Sleep for the specified number of milliseconds
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Function to check if DynamoDB is ready
 */
async function isDynamoDbReady(): Promise<boolean> {
  try {
    await client.send(new ListTablesCommand({}));
    return true;
  } catch {
    console.log("DynamoDB not ready yet, retrying...");
    return false;
  }
}

/**
 * Wait for DynamoDB to be ready with retries
 */
async function waitForDynamoDb(): Promise<boolean> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    const isReady = await isDynamoDbReady();
    if (isReady) {
      return true;
    }
    console.log(
      `Waiting for DynamoDB to be ready... (Attempt ${i + 1}/${MAX_RETRIES})`
    );
    await sleep(RETRY_DELAY_MS);
  }
  return false;
}

/**
 * Enable TTL on the table
 */
async function enableTTL(tableName: string): Promise<void> {
  try {
    // First check if TTL is already enabled
    const describeResponse = await client.send(
      new DescribeTimeToLiveCommand({
        TableName: tableName,
      })
    );

    // If TTL is already enabled with the correct attribute, return
    if (
      describeResponse.TimeToLiveDescription?.TimeToLiveStatus ===
        TimeToLiveStatus.ENABLED &&
      describeResponse.TimeToLiveDescription?.AttributeName === "expiresAt"
    ) {
      console.log(
        `TTL is already enabled on table '${tableName}' with attribute 'expiresAt'`
      );
      return;
    }

    // Enable TTL on the table
    await client.send(
      new UpdateTimeToLiveCommand({
        TableName: tableName,
        TimeToLiveSpecification: {
          Enabled: true,
          AttributeName: "expiresAt", // The attribute name that will hold the expiration timestamp
        },
      })
    );

    console.log(
      `TTL enabled on table '${tableName}' with attribute 'expiresAt'`
    );
  } catch (error) {
    console.error("Error enabling TTL:", error);
    // Continue anyway, as this might fail in local DynamoDB
    console.log(
      "Note: TTL might not be fully supported in local DynamoDB instances"
    );
  }
}

async function setupDynamoDB() {
  try {
    console.log(`Connecting to DynamoDB at ${endpoint}...`);

    // Wait for DynamoDB to be ready
    const isReady = await waitForDynamoDb();
    if (!isReady) {
      console.error(
        "DynamoDB did not become ready in time. Please ensure DynamoDB is running and try again."
      );
      process.exit(1);
    }

    console.log("Successfully connected to DynamoDB!");

    // Check if table exists
    const { TableNames } = await client.send(new ListTablesCommand({}));
    let tableExists = TableNames && TableNames.includes(tableName);

    if (tableExists) {
      console.log(`Table '${tableName}' already exists.`);
      console.log(
        `Note: To see the new schema with sort keys, delete the existing table first:`
      );
      console.log(`pnpm dynamodb:stop && pnpm start:docker`);
    } else {
      // Create the table
      await client.send(new CreateTableCommand(tableParams));
      console.log(
        `Table '${tableName}' created successfully with composite key (partition + sort key).`
      );
      tableExists = true;
    }

    // Enable TTL if the table exists
    if (tableExists) {
      await enableTTL(tableName);
    }

    console.log(`
DynamoDB is now set up with a "${tableName}" table that has:
- Composite Key: 
  - Partition Key (HASH): "userId" (String)
  - Sort Key (RANGE): "sk" (String)
- Global Secondary Index: "SKIndex" (query by sort key patterns)
- Read/Write capacity: 5 units
- TTL enabled with attribute: "expiresAt"

How Sort Keys are used in this demo:
- For basic user profiles: sk = "PROFILE#<timestamp>"
- For user details: sk = "DETAIL#<type>#<timestamp>"
- For user activity: sk = "ACTIVITY#<activityType>#<timestamp>"

This demonstrates how a single table can use sort keys to store different entity types
and create relationships between them, following DynamoDB's single-table design pattern.

You can now use the API endpoints to:
- POST to /api/users with operation: "create", "get", "query", "update", or "delete"
- GET from /api/users to retrieve all users

To customize the DynamoDB configuration, you can set these environment variables:
- DYNAMODB_ENDPOINT: The DynamoDB endpoint (default: http://localhost:8000)
- DYNAMODB_REGION: The AWS region (default: us-east-1)
- DYNAMODB_TABLE: The table name (default: Users)
- DYNAMODB_LOCAL: Set to 'true' to use local DynamoDB (default: not set)
- AWS_ACCESS_KEY_ID: Your AWS access key ID (default: fake key for local dev)
- AWS_SECRET_ACCESS_KEY: Your AWS secret key (default: fake key for local dev)

Run the development server with:
  pnpm dev
    `);
  } catch (error) {
    console.error("Error setting up DynamoDB:", error);
    process.exit(1);
  }
}

setupDynamoDB();
