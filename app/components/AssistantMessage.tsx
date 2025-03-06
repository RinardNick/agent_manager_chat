'use client';

import { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface AssistantMessageProps {
  content: string;
  thinking?: string;
  toolCalls?: Array<{
    toolName: string;
    toolInput: Record<string, any>;
    status?: 'running' | 'complete' | 'error';
    toolId?: string;
  }>;
  toolResults?: Array<{
    toolName: string;
    result: any;
    toolId?: string;
  }>;
  error?: string;
  status: 'complete' | 'streaming' | 'error';
}

// Helper function to parse code blocks from markdown-style code blocks
const parseCodeBlocks = (text: string) => {
  if (typeof text !== 'string') return text;

  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  const segments = [];
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Add text before the code block
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    // Add the code block
    segments.push({
      type: 'code',
      language: match[1] || 'plaintext',
      content: match[2].trim(),
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after the last code block
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: text }];
};

export default function AssistantMessage({
  content,
  thinking,
  toolCalls,
  toolResults,
  error,
  status,
}: AssistantMessageProps) {
  // Initialize expandedTools with default values when toolCalls changes
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>(
    {}
  );

  // Initialize default expansion state when toolCalls change
  useEffect(() => {
    if (toolCalls && toolCalls.length > 0) {
      const initialState = toolCalls.reduce((state, _, index) => {
        state[index] = toolCalls.length <= 2; // Auto-expand if there are 2 or fewer tools
        return state;
      }, {} as Record<string, boolean>);

      setExpandedTools(initialState);
    }
  }, [toolCalls]);

  const toggleTool = (toolIndex: number) => {
    setExpandedTools(prev => ({
      ...prev,
      [toolIndex]: !prev[toolIndex],
    }));
  };

  // Render the content with syntax highlighting for code blocks
  const renderContent = (text: string | any) => {
    if (typeof text !== 'string') {
      return JSON.stringify(text, null, 2);
    }

    const segments = parseCodeBlocks(text);

    return segments.map((segment, index) => {
      if (segment.type === 'code') {
        return (
          <div key={index} className="my-2">
            <SyntaxHighlighter
              language={segment.language}
              style={oneDark}
              className={`rounded text-sm language-${segment.language}`}
              data-testid="code-block"
              data-language={segment.language}
            >
              {segment.content}
            </SyntaxHighlighter>
          </div>
        );
      } else {
        return <span key={index}>{segment.content}</span>;
      }
    });
  };

  // Render status indicator based on tool status
  const renderToolStatus = (status?: string) => {
    if (!status || status === 'complete') {
      return (
        <span
          className="flex items-center text-xs text-green-500 ml-2"
          data-testid="tool-status-complete"
        >
          <svg
            className="w-3 h-3 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          Complete
        </span>
      );
    } else if (status === 'running') {
      return (
        <span
          className="flex items-center text-xs text-blue-500 ml-2 animate-pulse"
          data-testid="tool-status-running"
        >
          <svg
            className="w-3 h-3 mr-1 animate-spin"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Running
        </span>
      );
    } else if (status === 'error') {
      return (
        <span
          className="flex items-center text-xs text-red-500 ml-2"
          data-testid="tool-status-error"
        >
          <svg
            className="w-3 h-3 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Error
        </span>
      );
    }
    return null;
  };

  return (
    <div className="flex mb-4">
      <div className="bg-secondary text-secondary-foreground p-3 rounded-lg max-w-[80%]">
        {/* Thinking section */}
        {thinking && (
          <div className="mb-2 text-muted-foreground italic p-2 bg-muted/50 rounded">
            <p className="text-xs mb-1 font-medium">Thinking...</p>
            <p className="whitespace-pre-wrap break-words text-sm">
              {thinking}
            </p>
          </div>
        )}

        {/* Tool calls section */}
        {toolCalls && toolCalls.length > 0 && (
          <div className="mb-2">
            {toolCalls.map((tool, index) => {
              const isExpanded = expandedTools[index] || false;

              // Match by tool ID if available, otherwise fall back to tool name
              const matchingResult = toolResults?.find(
                result =>
                  (tool.toolId &&
                    result.toolId &&
                    tool.toolId === result.toolId) ||
                  result.toolName === tool.toolName
              );

              return (
                <div
                  key={`${tool.toolName}-${index}`}
                  className="my-1 p-2 border border-border rounded bg-muted/50"
                >
                  <button
                    onClick={() => toggleTool(index)}
                    className="flex justify-between w-full text-left font-medium text-sm items-center"
                  >
                    <div className="flex items-center">
                      <span>{tool.toolName}</span>
                      {renderToolStatus(tool.status)}
                    </div>
                    <span>{isExpanded ? '▼' : '►'}</span>
                  </button>

                  {isExpanded && (
                    <div className="mt-2">
                      <p className="text-xs mb-1 font-medium">Input:</p>
                      <pre className="text-xs p-2 bg-muted rounded overflow-x-auto">
                        {JSON.stringify(tool.toolInput, null, 2)}
                      </pre>

                      {matchingResult && (
                        <>
                          <p className="text-xs mt-2 mb-1 font-medium">
                            Result:
                          </p>
                          <div className="text-xs p-2 bg-muted rounded overflow-x-auto">
                            {typeof matchingResult.result === 'string'
                              ? renderContent(matchingResult.result)
                              : JSON.stringify(matchingResult.result, null, 2)}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Message content */}
        {status === 'streaming' ? (
          <div data-testid="assistant-message-streaming">
            <p className="whitespace-pre-wrap break-words">
              {renderContent(content)}
            </p>
            <div className="mt-1 flex items-center gap-1">
              <div className="h-1.5 w-1.5 bg-primary rounded-full animate-pulse"></div>
              <div className="h-1.5 w-1.5 bg-primary rounded-full animate-pulse delay-150"></div>
              <div className="h-1.5 w-1.5 bg-primary rounded-full animate-pulse delay-300"></div>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">
            {renderContent(content)}
          </p>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-2 p-2 bg-destructive/10 border border-destructive text-destructive rounded">
            <p className="text-sm font-medium">Error:</p>
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
