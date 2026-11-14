import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';

export function RecentSitesSkeleton() {
  return (
    <div className="divide-y">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="size-4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DeploymentsSkeleton() {
  return (
    <Card>
      <CardHeader className="gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 py-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="justify-end p-3">
        <Skeleton className="h-8 w-36 rounded-md" />
      </CardFooter>
    </Card>
  );
}

export function WorkersCronJobsSkeleton() {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      {[...Array(2)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Skeleton className="size-8 rounded-lg" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-8 w-16 rounded-md" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {[...Array(2)].map((_, j) => (
                <div key={j} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
