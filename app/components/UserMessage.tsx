'use client';

interface UserMessageProps {
  content: string;
}

export default function UserMessage({ content }: UserMessageProps) {
  return (
    <div className="flex justify-end mb-4">
      <div className="bg-primary text-primary-foreground p-3 rounded-lg max-w-[80%]">
        <p className="whitespace-pre-wrap break-words">{content}</p>
      </div>
    </div>
  );
}