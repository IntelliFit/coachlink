// 实体商品数据（用于过审展示）
interface PhysicalProduct {
    id: string;
    name: string;
    price: number;
    originalPrice?: number;
    imageUrl: string;
    badge?: string;
}

const PHYSICAL_PRODUCTS: PhysicalProduct[] = [
    { id: 'pp-1', name: '核心怪负重腰带', price: 128, originalPrice: 198, imageUrl: '/images/products/weight-belt.png', badge: '热销' },
    { id: 'pp-2', name: '液态镁粉', price: 34, originalPrice: 44, imageUrl: '/images/products/liquid-chalk.png' },
    { id: 'pp-3', name: '康比特乳清蛋白粉', price: 134, originalPrice: 164, imageUrl: '/images/products/protein-powder.png', badge: '推荐' },
    { id: 'pp-4', name: '深海鱼油软胶囊', price: 64, originalPrice: 84, imageUrl: '/images/products/fish-oil.png' },
];

export default function GearSection({ onSelect }: { onSelect: () => void }) {
    return (
        <section className="flex flex-col gap-5">
            <h2 className="text-2xl md:text-[28px] font-black tracking-tight text-surface-900">训练装备</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] md:gap-4">
                {PHYSICAL_PRODUCTS.map((product) => (
                    <button
                        key={product.id}
                        type="button"
                        onClick={onSelect}
                        className="flex flex-col gap-2.5 rounded-2xl border border-surface-200 bg-surface-0 p-3 text-left transition-colors hover:border-surface-300"
                    >
                        <span className="relative block aspect-square overflow-hidden rounded-xl bg-surface-100">
                            <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="h-full w-full object-contain mix-blend-multiply dark:mix-blend-normal"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                            {product.badge && (
                                <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                                    {product.badge}
                                </span>
                            )}
                        </span>
                        <span className="truncate text-[15px] text-surface-900">{product.name}</span>
                        <span>
                            <span className="text-xl font-black text-surface-900">¥{product.price}</span>
                            {product.originalPrice && (
                                <span className="ml-1.5 text-[13px] text-surface-500 line-through">¥{product.originalPrice}</span>
                            )}
                        </span>
                    </button>
                ))}
            </div>
        </section>
    );
}
