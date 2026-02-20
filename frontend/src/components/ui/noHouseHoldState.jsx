import { Button } from '@/components/ui/button'
export const NoHouseholdState = ({ onRetry }) => {
  return (
    <div className="p-6 space-y-3">
      <h1 className="text-2xl font-bold flex items-center gap-2">You’re not in a household yet</h1>
      <p className="text-muted-foreground mt-1">
        Create a household or ask someone to invite you to unlock analytics.
      </p>

      <div className="flex gap-2 pt-2">
        <Button variant="default" onClick={() => (window.location.href = "/dashboard/household")}>
          Go to Household
        </Button>
        {onRetry &&
          <Button variant="outline" onClick={onRetry}>
            Retry
          </Button>
        }
      </div>
    </div>
  );
};


