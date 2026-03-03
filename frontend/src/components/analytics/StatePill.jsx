export default function StatePill({ children, title }) {
    return (
        <span
            title={title}
            className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground"
        >
            {children}
        </span>
    );
}