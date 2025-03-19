import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

// Define types for our user items
export interface UserItem {
  id: string;
  name?: string;
  email?: string;
  age?: number;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: number; // TTL field - Unix timestamp in seconds
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

// Helper functions for DynamoDB operations

// Put a new item in the table
export async function putItem(item: UserItem) {
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  });

  return docClient.send(command);
}

// Get a single item by its primary key
export async function getItem(id: string) {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: { id },
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

// Query items using a key condition
export async function queryItems(keyCondition: { id: string }) {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "id = :id",
    ExpressionAttributeValues: {
      ":id": keyCondition.id,
    },
  });

  return docClient.send(command);
}

// Update an existing item
export async function updateItem(
  id: string,
  updateExpression: string,
  attributeValues: Record<string, string | number | boolean>
) {
  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: attributeValues,
    ReturnValues: "ALL_NEW",
  });

  return docClient.send(command);
}

// Delete an item
export async function deleteItem(id: string) {
  const command = new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { id },
  });

  return docClient.send(command);
}
