import SimpleChatInterface from './components/SimpleChatInterface';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      <h1 className="text-2xl font-bold mb-4">Simple Chat Interface</h1>
      <SimpleChatInterface />
    </main>
  );
}
