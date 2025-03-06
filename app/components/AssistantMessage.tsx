'use client';

import { useState } from 'react';

interface AssistantMessageProps {
  content: string;
  thinking?: string;
  toolCalls?: Array<{
    toolName: string;
    toolInput: Record<string, any>;
  }>;
  toolResults?: Array<{
    toolName: string;
    result: any;
  }>;
  error?: string;
  status: 'complete' | 'streaming' | 'error';
}

export default function AssistantMessage({
  content,
  thinking,
  toolCalls,
  toolResults,
  error,
  status,
}: AssistantMessageProps) {
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

  const toggleTool = (toolIndex: number) => {
    setExpandedTools(prev => ({
      ...prev,
      [toolIndex]: !prev[toolIndex]
    }));
  };

  return (
    <div className="flex mb-4">
      <div className="bg-secondary text-secondary-foreground p-3 rounded-lg max-w-[80%]">
        {/* Thinking section */}
        {thinking && (
          <div className="mb-2 text-muted-foreground italic p-2 bg-muted/50 rounded">
            <p className="text-xs mb-1 font-medium">Thinking...</p>
            <p className="whitespace-pre-wrap break-words text-sm">{thinking}</p>
          </div>
        )}

        {/* Tool calls section */}
        {toolCalls && toolCalls.length > 0 && (
          <div className="mb-2">
            {toolCalls.map((tool, index) => {
              const isExpanded = expandedTools[index] ?? false;
              // Match by tool ID if available, otherwise fall back to tool name
              const matchingResult = toolResults?.find(
                result => 
                  (tool.toolId && result.toolId && tool.toolId === result.toolId) || 
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
                    <span>{tool.toolName}</span>
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
                          <p className="text-xs mt-2 mb-1 font-medium">Result:</p>
                          <pre className="text-xs p-2 bg-muted rounded overflow-x-auto">
                            {typeof matchingResult.result === 'string' 
                              ? matchingResult.result
                              : JSON.stringify(matchingResult.result, null, 2)}
                          </pre>
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
            <p className="whitespace-pre-wrap break-words">{content}</p>
            <div className="mt-1 flex items-center gap-1">
              <div className="h-1.5 w-1.5 bg-primary rounded-full animate-pulse"></div>
              <div className="h-1.5 w-1.5 bg-primary rounded-full animate-pulse delay-150"></div>
              <div className="h-1.5 w-1.5 bg-primary rounded-full animate-pulse delay-300"></div>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">{content}</p>
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