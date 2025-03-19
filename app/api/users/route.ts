import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  putItem,
  scanTable,
  getItem,
  updateItem,
  deleteItem,
  queryItems,
  UserItem,
  calculateTTL,
  formatTTLDate,
} from "@/app/lib/dynamodb";

// GET endpoint to fetch all users
export async function GET() {
  try {
    const result = await scanTable();
    return NextResponse.json({
      users: result.Items || [],
      count: result.Count,
      scannedCount: result.ScannedCount,
      message: "DynamoDB Scan operation completed successfully",
      note: "Scan operations read every item in the table - use sparingly in production",
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users from DynamoDB" },
      { status: 500 }
    );
  }
}

// POST endpoint with flexible operations
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { operation, ...data } = body;

    // Validate the request
    if (!operation) {
      return NextResponse.json(
        { error: "Missing required field: operation" },
        { status: 400 }
      );
    }

    // Handle different operations
    switch (operation) {
      case "create": {
        // Create a new user with basic validation
        if (!data.name) {
          return NextResponse.json(
            { error: "Missing required field: name" },
            { status: 400 }
          );
        }

        const newUser: UserItem = {
          id: data.id || uuidv4(), // Generate ID if not provided
          ...data,
          createdAt: new Date().toISOString(),
        };

        // Handle TTL if provided
        if (data.ttl) {
          // TTL is provided in seconds from now
          const ttlSeconds = parseInt(data.ttl);
          if (isNaN(ttlSeconds)) {
            return NextResponse.json(
              { error: "TTL must be a valid number of seconds" },
              { status: 400 }
            );
          }

          newUser.expiresAt = calculateTTL(ttlSeconds);
          // Remove the ttl field as it's not needed in DynamoDB
          delete newUser.ttl;
        }

        await putItem(newUser);

        return NextResponse.json({
          message: "User created successfully",
          user: newUser,
          expiresAt: newUser.expiresAt
            ? {
                timestamp: newUser.expiresAt,
                formattedDate: formatTTLDate(newUser.expiresAt),
              }
            : null,
          operation: "PutItem",
          explanation:
            "PutItem creates a new item or replaces an existing one with the same primary key",
        });
      }

      case "get": {
        // Get a user by ID
        if (!data.id) {
          return NextResponse.json(
            { error: "Missing required field: id" },
            { status: 400 }
          );
        }

        const result = await getItem(data.id);

        if (!result.Item) {
          return NextResponse.json(
            { error: "User not found" },
            { status: 404 }
          );
        }

        const user = result.Item as UserItem;

        return NextResponse.json({
          user,
          expiresAt: user.expiresAt
            ? {
                timestamp: user.expiresAt,
                formattedDate: formatTTLDate(user.expiresAt),
              }
            : null,
          operation: "GetItem",
          explanation: "GetItem retrieves a single item by its primary key",
        });
      }

      case "query": {
        // Query by ID (simple example - in a real app, this would be more sophisticated)
        if (!data.id) {
          return NextResponse.json(
            { error: "Missing required field: id for query" },
            { status: 400 }
          );
        }

        const result = await queryItems({ id: data.id });

        return NextResponse.json({
          items: result.Items,
          count: result.Count,
          operation: "Query",
          explanation:
            "Query operation finds items based on primary key values and is more efficient than Scan",
        });
      }

      case "update": {
        // Update a user
        if (!data.id) {
          return NextResponse.json(
            { error: "Missing required field: id" },
            { status: 400 }
          );
        }

        // Build update expression and attribute values
        const updateExpressions: string[] = [];
        const expressionAttributeValues: Record<
          string,
          string | number | boolean
        > = {};

        // Handle TTL update if provided
        if (data.ttl !== undefined) {
          if (data.ttl === null || data.ttl === "") {
            // Remove TTL if explicitly set to null or empty string
            updateExpressions.push("REMOVE expiresAt");
          } else {
            // TTL is provided in seconds from now
            const ttlSeconds = parseInt(data.ttl);
            if (isNaN(ttlSeconds)) {
              return NextResponse.json(
                { error: "TTL must be a valid number of seconds" },
                { status: 400 }
              );
            }

            updateExpressions.push("expiresAt = :expiresAt");
            expressionAttributeValues[":expiresAt"] = calculateTTL(ttlSeconds);
          }

          // Remove ttl from data as we've handled it separately
          delete data.ttl;
        }

        // Handle each field to update
        Object.entries(data).forEach(([key, value]) => {
          if (key !== "id" && value !== undefined) {
            updateExpressions.push(`${key} = :${key}`);
            expressionAttributeValues[`:${key}`] = value as
              | string
              | number
              | boolean;
          }
        });

        // Add updatedAt timestamp
        updateExpressions.push("updatedAt = :updatedAt");
        expressionAttributeValues[":updatedAt"] = new Date().toISOString();

        // If nothing to update
        if (updateExpressions.length === 1) {
          // Only updatedAt
          return NextResponse.json(
            { error: "No fields to update provided" },
            { status: 400 }
          );
        }

        let updateExpression: string;

        // Check if we need to split between SET and REMOVE operations
        const setExpressions = updateExpressions.filter(
          (expr) => !expr.startsWith("REMOVE")
        );
        const removeExpressions = updateExpressions.filter((expr) =>
          expr.startsWith("REMOVE")
        );

        if (removeExpressions.length > 0) {
          updateExpression =
            `SET ${setExpressions.join(", ")}` +
            (removeExpressions.length
              ? ` REMOVE ${removeExpressions
                  .map((expr) => expr.replace("REMOVE ", ""))
                  .join(", ")}`
              : "");
        } else {
          updateExpression = `SET ${updateExpressions.join(", ")}`;
        }

        const result = await updateItem(
          data.id,
          updateExpression,
          expressionAttributeValues
        );

        const updatedUser = result.Attributes as UserItem;

        return NextResponse.json({
          message: "User updated successfully",
          updatedUser,
          expiresAt: updatedUser.expiresAt
            ? {
                timestamp: updatedUser.expiresAt,
                formattedDate: formatTTLDate(updatedUser.expiresAt),
              }
            : null,
          operation: "UpdateItem",
          updateExpression,
          expressionAttributeValues,
          explanation:
            "UpdateItem modifies an existing item attributes and returns the updated item",
        });
      }

      case "delete": {
        // Delete a user
        if (!data.id) {
          return NextResponse.json(
            { error: "Missing required field: id" },
            { status: 400 }
          );
        }

        await deleteItem(data.id);

        return NextResponse.json({
          message: "User deleted successfully",
          id: data.id,
          operation: "DeleteItem",
          explanation: "DeleteItem removes an item based on its primary key",
        });
      }

      default:
        return NextResponse.json(
          {
            error: "Invalid operation",
            availableOperations: ["create", "get", "query", "update", "delete"],
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
