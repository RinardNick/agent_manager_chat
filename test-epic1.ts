import { SessionManager, LLMConfig } from '@rinardnick/ts-mcp-client';

async function testEpic1() {
  // Test 1.1: Configuration Validation
  console.log('\nTesting 1.1: Configuration Validation');
  const config: LLMConfig = {
    type: 'claude',
    api_key: process.env.ANTHROPIC_API_KEY || '',
    system_prompt: 'You are a helpful assistant.',
    model: 'claude-3-5-sonnet-20241022',
  };

  if (!config.api_key) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  // Test 1.2: Session Initialization
  console.log('\nTesting 1.2: Session Initialization');
  const sessionManager = new SessionManager();
  const session = await sessionManager.initializeSession(config);
  console.log('Session created:', session.id);
  console.log('Initial messages:', session.messages);

  // Test 1.3 & 1.4: Send Message and Get Response
  console.log('\nTesting 1.3 & 1.4: Message Handling');
  const message = 'Hello! Please respond with a short greeting.';
  console.log('Sending message:', message);

  // Test 1.5: Streaming Response
  console.log('\nTesting 1.5: Streaming Response');
  let responseContent = '';
  for await (const chunk of sessionManager.sendMessageStream(
    session.id,
    message
  )) {
    if (chunk.type === 'content' && chunk.content) {
      responseContent += chunk.content;
      console.log('Received chunk:', chunk.content);
    } else if (chunk.type === 'error') {
      console.error('Error:', chunk.error);
    } else if (chunk.type === 'done') {
      console.log('Stream completed');
    }
  }

  // Test 1.6: Error Handling
  console.log('\nTesting 1.6: Error Handling');
  try {
    await sessionManager.sendMessage('invalid-session-id', 'This should fail');
  } catch (error) {
    console.log(
      'Expected error caught:',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }

  console.log('\nAll tests completed successfully!');
}

// Run the tests
testEpic1().catch(console.error);
