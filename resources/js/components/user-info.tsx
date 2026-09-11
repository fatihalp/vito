import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, getInitials } from "@/lib/utils";
import { type User } from '@/types/user';

export function UserInfo({
  user,
  showEmail = false,
  hideTextOnCollapse = false,
}: {
  user: User;
  showEmail?: boolean;
  hideTextOnCollapse?: boolean;
}) {
  return (
    <>
      <Avatar className="h-8 w-8 rounded-md shrink-0">
        <AvatarImage src={user.avatar} alt={user.name} />
        <AvatarFallback className="bg-accent text-accent-foreground border-ring rounded-md border">{getInitials(user.name)}</AvatarFallback>
      </Avatar>
      <div className={cn("grid flex-1 text-left text-sm leading-tight", hideTextOnCollapse && "group-data-[state=collapsed]:hidden")}>
        <span className="truncate font-medium">{user.name}</span>
        {showEmail && <span className="text-muted-foreground truncate text-xs">{user.email}</span>}
      </div>
    </>
  );
}
