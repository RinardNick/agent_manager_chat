import { BasicChatDemo } from '../components/BasicChatDemo';

export default function BasicChatPage() {
  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Basic Chat (MCP Bypassed)</h1>
        <p className="mb-8 text-gray-600">
          This is a simplified chat interface that doesn't use MCP for tool
          discovery. It demonstrates that basic chat functionality works
          correctly without the need for MCP initialization.
        </p>

        <BasicChatDemo />

        <div className="mt-8 p-4 border rounded bg-white">
          <h2 className="text-lg font-medium mb-2">Implementation Notes</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              This chat uses a simplified API endpoint at{' '}
              <code>/api/chat/basic-session</code>
            </li>
            <li>
              The simplified endpoint completely bypasses the
              @rinardnick/client_mcp package
            </li>
            <li>
              Sessions are stored in memory with basic message history tracking
            </li>
            <li>No tool capabilities are used in this implementation</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
