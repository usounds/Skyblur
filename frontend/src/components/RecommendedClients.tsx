import { useLocaleStore } from "@/state/Locale";

export const RecommendedClients = () => {
    const locale = useLocaleStore((state) => state.localeData);

    return (
        <div className="mt-8 mx-4 text-center text-sm text-gray-500">
            <p className="mb-2">{locale.Home_RecommendedClients}</p>
            <div className="flex flex-wrap justify-center gap-3">
                <a href="https://tokimeki.blue/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">TOKIMEKI</a>
                <span>|</span>
                <a href={locale.Home_HagoromoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{locale.Home_HagoromoName}</a>
                <span>|</span>
                <span>ZonePane (<a href="https://play.google.com/store/apps/details?id=com.zonepane" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Android</a> / <a href="https://apps.apple.com/jp/app/zonepane-multi-sns-client/id6747976082" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">iOS</a>)</span>
            </div>
        </div>
    );
};
