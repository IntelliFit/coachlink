export default function CoachColumnLoading() {
    return (
        <div className="min-h-screen bg-surface-50 py-10 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto space-y-4">
                <div className="h-8 w-32 animate-pulse rounded-full bg-surface-200" />
                <div className="h-12 w-72 animate-pulse rounded-2xl bg-surface-200" />
                <div className="h-6 w-full max-w-2xl animate-pulse rounded-xl bg-surface-200" />
                {Array.from({ length: 3 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-40 animate-pulse rounded-3xl border border-surface-100 bg-surface"
                    />
                ))}
            </div>
        </div>
    );
}
