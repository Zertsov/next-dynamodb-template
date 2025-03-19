# Next.js DynamoDB Demo

This is a demonstration project showing how to use DynamoDB with a Next.js application. It includes a complete API for creating, reading, updating, and deleting items in a DynamoDB table, along with a user interface for testing these operations.

## Features

- Local DynamoDB instance using Docker
- Next.js API routes for DynamoDB operations
- React UI for interacting with the DynamoDB API
- TypeScript support throughout the application
- Time-to-Live (TTL) support for automatic item expiration
- **Composite Key Model**: Uses both partition and sort keys
- **Sort Key Patterns**: Demonstrates single-table design with different entity types
- **Global Secondary Index**: For querying by sort key patterns
- Demonstrates various DynamoDB operations:
  - Create Profiles, Details, and Activities
  - GetItem (Read single item by composite key)
  - Scan (Read all items)
  - Query by User ID (partition key)
  - Query by Sort Key patterns (using GSI)
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
- Create user profiles, add details, and add activities
- Get an item by its composite key (userId + sort key)
- Query items by userId with optional sort key prefixes
- Query items by sort key patterns using the Global Secondary Index
- Update items
- Delete items
- Set Time-to-Live (TTL) values for automatic item expiration
- Filter and view items with different organization options

## Understanding DynamoDB Composite Keys and Sort Keys

This project demonstrates advanced DynamoDB modeling techniques, particularly the use of composite keys (partition key + sort key) and Global Secondary Indexes.

### Table Structure

The DynamoDB table is structured with:
- **Partition Key** (HASH): `userId` - Identifies the user
- **Sort Key** (RANGE): `sk` - Organizes different types of items and enables hierarchical data modeling
- **Global Secondary Index**: Named `SKIndex`, allows querying by sort key patterns

### Sort Key Patterns

The application uses these sort key patterns:

- **Profiles**: `PROFILE#<timestamp>` - Basic user profile information
- **Details**: `DETAIL#<detailType>#<timestamp>` - Additional user details with type categorization 
- **Activities**: `ACTIVITY#<activityType>#<timestamp>` - User activities with type categorization

This structure enables:
1. Storing different entity types in the same table (single-table design)
2. Efficient querying of all items for a specific user 
3. Filtering items by type using sort key prefixes
4. Querying across users for specific item types using the GSI

### Query Patterns

The demo supports these query patterns:

1. **Get a specific item**: Get an item by its exact partition key and sort key
2. **Query all items for a user**: Get all items for a specific userId
3. **Query filtered items for a user**: Get items for a userId with a specific sort key prefix
4. **Query by sort key pattern**: Get items across users with a specific sort key pattern (using GSI)

### Example Operations

#### Creating Different Item Types

```json
// Create a user profile
{
  "operation": "createProfile",
  "userId": "user123",
  "name": "John Doe",
  "email": "john@example.com"
}

// Add a detail to a user
{
  "operation": "addDetail",
  "userId": "user123",
  "detailType": "address",
  "description": "123 Main St, Anytown, USA"
}

// Add an activity for a user
{
  "operation": "addActivity",
  "userId": "user123",
  "activityType": "login",
  "description": "User logged in from mobile device"
}
```

#### Querying Items

```json
// Get all items for a user
{
  "operation": "queryUser",
  "userId": "user123"
}

// Get all DETAIL items for a user
{
  "operation": "queryUser",
  "userId": "user123",
  "skPrefix": "DETAIL"
}

// Get all login activities for a user
{
  "operation": "queryUser",
  "userId": "user123",
  "skPrefix": "ACTIVITY#login"
}

// Get address details for all users (using GSI)
{
  "operation": "queryBySort",
  "skPrefix": "DETAIL#address"
}
```

## API Endpoints

### GET /api/users

Returns items from the database with optional filtering:

- `GET /api/users` - Returns all items (scan operation)
- `GET /api/users?userId=user123` - Returns all items for a specific user
- `GET /api/users?userId=user123&skPrefix=DETAIL` - Returns all detail items for a user
- `GET /api/users?queryType=bySort&skPrefix=ACTIVITY` - Returns all activity items across users

### POST /api/users

Performs various DynamoDB operations based on the `operation` field in the request body.

#### Create a user profile

```json
{
  "operation": "createProfile",
  "userId": "user123",  // Optional, will be auto-generated if omitted
  "name": "John Doe",
  "email": "john@example.com",
  "age": 30,
  "ttl": 3600 // Optional, specifies TTL in seconds
}
```

#### Add a user detail

```json
{
  "operation": "addDetail",
  "userId": "user123",
  "detailType": "address",
  "description": "123 Main St, Anytown, USA",
  "ttl": 3600 // Optional
}
```

#### Add a user activity

```json
{
  "operation": "addActivity",
  "userId": "user123",
  "activityType": "login",
  "description": "User logged in from mobile device",
  "ttl": 3600 // Optional
}
```

#### Get an item by composite key

```json
{
  "operation": "get",
  "userId": "user123",
  "sk": "PROFILE#2023-01-01T12:00:00.000Z"
}
```

#### Query items for a user

```json
{
  "operation": "queryUser",
  "userId": "user123",
  "skPrefix": "DETAIL" // Optional, filters by sort key prefix
}
```

#### Query by sort key pattern (using GSI)

```json
{
  "operation": "queryBySort",
  "skPrefix": "ACTIVITY#login"
}
```

#### Update an item

```json
{
  "operation": "update",
  "userId": "user123",
  "sk": "PROFILE#2023-01-01T12:00:00.000Z",
  "name": "Updated Name",
  "email": "updated@example.com",
  "ttl": 7200 // Optional
}
```

#### Delete an item

```json
{
  "operation": "delete",
  "userId": "user123",
  "sk": "PROFILE#2023-01-01T12:00:00.000Z"
}
```

## Learning DynamoDB

This project demonstrates several key aspects of working with DynamoDB:

1. **Single-Table Design**: All data types (profiles, details, activities) are stored in a single table
2. **Composite Primary Key**: The table uses a composite key (partition key + sort key)
3. **Sort Key Patterns**: Different patterns create hierarchical relationships between items
4. **Global Secondary Indexes**: Enable additional access patterns beyond the primary key
5. **Time-to-Live (TTL)**: Automatic item expiration for temporary data
6. **DynamoDB Operations**: Examples of all major DynamoDB operations with composite keys

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
