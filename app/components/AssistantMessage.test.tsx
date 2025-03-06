import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AssistantMessage from './AssistantMessage';

describe('AssistantMessage', () => {
  it('renders content correctly', () => {
    render(<AssistantMessage content="Hello world" status="complete" />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders thinking section when provided', () => {
    render(
      <AssistantMessage
        content="Final answer"
        thinking="I'm thinking about this..."
        status="complete"
      />
    );
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
    expect(screen.getByText("I'm thinking about this...")).toBeInTheDocument();
  });

  it('renders tool calls in collapsible sections', () => {
    const toolCalls = [
      {
        toolName: 'search',
        toolInput: { query: 'weather today' },
      },
    ];

    const toolResults = [
      {
        toolName: 'search',
        result: 'It is sunny today with a high of 75°F.',
      },
    ];

    const { container } = render(
      <AssistantMessage
        content="Here's the weather"
        toolCalls={toolCalls}
        toolResults={toolResults}
        status="complete"
      />
    );

    // Check if tool name is displayed
    expect(screen.getByText('search')).toBeInTheDocument();

    // Tool should be expanded by default (since there's only one)
    const inputLabel = screen.getByText('Input:');
    expect(inputLabel).toBeInTheDocument();
    expect(screen.getByText(/"query": "weather today"/)).toBeInTheDocument();
    expect(screen.getByText('Result:')).toBeInTheDocument();
    expect(
      screen.getByText('It is sunny today with a high of 75°F.')
    ).toBeInTheDocument();

    // Get collapse/expand button for the tool
    const toolButton = screen.getByText('search').closest('button');
    expect(toolButton).not.toBeNull();

    // Click to collapse
    fireEvent.click(toolButton!);

    // Input and result content should no longer be visible
    expect(
      screen.queryByText(/"query": "weather today"/)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('It is sunny today with a high of 75°F.')
    ).not.toBeInTheDocument();
  });

  it('should highlight code blocks in tool results', () => {
    const toolCalls = [
      {
        toolName: 'executeCode',
        toolInput: { code: 'console.log("Hello")' },
      },
    ];

    const toolResults = [
      {
        toolName: 'executeCode',
        result:
          '```javascript\nconsole.log("Test");\nconst x = 42;\n```\nExecution successful',
      },
    ];

    render(
      <AssistantMessage
        content="Code result"
        toolCalls={toolCalls}
        toolResults={toolResults}
        status="complete"
      />
    );

    // Code block should be highlighted with appropriate class
    const codeElements = screen.getAllByTestId('code-block');
    expect(codeElements.length).toBeGreaterThan(0);
    expect(codeElements[0]).toHaveClass('language-javascript');
    expect(codeElements[0]).toHaveTextContent('console.log("Test");');
  });

  it('should display tool execution status indicators', () => {
    const toolCalls = [
      {
        toolName: 'calculate',
        toolInput: { expression: '2+2' },
        status: 'running' as const,
      },
    ];

    render(
      <AssistantMessage
        content="Calculating..."
        toolCalls={toolCalls}
        status="streaming"
      />
    );

    // Should show a running indicator
    const statusIndicator = screen.getByTestId('tool-status-running');
    expect(statusIndicator).toBeInTheDocument();
  });
});
