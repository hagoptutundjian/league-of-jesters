import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function TeamPageLoading() {
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-6 w-24" />
      </div>

      {/* Cap Summary Cards */}
      <div className="grid grid-cols-2 gap-2 md:gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-2 md:p-0">
            <CardHeader className="pb-1 md:pb-2 p-2 md:p-6">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent className="p-2 md:p-6 pt-0">
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Salary Projection */}
      <Card>
        <CardHeader className="pb-2 px-3 md:px-6">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="px-2 md:px-6">
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Position Groups */}
      {[...Array(4)].map((_, i) => (
        <Card key={i} className="border-l-4 border-l-gray-300">
          <CardHeader className="pb-2 px-3 md:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-8 rounded-full" />
              </div>
              <Skeleton className="h-8 w-16" />
            </div>
          </CardHeader>
          <CardContent className="px-2 md:px-6">
            <div className="space-y-2">
              {[...Array(3)].map((_, j) => (
                <Skeleton key={j} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Draft Picks */}
      <Card className="border-l-4 border-l-slate-500">
        <CardHeader className="pb-2 px-3 md:px-6">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-6 w-8 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="px-2 md:px-6">
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
