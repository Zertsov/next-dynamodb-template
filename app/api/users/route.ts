import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  createUserProfile,
  addUserDetail,
  addUserActivity,
  scanTable,
  getItem,
  updateItem,
  deleteItem,
  queryUserItems,
  queryBySortKey,
  UserItem,
  calculateTTL,
  formatTTLDate,
} from "@/app/lib/dynamodb";

// GET endpoint to fetch all users
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("userId");
  const skPrefix = searchParams.get("skPrefix");
  const queryType = searchParams.get("queryType") || "all";

  try {
    // Different query strategies based on parameters
    if (queryType === "bySort" && skPrefix) {
      // Query by sort key pattern using the Global Secondary Index
      const result = await queryBySortKey(skPrefix);
      return NextResponse.json({
        items: result.Items || [],
        count: result.Count,
        message: "DynamoDB Query by sort key pattern completed successfully",
        explanation:
          "Using the Global Secondary Index to query by sort key pattern",
        query: { skPrefix },
      });
    } else if (userId) {
      // Query items for a specific user with optional sort key prefix
      const result = await queryUserItems(userId, skPrefix || undefined);
      return NextResponse.json({
        items: result.Items || [],
        count: result.Count,
        message: "DynamoDB Query operation completed successfully",
        explanation:
          "This demonstrates querying with a partition key and optional sort key prefix",
        query: { userId, skPrefix: skPrefix || "none" },
      });
    } else {
      // Default - scan the table
      const result = await scanTable();
      return NextResponse.json({
        items: result.Items || [],
        count: result.Count,
        scannedCount: result.ScannedCount,
        message: "DynamoDB Scan operation completed successfully",
        note: "Scan operations read every item in the table - use sparingly in production",
      });
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    return NextResponse.json(
      { error: "Failed to fetch data from DynamoDB" },
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
      case "createProfile": {
        // Create a new user profile
        if (!data.name) {
          return NextResponse.json(
            { error: "Missing required field: name" },
            { status: 400 }
          );
        }

        const userId = data.userId || uuidv4(); // Generate ID if not provided

        const userProfile: UserItem = {
          userId,
          sk: data.sk || undefined, // Let the function generate a default sort key if not provided
          name: data.name,
          email: data.email,
          age: data.age ? Number(data.age) : undefined,
          createdAt: new Date().toISOString(), // Add createdAt timestamp
        };

        // Handle TTL if provided
        if (data.ttl) {
          const ttlSeconds = parseInt(data.ttl);
          if (isNaN(ttlSeconds)) {
            return NextResponse.json(
              { error: "TTL must be a valid number of seconds" },
              { status: 400 }
            );
          }

          userProfile.expiresAt = calculateTTL(ttlSeconds);
        }

        const createdItem = await createUserProfile(userProfile);

        return NextResponse.json({
          message: "User profile created successfully",
          item: createdItem,
          expiresAt: createdItem.expiresAt
            ? {
                timestamp: createdItem.expiresAt,
                formattedDate: formatTTLDate(createdItem.expiresAt),
              }
            : null,
          operation: "CreateProfile",
          explanation:
            "Created a user profile with partition key (userId) and sort key",
        });
      }

      case "addDetail": {
        // Add a detail item for a user
        if (!data.userId) {
          return NextResponse.json(
            { error: "Missing required field: userId" },
            { status: 400 }
          );
        }

        if (!data.detailType) {
          return NextResponse.json(
            { error: "Missing required field: detailType" },
            { status: 400 }
          );
        }

        // Extract the userId and detailType from the data
        const { userId, detailType, ...detailData } = data;

        // Add TTL if provided
        if (data.ttl) {
          const ttlSeconds = parseInt(data.ttl);
          if (isNaN(ttlSeconds)) {
            return NextResponse.json(
              { error: "TTL must be a valid number of seconds" },
              { status: 400 }
            );
          }

          detailData.expiresAt = calculateTTL(ttlSeconds);
        }

        const createdDetail = await addUserDetail(
          userId,
          detailType,
          detailData
        );

        return NextResponse.json({
          message: "User detail added successfully",
          item: createdDetail,
          operation: "AddDetail",
          explanation:
            "Added a detail item with sort key pattern DETAIL#type#timestamp",
        });
      }

      case "addActivity": {
        // Add an activity item for a user
        if (!data.userId) {
          return NextResponse.json(
            { error: "Missing required field: userId" },
            { status: 400 }
          );
        }

        if (!data.activityType) {
          return NextResponse.json(
            { error: "Missing required field: activityType" },
            { status: 400 }
          );
        }

        // Extract the userId and activityType from the data
        const { userId, activityType, ...activityData } = data;

        // Add TTL if provided
        if (data.ttl) {
          const ttlSeconds = parseInt(data.ttl);
          if (isNaN(ttlSeconds)) {
            return NextResponse.json(
              { error: "TTL must be a valid number of seconds" },
              { status: 400 }
            );
          }

          activityData.expiresAt = calculateTTL(ttlSeconds);
        }

        const createdActivity = await addUserActivity(
          userId,
          activityType,
          activityData
        );

        return NextResponse.json({
          message: "User activity added successfully",
          item: createdActivity,
          operation: "AddActivity",
          explanation:
            "Added an activity item with sort key pattern ACTIVITY#type#timestamp",
        });
      }

      case "get": {
        // Get a single item using composite key (userId + sk)
        if (!data.userId || !data.sk) {
          return NextResponse.json(
            { error: "Missing required fields: userId and sk" },
            { status: 400 }
          );
        }

        const result = await getItem(data.userId, data.sk);

        if (!result.Item) {
          return NextResponse.json(
            { error: "Item not found" },
            { status: 404 }
          );
        }

        const item = result.Item as UserItem;

        return NextResponse.json({
          item,
          expiresAt: item.expiresAt
            ? {
                timestamp: item.expiresAt,
                formattedDate: formatTTLDate(item.expiresAt),
              }
            : null,
          operation: "GetItem",
          explanation:
            "Retrieved a single item using its composite key (userId + sk)",
        });
      }

      case "queryUser": {
        // Query items for a specific user
        if (!data.userId) {
          return NextResponse.json(
            { error: "Missing required field: userId" },
            { status: 400 }
          );
        }

        // Optional sort key prefix for filtering
        const skPrefix = data.skPrefix as string | undefined;

        const result = await queryUserItems(data.userId, skPrefix);

        return NextResponse.json({
          items: result.Items,
          count: result.Count,
          operation: "QueryItems",
          parameters: {
            userId: data.userId,
            skPrefix: skPrefix || "none",
          },
          explanation:
            "Queried items by partition key (userId) with optional sort key prefix filter",
        });
      }

      case "queryBySort": {
        // Query items by sort key pattern
        if (!data.skPrefix) {
          return NextResponse.json(
            { error: "Missing required field: skPrefix" },
            { status: 400 }
          );
        }

        const result = await queryBySortKey(data.skPrefix);

        return NextResponse.json({
          items: result.Items,
          count: result.Count,
          operation: "QueryBySort",
          parameters: {
            skPrefix: data.skPrefix,
          },
          explanation:
            "Queried items by sort key pattern using the Global Secondary Index",
        });
      }

      case "update": {
        // Update an item
        if (!data.userId || !data.sk) {
          return NextResponse.json(
            { error: "Missing required fields: userId and sk" },
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
          if (
            key !== "userId" &&
            key !== "sk" &&
            key !== "operation" &&
            value !== undefined
          ) {
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
          data.userId,
          data.sk,
          updateExpression,
          expressionAttributeValues
        );

        const updatedItem = result.Attributes as UserItem;

        return NextResponse.json({
          message: "Item updated successfully",
          item: updatedItem,
          expiresAt: updatedItem.expiresAt
            ? {
                timestamp: updatedItem.expiresAt,
                formattedDate: formatTTLDate(updatedItem.expiresAt),
              }
            : null,
          operation: "UpdateItem",
          updateExpression,
          expressionAttributeValues,
          explanation:
            "Updated an item identified by its composite key (userId + sk)",
        });
      }

      case "delete": {
        // Delete an item
        if (!data.userId || !data.sk) {
          return NextResponse.json(
            { error: "Missing required fields: userId and sk" },
            { status: 400 }
          );
        }

        await deleteItem(data.userId, data.sk);

        return NextResponse.json({
          message: "Item deleted successfully",
          key: { userId: data.userId, sk: data.sk },
          operation: "DeleteItem",
          explanation:
            "Deleted an item based on its composite key (userId + sk)",
        });
      }

      default:
        return NextResponse.json(
          {
            error: "Invalid operation",
            availableOperations: [
              "createProfile",
              "addDetail",
              "addActivity",
              "get",
              "queryUser",
              "queryBySort",
              "update",
              "delete",
            ],
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
