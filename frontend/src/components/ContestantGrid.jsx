/**
 * components/ContestantGrid.jsx
 * 
 * Component hiển thị danh sách thí sinh dưới dạng grid card.
 * Mục đích: dùng chung cho LiveView, PresentationScreen, Events.
 * 
 * Props:
 *   - contestants: array of { id, name, card_id, status, correct_count, ... }
 *   - renderCard: (contestant) => JSX — tùy chỉnh nội dung card
 *   - columns: số cột (default: responsive)
 *   - gap: khoảng cách (default: 2)
 *   - className: class thêm cho container
 */

import React from 'react';
import clsx from 'clsx';

export default function ContestantGrid({
    contestants = [],
    renderCard,
    columns = 'auto',
    gap = 3,
    className = '',
    title,
    emptyMessage = 'Không có thí sinh',
}) {
    // Nếu columns = 'auto', dùng responsive grid
    const gridClass = columns === 'auto'
        ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3'
        : `grid gap-${gap}`;

    const colStyle = columns !== 'auto'
        ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
        : {};

    return (
        <div className={clsx('flex flex-col h-full overflow-hidden', className)}>
            {/* Header */}
            {title && (
                <div className="px-4 py-3 border-b border-slate-200 shrink-0">
                    <h3 className="text-sm font-bold text-slate-700">{title}</h3>
                </div>
            )}

            {/* Grid */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
                {contestants.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <div className="text-center">
                            <p className="text-sm text-slate-500">{emptyMessage}</p>
                        </div>
                    </div>
                ) : (
                    <div className={gridClass} style={colStyle}>
                        {contestants.map(c =>
                            renderCard ? (
                                <div key={c.id}>
                                    {renderCard(c)}
                                </div>
                            ) : (
                                /* Default card */
                                <DefaultCard key={c.id} contestant={c} />
                            )
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Default card component — dùng khi không cung cấp renderCard
 */
function DefaultCard({ contestant }) {
    const { card_id, name, status } = contestant;

    const statusColor = {
        winner: 'bg-yellow-500',
        eliminated: 'bg-slate-300',
        active: 'bg-green-500',
    }[status] || 'bg-blue-500';

    return (
        <div
            className={clsx(
                'rounded-lg p-2 flex flex-col items-center justify-center aspect-[6/1] text-center transition-transform hover:scale-105',
                statusColor,
                'text-white shadow-sm'
            )}
            title={name}
        >
            <div className="text-sm font-extrabold leading-tight">
                #{String(card_id).padStart(2, '0')}
            </div>
            <div className="text-xs font-medium leading-tight mt-0.5 truncate w-full px-0.5">
                {name}
            </div>
        </div>
    );
}

