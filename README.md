# Next.js DynamoDB Demo

This is a demonstration project showing how to use DynamoDB with a Next.js application. It includes a complete API for creating, reading, updating, and deleting items in a DynamoDB table, along with a user interface for testing these operations.

## Features

- Local DynamoDB instance using Docker
- Next.js API routes for DynamoDB operations
- React UI for interacting with the DynamoDB API
- TypeScript support throughout the application
- Time-to-Live (TTL) support for automatic item expiration
- Demonstrates various DynamoDB operations:
  - PutItem (Create)
  - GetItem (Read single item)
  - Scan (Read all items)
  - Query (Search items)
  - UpdateItem (Update)
  - DeleteItem (Delete)

## Getting Started

### Prerequisites

- Node.js (version 20.10.0 or later) - Next.js requires Node.js 18.18.0 or higher
- pnpm
- Docker (for running local DynamoDB)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd next-dynamodb-demo
```

2. Install dependencies:

```bash
pnpm install
```

### Running the Application

#### Recommended Method (Most Reliable)

Use the Docker setup script which includes better error handling and retry logic:

```bash
pnpm start:docker
```

This shell script will:
1. Stop and remove any existing DynamoDB containers
2. Start a new DynamoDB container
3. Wait for the container to be fully ready
4. Create the necessary table
5. Start the Next.js development server

#### Alternative Methods

You can also start everything with a single command:

```bash
pnpm setup-and-start
```

This will:
1. Start a local DynamoDB instance in Docker
2. Create the necessary table
3. Start the Next.js development server

Alternatively, you can run each step manually:

```bash
# Start DynamoDB local
pnpm dynamodb:start

# Set up the table
pnpm dynamodb:setup

# Start the Next.js dev server
pnpm dev
```

### Environment Variables

This project uses environment variables for configuration. The default values are set in `.env.local`:

```
# DynamoDB configuration
DYNAMODB_LOCAL=true
DYNAMODB_ENDPOINT=http://localhost:8000
DYNAMODB_REGION=us-east-1
DYNAMODB_TABLE=Users

# AWS credentials (only used for local development)
AWS_ACCESS_KEY_ID=fakeMyKeyId
AWS_SECRET_ACCESS_KEY=fakeSecretAccessKey
```

You can modify these values to use a different DynamoDB instance or table name.

### Stopping DynamoDB

When you're done with development, you can stop and remove the DynamoDB container:

```bash
pnpm dynamodb:stop
```

## Troubleshooting

### Node.js Version Error

If you see an error about Node.js version not being compatible with Next.js, make sure you're using Node.js 20.10.0 or later. You can use a version manager like nvm to switch Node.js versions:

```bash
# Install the correct Node.js version using nvm
nvm install 
# Or specify the version explicitly
nvm install 20.10.0

# Use the correct version
nvm use
```

### DynamoDB Connection Issues

If you're experiencing connection issues with DynamoDB:

1. Use the more reliable Docker setup script:
   ```bash
   pnpm start:docker
   ```

2. Check if the DynamoDB container is running:
   ```bash
   docker ps
   ```

3. If the container isn't running, try starting it again:
   ```bash
   pnpm dynamodb:start
   ```

4. If the container is running but you still have connection issues, try stopping and restarting it:
   ```bash
   pnpm dynamodb:stop
   pnpm dynamodb:start
   ```

5. After ensuring DynamoDB is running, use the wait-and-setup script:
   ```bash
   pnpm wait-and-setup
   ```

## Usage

Once the application is running, visit http://localhost:3000 in your browser to access the UI.

The UI allows you to:
- Create new users
- Get a user by ID
- Query users
- Update users
- Delete users
- Set Time-to-Live (TTL) values for automatic item expiration
- See a list of all users in the database with their expiration times

## API Endpoints

### GET /api/users

Returns all users in the database.

### POST /api/users

Performs various DynamoDB operations based on the `operation` field in the request body.

#### Create a user

```json
{
  "operation": "create",
  "name": "John Doe",
  "email": "john@example.com",
  "age": 30,
  "ttl": 3600
}
```

The `ttl` field is optional and specifies the number of seconds until the item should expire.

#### Get a user by ID

```json
{
  "operation": "get",
  "id": "user-id"
}
```

#### Query users

```json
{
  "operation": "query",
  "id": "user-id"
}
```

#### Update a user

```json
{
  "operation": "update",
  "id": "user-id",
  "name": "Updated Name",
  "email": "updated@example.com",
  "ttl": 7200
}
```

You can update the TTL by providing a new value, or remove the TTL by setting it to `null`:

```json
{
  "operation": "update",
  "id": "user-id",
  "ttl": null
}
```

#### Delete a user

```json
{
  "operation": "delete",
  "id": "user-id"
}
```

## Learning DynamoDB

This project demonstrates several key aspects of working with DynamoDB:

1. **Single-Table Design**: All data is stored in a single table with a simple primary key
2. **Primary Key**: The table uses a simple primary key (just a partition key, no sort key)
3. **DynamoDB Operations**: Examples of the main operations (PutItem, GetItem, Scan, Query, UpdateItem, DeleteItem)
4. **Expression Attributes**: Used in the update operation to modify specific fields
5. **DynamoDB Document Client**: Using the higher-level DocumentClient for easier JavaScript object handling
6. **Time-to-Live (TTL)**: Automatic expiration of items based on a timestamp attribute

### About Time-to-Live (TTL)

DynamoDB's TTL feature lets you define a timestamp attribute for items that specifies when they should be automatically deleted. In this project:

- The TTL attribute is named `expiresAt` and must be a Unix timestamp in seconds
- When an item's `expiresAt` time is reached, DynamoDB automatically deletes it
- The UI shows both the timestamp value and a human-readable date format
- Setting TTL is optional - if not provided, items won't expire
- You can update or remove TTL on existing items

Note: In local DynamoDB, TTL might not fully work as it does in AWS-hosted DynamoDB. The items will still have the TTL attribute, but automatic deletion might not occur.

## License

MIT
