import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

function getInitials(name) {
  return (name || 'AI')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function AssistantsGrid({ assistants }) {
  if (!assistants.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No assistants found. Try creating your own from the dashboard.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {assistants.map((assistant) => (
        <Card key={assistant.id} className="flex flex-col h-full">
          <CardHeader className="flex flex-row items-start gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-xs">
                {getInitials(assistant.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-sm font-semibold truncate">
                {assistant.name}
              </CardTitle>
              <CardDescription className="text-xs">
                {assistant.tagline || assistant.category || 'Assistant'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            <p className="text-xs text-muted-foreground line-clamp-3">
              {assistant.description}
            </p>
            <div className="mt-auto flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {typeof assistant.chatsCount === 'number'
                  ? `${assistant.chatsCount} chats`
                  : ''}
              </span>
              {typeof assistant.rating === 'number' && (
                <span>⭐ {assistant.rating.toFixed(1)}</span>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" asChild>
                <Link to={`/assistants/${assistant.id}`}>View</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to={`/assistants/${assistant.id}/chat`}>Chat</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default AssistantsGrid;
