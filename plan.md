# Client MCP Integration Plan

## Overview

This plan outlines the steps to refactor our codebase to better utilize the `@rinardnick/client_mcp` package, removing duplicated functionality and focusing on UI-specific concerns.

## Goals

1. Remove duplicated functionality that's handled by client_mcp
2. Improve error handling and state management
3. Better streaming support for real-time updates
4. Cleaner separation of concerns between UI and core functionality

## Implementation Checklist

### Phase 1: Remove Duplicated Code ✅

- [x] Configuration Management

  - [x] Remove custom config validation
  - [x] Use client_mcp types (LLMConfig, ServerConfig)
  - [x] Update config loading to use client_mcp's loadConfig
  - [x] Remove MCPConfig interface

- [x] Server Management

  - [x] Remove server launcher code
  - [x] Remove server health check code
  - [x] Remove server capability discovery
  - [x] Update tests to use client_mcp mocks

- [x] Session Management
  - [x] Remove duplicate session state tracking
  - [x] Remove message history management
  - [x] Remove tool call tracking
  - [x] Update tests for simplified session management

### Phase 2: Enhance UI Integration (In Progress)

- [x] UI State Management

  - [x] Create UIState interface

  ```typescript
  interface UIState {
    isLoading: boolean;
    isThinking: boolean;
    error: string | null;
    currentTool?: string;
  }
  ```

  - [x] Implement UI state management methods
  - [x] Add UI state tests

- [x] Streaming Support

  - [x] Implement streaming message handling
  - [x] Add progress indicators for tool execution
  - [x] Add real-time content updates
  - [x] Add streaming-specific tests

- [x] Error Handling
  - [x] Implement error type mapping
  - [x] Add UI error presentation
  - [x] Add error recovery mechanisms
  - [x] Add error handling tests

### Phase 3: Add Advanced Features

- [ ] Session Recovery

  - [ ] Implement session persistence
  - [ ] Add session recovery logic
  - [ ] Add session cleanup
  - [ ] Add recovery tests

- [ ] Performance Optimization

  - [ ] Add capability caching
  - [ ] Implement lazy server initialization
  - [ ] Add performance tests

- [ ] Monitoring & Debugging
  - [ ] Add session activity logging
  - [ ] Add tool execution metrics
  - [ ] Add error tracking
  - [ ] Add monitoring tests

## File Changes Required

1. `app/lib/config.ts` ✅

   - [x] Remove custom validation
   - [x] Use client_mcp types
   - [x] Update exports

2. `app/lib/sessionManager.ts` ✅

   - [x] Simplify to UI state management
   - [x] Remove server management
   - [x] Add streaming support

3. `app/lib/serverManagement.test.ts` ✅

   - [x] Convert to UI state tests
   - [x] Remove server management tests

4. `app/lib/sessionPersistence.test.ts` ✅

   - [x] Update for new session management
   - [x] Add UI state persistence tests

5. New Files:
   - [x] `app/lib/uiState.ts`
   - [x] `app/lib/errorHandling.ts`
   - [ ] `app/lib/streaming.ts`

## Testing Strategy

1. Unit Tests:

   - UI state management
   - Error handling
   - Streaming updates

2. Integration Tests:

   - Session lifecycle
   - Tool execution flow
   - Error recovery

3. End-to-End Tests:
   - Complete chat flow
   - Server interaction
   - UI updates

## Migration Steps

1. Create Feature Branch

   ```bash
   git checkout -b refactor/client-mcp-integration
   ```

2. For each phase:
   a. Implement changes
   b. Add/update tests
   c. Verify functionality
   d. Create PR
   e. Review & merge

3. Documentation:
   - Update README
   - Add migration guide
   - Update API documentation

## Success Criteria

1. All tests passing
2. No duplicate functionality
3. Improved error handling
4. Better real-time updates
5. Cleaner codebase
6. Documented API
7. Performance improvements

## Rollback Plan

1. Keep old implementation in separate branch
2. Document all changes
3. Have backup of current state
4. Plan incremental rollout

## Timeline

1. Phase 1: 2-3 days
2. Phase 2: 2-3 days
3. Phase 3: 2-3 days
4. Testing & Documentation: 1-2 days

Total: 7-11 days
