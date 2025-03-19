#!/bin/bash

# Function to check if a container is running
is_container_running() {
  docker ps | grep $1 > /dev/null
  return $?
}

# Function to wait for a container to be ready
wait_for_container() {
  local container_name=$1
  local max_attempts=$2
  local delay=$3
  local attempt=1

  echo "Waiting for $container_name to be ready..."
  while [ $attempt -le $max_attempts ]; do
    if is_container_running $container_name; then
      echo "$container_name is running!"
      return 0
    fi
    echo "Attempt $attempt/$max_attempts: $container_name is not ready yet. Waiting $delay seconds..."
    sleep $delay
    attempt=$((attempt + 1))
  done

  echo "Failed to start $container_name after $max_attempts attempts."
  return 1
}

# Stop and remove existing container if it exists
if docker ps -a | grep local-dynamodb > /dev/null; then
  echo "Removing existing DynamoDB container..."
  docker stop local-dynamodb 2>/dev/null
  docker rm local-dynamodb 2>/dev/null
fi

# Start DynamoDB container
echo "Starting DynamoDB local container..."
docker run -d -p 8000:8000 --name local-dynamodb amazon/dynamodb-local

# Wait for container to be ready
if wait_for_container local-dynamodb 5 2; then
  echo "DynamoDB local container is up and running!"
else
  echo "Failed to start DynamoDB local container. Please check Docker."
  exit 1
fi

# Wait a bit longer for DynamoDB to initialize
echo "Waiting for DynamoDB to initialize..."
sleep 3

# Run DynamoDB setup script
echo "Setting up DynamoDB tables..."
pnpm exec tsx scripts/setup-dynamo.ts

# Start Next.js dev server
echo "Starting Next.js development server..."
pnpm dev 