import { generateGarden } from '@/lib/garden';
import Garden from './components/Garden';

export const dynamic = 'force-dynamic';

const START_DATE = new Date('2017-10-27');
const END_DATE = new Date('2026-02-14');
const MAX_FLOWERS = Math.floor(
    (END_DATE.getTime() - START_DATE.getTime()) / (1000 * 60 * 60 * 24),
);

export default function Home() {
    const today = new Date();
    console.log(`Today's date: ${today.toISOString().split('T')[0]}`);
    console.log(`Start date: ${START_DATE.toISOString().split('T')[0]}`);
    const daysSinceStart = Math.floor(
        (today.getTime() - START_DATE.getTime()) / (1000 * 60 * 60 * 24),
    );
    const count = Math.max(0, Math.min(daysSinceStart, MAX_FLOWERS));
    console.log(
        `Generating garden with ${count} flowers (days since start: ${daysSinceStart})`,
    );
    const flowers = generateGarden(count);
    const isPastValentine = today >= END_DATE;

    return (
        <Garden
            flowers={flowers}
            total={count}
            endDate="2026-02-14T00:00:00"
            isPastValentine={isPastValentine}
        />
    );
}
