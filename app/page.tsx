'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Chat Application</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white shadow rounded-lg p-6 border border-gray-200">
            <h2 className="text-xl font-semibold mb-3">
              MCP Tool Discovery Issue
            </h2>
            <p className="text-gray-700 mb-4">
              There's currently an issue with the MCP tool discovery process.
              When attempting to discover tools, the application encounters a
              "Method not found" error from the MCP client.
            </p>
            <ul className="list-disc pl-5 mb-4 text-gray-700">
              <li>Error code: -32601</li>
              <li>Error message: MCP error -32601: Method not found</li>
            </ul>
            <p className="text-gray-700 mb-4">
              As a workaround, we've created a simplified version of the chat
              interface that doesn't use MCP for tool discovery.
            </p>
            <Link
              href="/basic-chat"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Try Basic Chat Demo
            </Link>
          </div>

          <div className="bg-white shadow rounded-lg p-6 border border-gray-200">
            <h2 className="text-xl font-semibold mb-3">Next Steps</h2>
            <p className="text-gray-700 mb-4">
              To resolve the MCP tool discovery issue, consider these potential
              approaches:
            </p>
            <ol className="list-decimal pl-5 mb-4 text-gray-700 space-y-2">
              <li>
                Update the @rinardnick/client_mcp package to the latest version
              </li>
              <li>
                Check if the server implementation is compatible with the MCP
                protocol
              </li>
              <li>
                Ensure the correct servers are configured in the config.json
                file
              </li>
              <li>
                Verify that server commands are accessible and executable in the
                current environment
              </li>
              <li>Implement a custom tool discovery mechanism if needed</li>
            </ol>
            <p className="text-gray-700">
              For now, the basic chat interface provides core functionality
              while these issues are being resolved.
            </p>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-800 mb-2">
            Implementation Note
          </h3>
          <p className="text-yellow-700">
            The application has been configured to default to skipping MCP tool
            discovery due to the current issues. This ensures that basic chat
            functionality works correctly while the tool discovery issues are
            being addressed.
          </p>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-3">
            Available Chat Interfaces
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/chat"
              className="block p-4 bg-white shadow rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-medium mb-2">Original Chat Interface</h3>
              <p className="text-gray-700 text-sm">
                The original chat interface that attempts to use MCP for tool
                discovery. May encounter errors with current configuration.
              </p>
            </Link>

            <Link
              href="/basic-chat"
              className="block p-4 bg-white shadow rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-medium mb-2">Basic Chat Interface</h3>
              <p className="text-gray-700 text-sm">
                A simplified chat interface that bypasses MCP tool discovery.
                Provides core chat functionality without tools.
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
