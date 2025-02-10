import { Chat } from './components/Chat';

export default function Home() {
  return (
    <main className="flex min-h-screen bg-background p-4">
      <div className="flex-1">
        <Chat />
      </div>
    </main>
  );
}
