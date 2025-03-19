import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";

// Enum for item types
export enum ItemType {
  PROFILE = "PROFILE",
  DETAIL = "DETAIL",
  ACTIVITY = "ACTIVITY",
}

// Define types for our user items
export interface UserItem {
  userId: string; // Partition key
  sk: string; // Sort key
  name?: string;
  email?: string;
  age?: number;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: number; // TTL field - Unix timestamp in seconds
  itemType?: string; // Used to distinguish between different item types
  detailType?: string; // For DETAIL items
  activityType?: string; // For ACTIVITY items
  description?: string; // Generic field for various items
  [key: string]: unknown;
}

// Get configuration from environment variables or use defaults
const isLocal = process.env.DYNAMODB_LOCAL === "true";
const endpoint = process.env.DYNAMODB_ENDPOINT || "http://localhost:8000";
const region = process.env.DYNAMODB_REGION || "us-east-1";

// Initialize the DynamoDB client
const client = new DynamoDBClient({
  region,
  ...(isLocal ? { endpoint } : {}),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "fakeMyKeyId",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "fakeSecretAccessKey",
  },
});

// Create a document client for easier handling of JavaScript objects
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    // Convert empty strings to null (DynamoDB doesn't support empty strings)
    convertEmptyValues: true,
    // Whether or not to remove undefined values (recommended to be true)
    removeUndefinedValues: true,
  },
});

// Table name constant
export const TABLE_NAME = process.env.DYNAMODB_TABLE || "Users";

/**
 * Generate a sort key for a specific item type
 */
export function generateSortKey(
  itemType: ItemType,
  secondaryType?: string
): string {
  const timestamp = new Date().toISOString();

  switch (itemType) {
    case ItemType.PROFILE:
      return `${ItemType.PROFILE}#${timestamp}`;
    case ItemType.DETAIL:
      return `${ItemType.DETAIL}#${secondaryType || "DEFAULT"}#${timestamp}`;
    case ItemType.ACTIVITY:
      return `${ItemType.ACTIVITY}#${secondaryType || "DEFAULT"}#${timestamp}`;
    default:
      return `${itemType}#${timestamp}`;
  }
}

/**
 * Calculate TTL timestamp for a given number of seconds in the future
 * @param secondsFromNow Number of seconds from now when the item should expire
 * @returns Unix timestamp in seconds (required format for DynamoDB TTL)
 */
export function calculateTTL(secondsFromNow: number): number {
  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  return now + secondsFromNow;
}

/**
 * Format a TTL timestamp into a human-readable date string
 * @param ttlTimestamp TTL timestamp in seconds
 * @returns Formatted date string
 */
export function formatTTLDate(ttlTimestamp: number): string {
  if (!ttlTimestamp) return "No expiration";
  return new Date(ttlTimestamp * 1000).toLocaleString();
}

/**
 * Create a new user profile
 */
export async function createUserProfile(item: UserItem): Promise<UserItem> {
  // If sk is not provided, generate a default sort key for PROFILE
  if (!item.sk) {
    item.sk = generateSortKey(ItemType.PROFILE);
  }

  item.itemType = ItemType.PROFILE;
  item.createdAt = new Date().toISOString();

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  });

  await docClient.send(command);
  return item;
}

/**
 * Add a detail item for a user
 */
export async function addUserDetail(
  userId: string,
  detailType: string,
  data: Record<string, string | number | boolean | null>
): Promise<UserItem> {
  const item: UserItem = {
    userId,
    sk: generateSortKey(ItemType.DETAIL, detailType),
    itemType: ItemType.DETAIL,
    detailType,
    ...data,
    createdAt: new Date().toISOString(),
  };

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  });

  await docClient.send(command);
  return item;
}

/**
 * Add an activity item for a user
 */
export async function addUserActivity(
  userId: string,
  activityType: string,
  data: Record<string, string | number | boolean | null>
): Promise<UserItem> {
  const item: UserItem = {
    userId,
    sk: generateSortKey(ItemType.ACTIVITY, activityType),
    itemType: ItemType.ACTIVITY,
    activityType,
    ...data,
    createdAt: new Date().toISOString(),
  };

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  });

  await docClient.send(command);
  return item;
}

// Get a single item by its composite key (userId + sk)
export async function getItem(userId: string, sk: string) {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: { userId, sk },
  });

  return docClient.send(command);
}

// Query items by userId and optional sort key prefix
export async function queryUserItems(userId: string, skPrefix?: string) {
  const params: QueryCommandInput = {
    TableName: TABLE_NAME,
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": userId,
    },
  };

  // If a sort key prefix is provided, add it to the query
  if (skPrefix) {
    params.KeyConditionExpression += " AND begins_with(sk, :skPrefix)";
    params.ExpressionAttributeValues = {
      ...params.ExpressionAttributeValues,
      ":skPrefix": skPrefix,
    };
  }

  const command = new QueryCommand(params);
  return docClient.send(command);
}

// Query by sort key pattern using the GSI
export async function queryBySortKey(skPrefix: string) {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "SKIndex",
    KeyConditionExpression: "begins_with(sk, :skPrefix)",
    ExpressionAttributeValues: {
      ":skPrefix": skPrefix,
    },
  });

  return docClient.send(command);
}

// Scan the entire table (use sparingly - not efficient for large tables)
export async function scanTable() {
  const command = new ScanCommand({
    TableName: TABLE_NAME,
  });

  return docClient.send(command);
}

// Update an existing item
export async function updateItem(
  userId: string,
  sk: string,
  updateExpression: string,
  attributeValues: Record<string, string | number | boolean>
) {
  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { userId, sk },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: attributeValues,
    ReturnValues: "ALL_NEW",
  });

  return docClient.send(command);
}

// Delete an item
export async function deleteItem(userId: string, sk: string) {
  const command = new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { userId, sk },
  });

  return docClient.send(command);
}
