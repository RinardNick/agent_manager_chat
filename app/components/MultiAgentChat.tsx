'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { 
  Loader2, 
  PenToolIcon as Tool, 
  GitBranch, 
  ArrowRight, 
  Plus, 
  Edit2,
  MessageSquareShare,
} from 'lucide-react';

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'thinking' | 'tool';
  content: string;
  isStreaming?: boolean;
};

type Agent = {
  id: string;
  name: string;
  conversation: Message[];
  parentId: string | null;
  childrenIds: string[];
  x: number;
  y: number;
  status: 'active' | 'inactive' | 'error';
  tokens: number;
  sessionId?: string;
};

const VERTICAL_SPACING = 150;
const HORIZONTAL_SPACING = 200;

export default function MultiAgentChat() {
  const [input, setInput] = useState('');
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [status, setStatus] = useState<'awaiting_message' | 'in_progress' | 'awaiting_tool'>(
    'awaiting_message'
  );
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggingAgentId, setDraggingAgentId] = useState<string | null>(null);
  const [chatTitle, setChatTitle] = useState('AI Multi-Agent Interface');
  const [editingTitle, setEditingTitle] = useState(false);
  const [showAgentInteraction, setShowAgentInteraction] = useState(false);
  const [interactionTarget, setInteractionTarget] = useState<string | null>(null);
  const [interactionMessage, setInteractionMessage] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Create initial agent on component mount
  useEffect(() => {
    createInitialAgent();
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [agents, activeAgentId]);

  // Create initial agent and initialize chat session
  const createInitialAgent = async () => {
    try {
      // Create a new chat session
      const response = await fetch('/api/chat/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create chat session');
      }

      const data = await response.json();
      const sessionId = data.sessionId;

      const initialAgent: Agent = {
        id: 'agent-1',
        name: 'Primary Agent',
        parentId: null,
        childrenIds: [],
        x: 0,
        y: 0,
        status: 'active',
        tokens: 0,
        sessionId,
        conversation: [],
      };

      setAgents([initialAgent]);
      setActiveAgentId(initialAgent.id);
    } catch (error) {
      console.error('Error creating initial agent:', error);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && activeAgentId) {
      const currentAgent = agents.find(agent => agent.id === activeAgentId);
      if (!currentAgent || !currentAgent.sessionId) return;

      const newMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: input,
      };

      // Add user message to conversation
      setAgents(prevAgents =>
        prevAgents.map(agent =>
          agent.id === activeAgentId
            ? {
                ...agent,
                conversation: [...agent.conversation, newMessage],
                tokens: agent.tokens + input.length,
              }
            : agent
        )
      );

      // Clear input and set status
      setInput('');
      setStatus('in_progress');

      // Add thinking message
      const thinkingMessage: Message = {
        id: `thinking-${Date.now()}`,
        role: 'thinking',
        content: 'Processing your request...',
      };
      
      setAgents(prevAgents =>
        prevAgents.map(agent =>
          agent.id === activeAgentId
            ? {
                ...agent,
                conversation: [...agent.conversation, thinkingMessage],
              }
            : agent
        )
      );

      try {
        // Create message streaming from the API
        const eventSource = new EventSource(
          `/api/chat/session/${currentAgent.sessionId}/stream?message=${encodeURIComponent(input)}`
        );

        // Add streaming message placeholder
        const streamingMessageId = `streaming-${Date.now()}`;
        const streamingMessage: Message = {
          id: streamingMessageId,
          role: 'assistant',
          content: '',
          isStreaming: true,
        };

        setAgents(prevAgents =>
          prevAgents.map(agent =>
            agent.id === activeAgentId
              ? {
                  ...agent,
                  conversation: [...agent.conversation.filter(m => m.role !== 'thinking'), streamingMessage],
                }
              : agent
          )
        );

        // Handle incoming stream data
        eventSource.addEventListener('message', event => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'content') {
              // Update streaming message content
              setAgents(prevAgents =>
                prevAgents.map(agent => {
                  if (agent.id === activeAgentId) {
                    return {
                      ...agent,
                      conversation: agent.conversation.map(msg => 
                        msg.id === streamingMessageId
                          ? { ...msg, content: msg.content + data.content }
                          : msg
                      ),
                    };
                  }
                  return agent;
                })
              );
            } else if (data.type === 'tool_start') {
              // Add tool execution message
              const toolMessage: Message = {
                id: `tool-${Date.now()}`,
                role: 'tool',
                content: `Using tool: ${data.content}`,
              };
              
              setAgents(prevAgents =>
                prevAgents.map(agent =>
                  agent.id === activeAgentId
                    ? {
                        ...agent,
                        conversation: [...agent.conversation, toolMessage],
                      }
                    : agent
                )
              );
            } else if (data.type === 'tool_result') {
              // Add tool result message
              const resultMessage: Message = {
                id: `result-${Date.now()}`,
                role: 'tool',
                content: `Result: ${data.content}`,
              };
              
              setAgents(prevAgents =>
                prevAgents.map(agent =>
                  agent.id === activeAgentId
                    ? {
                        ...agent,
                        conversation: [...agent.conversation, resultMessage],
                      }
                    : agent
                )
              );
            } else if (data.type === 'done') {
              // Mark streaming as complete
              setAgents(prevAgents =>
                prevAgents.map(agent => {
                  if (agent.id === activeAgentId) {
                    return {
                      ...agent,
                      conversation: agent.conversation.map(msg => 
                        msg.id === streamingMessageId
                          ? { ...msg, isStreaming: false }
                          : msg
                      ),
                    };
                  }
                  return agent;
                })
              );
              
              // Close connection and update status
              eventSource.close();
              setStatus('awaiting_message');
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          } catch (error) {
            console.error('Error processing message:', error);
            eventSource.close();
            setStatus('awaiting_message');
          }
        });

        // Handle errors
        eventSource.addEventListener('error', () => {
          console.error('EventSource error');
          eventSource.close();
          setStatus('awaiting_message');
        });
      } catch (error) {
        console.error('Error sending message:', error);
        setStatus('awaiting_message');
      }
    }
  };

  // Handle creating new agents (branching)
  const handleBranchConversation = async (type: 'parent' | 'child' | 'new') => {
    if (activeAgentId || type === 'new') {
      try {
        // Create a new chat session
        const response = await fetch('/api/chat/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to create chat session');
        }

        const data = await response.json();
        const sessionId = data.sessionId;

        const currentAgent = agents.find(agent => agent.id === activeAgentId);
        const newAgentId = `agent-${agents.length + 1}`;
        let newX = 0;
        let newY = 0;
        let parentSessionId: string | null = null;
        let childSessionId: string | null = null;

        if (type === 'child' && currentAgent) {
          const siblings = agents.filter(agent => agent.parentId === currentAgent.id);
          newX = currentAgent.x + (siblings.length + 1) * HORIZONTAL_SPACING;
          newY = currentAgent.y + VERTICAL_SPACING;
          
          // Set parent/child relationship for API
          parentSessionId = currentAgent.sessionId || null;
          childSessionId = sessionId;
        } else if (type === 'parent' && currentAgent) {
          newX = currentAgent.x;
          newY = currentAgent.y - VERTICAL_SPACING;
          
          // For parent relationship, the new agent is parent of current
          parentSessionId = sessionId;
          childSessionId = currentAgent.sessionId || null;
        } else {
          newX = (Math.random() - 0.5) * 1000;
          newY = (Math.random() - 0.5) * 1000;
        }

        const newAgent: Agent = {
          id: newAgentId,
          name: `Agent ${agents.length + 1}`,
          conversation: currentAgent ? [...currentAgent.conversation] : [],
          parentId: type === 'child' ? activeAgentId : type === 'parent' ? currentAgent?.parentId : null,
          childrenIds: [],
          x: newX,
          y: newY,
          status: 'active',
          tokens: 0,
          sessionId,
        };

        setAgents(prev => {
          const updatedAgents = [...prev, newAgent];
          return updatedAgents.map(agent => {
            if (type === 'child' && agent.id === activeAgentId) {
              return { ...agent, childrenIds: [...agent.childrenIds, newAgentId] };
            }
            if (type === 'parent' && agent.id === currentAgent?.parentId) {
              return { ...agent, childrenIds: [...agent.childrenIds, newAgentId] };
            }
            return agent;
          });
        });

        // Register the agent relationship if it's a parent/child relationship
        if (parentSessionId && childSessionId) {
          try {
            const relationResponse = await fetch('/api/agent', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                parentSessionId,
                childSessionId,
              }),
            });
            
            if (!relationResponse.ok) {
              console.warn('Failed to register agent relationship');
            } else {
              console.log('Agent relationship registered successfully');
            }
          } catch (relationError) {
            console.error('Error registering agent relationship:', relationError);
          }
        }

        setActiveAgentId(newAgent.id);

      } catch (error) {
        console.error('Error branching conversation:', error);
      }
    }
  };
  
  // Send a message from one agent to another
  const sendAgentToAgentMessage = async (fromAgentId: string, toAgentId: string, message: string) => {
    try {
      const fromAgent = agents.find(agent => agent.id === fromAgentId);
      const toAgent = agents.find(agent => agent.id === toAgentId);
      
      if (!fromAgent || !toAgent || !fromAgent.sessionId || !toAgent.sessionId) {
        console.error('Invalid agent IDs or missing session IDs');
        return;
      }
      
      // Call the API to send message between agents
      const response = await fetch('/api/agent', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromSessionId: fromAgent.sessionId,
          toSessionId: toAgent.sessionId,
          message,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message between agents');
      }
      
      // Add the message to both agent conversations
      const messageId = Date.now().toString();
      
      // Add to sender's conversation
      setAgents(prevAgents =>
        prevAgents.map(agent =>
          agent.id === fromAgentId
            ? {
                ...agent,
                conversation: [
                  ...agent.conversation,
                  {
                    id: `sent-${messageId}`, 
                    role: 'system', 
                    content: `Sent to ${toAgent.name}: "${message}"`
                  },
                ],
              }
            : agent
        )
      );
      
      // Add to receiver's conversation
      setAgents(prevAgents =>
        prevAgents.map(agent =>
          agent.id === toAgentId
            ? {
                ...agent,
                conversation: [
                  ...agent.conversation,
                  {
                    id: `received-${messageId}`, 
                    role: 'system', 
                    content: `Received from ${fromAgent.name}: "${message}"`
                  },
                ],
              }
            : agent
        )
      );
      
      return true;
    } catch (error) {
      console.error('Error sending message between agents:', error);
      return false;
    }
  };

  // SVG interaction handlers
  const handleMouseDown = (e: React.MouseEvent<SVGElement>) => {
    const svgPoint = svgRef.current?.createSVGPoint();
    if (svgPoint) {
      svgPoint.x = e.clientX;
      svgPoint.y = e.clientY;
      const transformedPoint = svgPoint.matrixTransform(
        svgRef.current?.getScreenCTM()?.inverse()
      );

      const clickedAgent = agents.find(
        agent =>
          Math.abs(agent.x - transformedPoint.x) < 50 &&
          Math.abs(agent.y - transformedPoint.y) < 30
      );

      if (clickedAgent) {
        setDraggingAgentId(clickedAgent.id);
        setDragStart({
          x: transformedPoint.x - clickedAgent.x,
          y: transformedPoint.y - clickedAgent.y,
        });
      } else {
        setIsDragging(true);
        setDragStart({ x: transformedPoint.x - pan.x, y: transformedPoint.y - pan.y });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGElement>) => {
    const svgPoint = svgRef.current?.createSVGPoint();
    if (svgPoint) {
      svgPoint.x = e.clientX;
      svgPoint.y = e.clientY;
      const transformedPoint = svgPoint.matrixTransform(
        svgRef.current?.getScreenCTM()?.inverse()
      );

      if (isDragging) {
        setPan({
          x: transformedPoint.x - dragStart.x,
          y: transformedPoint.y - dragStart.y,
        });
      } else if (draggingAgentId) {
        setAgents(prevAgents =>
          prevAgents.map(agent =>
            agent.id === draggingAgentId
              ? {
                  ...agent,
                  x: transformedPoint.x - dragStart.x,
                  y: transformedPoint.y - dragStart.y,
                }
              : agent
          )
        );
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggingAgentId(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const newZoom = zoom - e.deltaY * 0.001;
    setZoom(Math.max(0.1, Math.min(newZoom, 2)));
  };

  // Draw connecting lines between agents
  const drawConnectingLine = (startX: number, startY: number, endX: number, endY: number) => {
    const midY = (startY + endY) / 2;
    return `M${startX},${startY} L${startX},${midY} L${endX},${midY} L${endX},${endY}`;
  };

  const activeAgent = agents.find(agent => agent.id === activeAgentId);

  return (
    <div className="flex min-h-screen bg-gray-100 p-4">
      <Card className="w-1/3 mr-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          {editingTitle ? (
            <Input
              value={chatTitle}
              onChange={e => setChatTitle(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={e => e.key === 'Enter' && setEditingTitle(false)}
              className="text-2xl font-bold"
              autoFocus
            />
          ) : (
            <CardTitle className="text-2xl font-bold flex items-center">
              {chatTitle}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingTitle(true)}
                className="ml-2"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </CardTitle>
          )}
          <div className="flex space-x-2">
            <Button size="sm" onClick={() => handleBranchConversation('parent')}>
              <GitBranch className="mr-2 h-4 w-4" />
              Parent
            </Button>
            <Button size="sm" onClick={() => handleBranchConversation('child')}>
              <ArrowRight className="mr-2 h-4 w-4" />
              Child
            </Button>
            <Button size="sm" onClick={() => handleBranchConversation('new')}>
              <Plus className="mr-2 h-4 w-4" />
              New
            </Button>
            <Button 
              size="sm" 
              onClick={() => setShowAgentInteraction(true)}
              disabled={!activeAgentId || agents.length < 2}
            >
              <MessageSquareShare className="mr-2 h-4 w-4" />
              Message
            </Button>
          </div>
        </CardHeader>
        
        {/* Agent Interaction Dialog */}
        {showAgentInteraction && activeAgentId && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
            <Card className="w-96 p-4">
              <CardHeader>
                <CardTitle>Send Message Between Agents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">From:</label>
                  <div className="p-2 bg-gray-100 rounded">
                    {agents.find(a => a.id === activeAgentId)?.name || 'Current Agent'}
                  </div>
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">To:</label>
                  <select 
                    className="w-full p-2 border rounded"
                    value={interactionTarget || ''}
                    onChange={(e) => setInteractionTarget(e.target.value)}
                  >
                    <option value="">Select an agent</option>
                    {agents
                      .filter(a => a.id !== activeAgentId)
                      .map(agent => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name} {agent.parentId === activeAgentId ? '(Child)' : 
                                        agents.find(a => a.id === activeAgentId)?.parentId === agent.id ? '(Parent)' : ''}
                        </option>
                      ))
                    }
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Message:</label>
                  <textarea 
                    className="w-full p-2 border rounded"
                    rows={3}
                    value={interactionMessage}
                    onChange={(e) => setInteractionMessage(e.target.value)}
                    placeholder="Enter message to send..."
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowAgentInteraction(false);
                    setInteractionTarget(null);
                    setInteractionMessage('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (activeAgentId && interactionTarget && interactionMessage.trim()) {
                      const success = await sendAgentToAgentMessage(
                        activeAgentId, 
                        interactionTarget, 
                        interactionMessage.trim()
                      );
                      
                      if (success) {
                        setShowAgentInteraction(false);
                        setInteractionTarget(null);
                        setInteractionMessage('');
                      }
                    }
                  }}
                  disabled={!interactionTarget || !interactionMessage.trim()}
                >
                  Send
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
        <CardContent className="h-[calc(100vh-300px)] overflow-y-auto space-y-4">
          {activeAgent?.conversation.map(message => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : message.role === 'assistant'
                    ? 'bg-gray-200 text-black'
                    : message.role === 'thinking'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {message.role === 'thinking' && (
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                )}
                {message.role === 'tool' && <Tool className="h-4 w-4 inline mr-2" />}
                {message.content}
                {message.isStreaming && (
                  <span className="ml-1 animate-pulse">▍</span>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </CardContent>
        <CardFooter>
          <form onSubmit={handleSubmit} className="flex w-full space-x-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-grow"
              disabled={status !== 'awaiting_message'}
            />
            <Button type="submit" disabled={status !== 'awaiting_message'}>
              {status === 'in_progress' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending
                </>
              ) : (
                'Send'
              )}
            </Button>
          </form>
        </CardFooter>
      </Card>
      <Card className="w-2/3">
        <CardHeader>
          <CardTitle>Agent Map</CardTitle>
        </CardHeader>
        <CardContent
          className="h-[calc(100vh-100px)] overflow-hidden"
          onWheel={handleWheel}
        >
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox="-1000 -1000 2000 2000"
            style={{
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {agents.map(agent => (
                <g key={agent.id}>
                  {agent.parentId && (
                    <path
                      d={drawConnectingLine(
                        agent.x,
                        agent.y,
                        agents.find(a => a.id === agent.parentId)?.x || 0,
                        agents.find(a => a.id === agent.parentId)?.y || 0
                      )}
                      stroke="gray"
                      strokeWidth="2"
                      fill="none"
                    />
                  )}
                  <rect
                    x={agent.x - 75}
                    y={agent.y - 40}
                    width="150"
                    height="80"
                    rx="10"
                    ry="10"
                    fill={agent.id === activeAgentId ? 'lightblue' : 'white'}
                    stroke={
                      agent.status === 'active'
                        ? 'green'
                        : agent.status === 'error'
                        ? 'red'
                        : 'gray'
                    }
                    strokeWidth="2"
                    onClick={() => setActiveAgentId(agent.id)}
                    style={{ cursor: 'pointer' }}
                  />
                  <text
                    x={agent.x}
                    y={agent.y - 15}
                    textAnchor="middle"
                    fill="black"
                    fontSize="14"
                    fontWeight="bold"
                  >
                    {agent.name}
                  </text>
                  <text
                    x={agent.x}
                    y={agent.y + 10}
                    textAnchor="middle"
                    fill="black"
                    fontSize="12"
                  >
                    Tokens: {agent.tokens}
                  </text>
                  <text
                    x={agent.x}
                    y={agent.y + 30}
                    textAnchor="middle"
                    fill="black"
                    fontSize="12"
                  >
                    Status: {agent.status}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        </CardContent>
      </Card>
    </div>
  );
}