# SessionManager Singleton Implementation

This document provides information on the true singleton SessionManager implementation in the application. This implementation ensures that there's only one SessionManager instance across all API requests, which preserves session state across different API endpoints.

## What Problem Does This Solve?

Previously, each API request would create its own `SessionManager` instance, resulting in a situation where:

- Sessions created in one API route wouldn't be accessible from another API route
- Error messages like `Session not found: <session-id>` would appear when trying to use a session across different requests

The singleton pattern implemented here ensures that the same `SessionManager` instance is reused across all API routes, maintaining consistent session state.

## Implementation Details

The implementation uses Node.js's `global` object to store a single `SessionManager` instance:

```typescript
// Create a type for the global object augmentation
declare global {
  var mcpSessionManager: MCPSessionManager | undefined;
  var sessionManagerRequests: number | undefined;
}

/**
 * Gets or creates the MCP session manager instance
 */
export async function getMCPSessionManager(): Promise<MCPSessionManager> {
  // Check if the manager already exists in the global object
  if (!global.mcpSessionManager) {
    console.log('[SERVER] Creating new global SessionManager instance');

    // Initialize a new instance
    // ...
    global.mcpSessionManager = new MCPSessionManager({
      useSharedServers: true,
    });

    // Initialize the request counter
    global.sessionManagerRequests = 1;
  } else {
    // Increment the counter if the manager already exists
    global.sessionManagerRequests = (global.sessionManagerRequests || 0) + 1;
    console.log(
      `[SERVER] Reusing existing global SessionManager instance (request ${global.sessionManagerRequests})`
    );
  }

  return global.mcpSessionManager;
}
```

## How to Verify the Singleton Behavior

There are several ways to verify that the singleton implementation is working correctly:

### 1. Using the Test API Endpoint

The easiest way to test the singleton behavior is to use the `/api/test-singleton` endpoint:

```bash
curl http://localhost:3000/api/test-singleton
```

This will return a JSON response with information about the singleton status:

```json
{
  "success": true,
  "isSingleton": true,
  "requestCount": 3,
  "sessionTest": {
    "success": true,
    "sessionId": "example-session-id",
    "error": ""
  },
  "managerProperties": [...],
  "timestamp": "2023-08-08T12:34:56.789Z"
}
```

- `isSingleton`: Should be `true` if the singleton pattern is working
- `requestCount`: Shows how many times the SessionManager has been accessed
- `sessionTest`: Contains the results of creating and accessing a session

### 2. Checking Server Logs

When the application is running, you can check the server logs for messages like:

```
[SERVER] Creating new global SessionManager instance
[SERVER] Reusing existing global SessionManager instance (request 2)
[SERVER] Reusing existing global SessionManager instance (request 3)
```

This indicates that the SessionManager is being reused rather than recreated.

### 3. Running Unit Tests

The project includes unit tests specifically for the singleton behavior:

```bash
npm test -- serverSessionManager.test.ts
```

These tests verify that:

- The SessionManager is properly stored in the global object
- Multiple calls return the same instance
- The request counter increments correctly

### 4. Integration Testing

For a more comprehensive test, there's an integration test that simulates multiple API endpoints using the same SessionManager:

```bash
npm test -- singleton-integration.test.ts
```

This test verifies that:

- Sessions created in one "API endpoint" can be accessed from another
- Messages can be sent to a session from different places
- Session initialization works correctly

## Limitations

It's important to understand the limitations of this implementation:

1. **Server Restarts**: The singleton exists only as long as the server is running. If the server restarts, all in-memory sessions will be lost.

2. **Multiple Server Instances**: In a horizontally scaled environment with multiple server instances, each instance will have its own singleton. For true multi-instance session sharing, a distributed storage solution (like Redis) would be needed.

3. **Development Mode**: In Next.js development mode, hot reloading may reset the global singleton. The singleton behavior is most reliable in production mode.

## Troubleshooting

If you encounter issues with the singleton implementation:

1. Check that all API routes are using the `getMCPSessionManager()` function from `app/lib/serverSessionManager.ts`
2. Verify that no code is directly instantiating the SessionManager class
3. Look for any module reloading or dynamic imports that might create new instances
4. Check server logs for evidence of multiple SessionManager instances being created
