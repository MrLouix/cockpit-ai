import React, { useEffect, useRef } from 'react';
import type { Task } from '../types';
import { ChatMessage } from './ChatMessage';

interface ChatViewProps {
  tasks: Task[];
  isLoading?: boolean;
  onSkip: (id: string) => void;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (task: Task) => void;
}

function groupTasksByDate(tasks: Task[]): Array<{ label: string; tasks: Task[] }> {
  const sorted = [...tasks].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = new Map<string, Task[]>();

  for (const task of sorted) {
    const taskDay = new Date(task.createdAt);
    taskDay.setHours(0, 0, 0, 0);

    let label: string;
    if (taskDay.getTime() === today.getTime()) {
      label = "Aujourd'hui";
    } else if (taskDay.getTime() === yesterday.getTime()) {
      label = 'Hier';
    } else {
      const dd = String(taskDay.getDate()).padStart(2, '0');
      const mm = String(taskDay.getMonth() + 1).padStart(2, '0');
      const yyyy = taskDay.getFullYear();
      label = `${dd}/${mm}/${yyyy}`;
    }

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(task);
  }

  return Array.from(groups.entries()).map(([label, tasks]) => ({ label, tasks }));
}

const DateSeparator = ({ label }: { label: string }) => (
  <div className="flex items-center gap-3 py-2">
    <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
    <span className="text-xs font-medium text-slate-400 dark:text-slate-500 px-2">{label}</span>
    <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
  </div>
);

const SkeletonBubble = () => (
  <div className="flex flex-col gap-2">
    <div className="flex justify-end">
      <div className="h-12 w-2/3 animate-pulse rounded-2xl rounded-br-sm bg-slate-200 dark:bg-slate-700" />
    </div>
    <div className="flex justify-start">
      <div className="h-16 w-3/4 animate-pulse rounded-2xl rounded-bl-sm bg-slate-200 dark:bg-slate-700" />
    </div>
  </div>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
    <p className="text-sm">Aucune tâche pour le moment</p>
  </div>
);

export const ChatView: React.FC<ChatViewProps> = ({
  tasks,
  isLoading,
  onSkip,
  onResume,
  onDelete,
  onClick,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tasks.length]);

  const groups = groupTasksByDate(tasks);

  return (
    <div className="flex flex-col gap-4 px-4 pb-32" data-testid="chat-view">
      {isLoading ? (
        <>{[0, 1, 2].map(i => <SkeletonBubble key={i} />)}</>
      ) : tasks.length === 0 ? (
        <EmptyState />
      ) : (
        groups.map(group => (
          <React.Fragment key={group.label}>
            <DateSeparator label={group.label} />
            {group.tasks.map(task => (
              <ChatMessage
                key={task._id}
                task={task}
                onSkip={onSkip}
                onResume={onResume}
                onDelete={onDelete}
                onClick={onClick}
              />
            ))}
          </React.Fragment>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
};

export default ChatView;
